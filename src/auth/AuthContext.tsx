// src/auth/AuthContext.tsx
import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import {
  fetchCurrentUser,
  loginWithPassword,
  loginWithProvider,
  registerWithPassword,
  fetchUserAcademies,
  switchAcademy as apiSwitchAcademy,
  type AuthApiUser,
  type AuthApiHealthFlags,
  type RegisterPayload,
  type AcademyForUser,
  type AcademyBranding,
} from "../services/authApi";
import { hasPermission as checkPermission, resolvePermissions, type AccessProfile, type AppPermission } from "./accessControl";
import { SESSION_EXPIRED_EVENT } from "../services/apiBase";
import { clearTokens as clearStoredTokens, getAccessToken, getRefreshToken, setTokens } from "../services/authTokens";
import { API_URL } from "../services/apiBase";
import { extractTenantSlug, fetchBranding, applyBranding, removeBranding } from "../services/tenantHost";
import { hydrateOnboardingFromUser } from "../pages/user/onboarding/onboardingStorage";

export type Role = "user" | "personal" | "nutri" | "admin";

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  cpf?: string;
  phone?: string;
  role: Role;
  fitnessGoal?: string;
  experienceLevel?: string;
  heightCm?: number;
  weightKg?: number;
  dietaryRestrictions?: string;
  subscriptionTier?: string;
  profileCompleted?: boolean;
  accessProfile?: AccessProfile;
  permissions?: AppPermission[];
  healthFlags?: AuthApiHealthFlags;
  onboardingAnswers?: Record<string, unknown>;
  parqAnswers?: Array<{ id: string; yes: boolean }>;
  parqSignedAt?: string;
  parqFormVersion?: string;
  parqAnyYes?: boolean;
  studentComplianceComplete?: boolean;
  mustChangePassword?: boolean;
}

export type { AcademyForUser, AcademyBranding };

type AuthState = {
  isAuthenticated: boolean;
  role: Role | null;
  email: string | null;
  id: string | null;
  user?: AuthUser;
  profileCompleted?: boolean;
  accessProfile?: AccessProfile | null;
  permissions?: AppPermission[];
  activeAcademyId?: number | null;
  academies?: AcademyForUser[];
  branding?: AcademyBranding | null;
  /** Active product keys from JWT (populated after login/refresh). */
  products?: string[];
};

type LoginResult = Promise<{ ok: true; role: Role; email: string; id: string } | { ok: false; message: string }>;
type RegisterResult = Promise<
  | { ok: true; role: Role; email: string; id: string; requiresProfileCompletion: boolean }
  | { ok: false; message: string; code?: string }
>;
type OAuthLoginResult = { ok: true; role: Role; email: string; id: string; requiresProfileCompletion: boolean } | { ok: false; message: string };

type AuthContextType = AuthState & {
  login: (email: string, password: string) => LoginResult;
  register: (payload: RegisterPayload) => RegisterResult;
  loginWithOAuth: (provider: 'google' | 'apple', idToken: string, userData?: { name?: string; email?: string }) => Promise<OAuthLoginResult>;
  logout: () => void;
  getUser: () => Promise<AuthUser | null>;
  accessProfile: AccessProfile | null;
  permissions: AppPermission[];
  hasPermission: (permission: AppPermission) => boolean;
  hasProduct: (productKey: string) => boolean;
  switchAcademy: (academyId: number) => Promise<{ ok: true } | { ok: false; message: string }>;

};

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeEmail(email: string) {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Picks the active academy from the list.
 * On a tenant subdomain, finds the academy whose slug matches the hostname.
 * Em login geral (app.minutofit.com.br) com >1 academia: prioriza a
 * "MinutoFit Direto" (slug `minutofit-direto`) — é a área pessoal do aluno
 * MaaS. Para entrar como dono/equipe de outra academia, usar o subdomínio
 * próprio (ex: phgym.minutofit.com.br).
 */
const DEFAULT_ACADEMY_SLUG = "minutofit-direto";

function resolveActiveAcademyId(academies: AcademyForUser[]): number | null {
  if (academies.length === 0) return null;
  const slug = extractTenantSlug();
  if (slug) {
    const match = academies.find((a) => a.slug === slug);
    if (match) return match.id;
  }
  if (academies.length === 1) return academies[0].id;
  const direct = academies.find((a) => a.slug === DEFAULT_ACADEMY_SLUG);
  if (direct) return direct.id;
  return academies[0].id;
}

const ACADEMY_PROFILES_SET = new Set([
  "academy_owner", "academy_manager", "academy_finance",
  "academy_reception", "academy_personal", "academy_nutri",
]);

/**
 * When the JWT was issued without academy context (e.g. old frontend without X-Tenant-Host),
 * but the frontend resolved an activeAcademyId from the tenant host, silently call
 * switch-academy to get a fresh token with proper accessProfile and permissions.
 * Returns the updated user, or the original if switch fails.
 */
async function ensureAcademyContext(
  user: AuthApiUser,
  resolvedAcademyId: number | null,
): Promise<{ user: AuthApiUser; refreshedToken: boolean }> {
  // Skip if JWT already carries a valid academy access profile
  const hasAcademyContext = ACADEMY_PROFILES_SET.has(user.accessProfile ?? "");
  if (hasAcademyContext || !resolvedAcademyId) return { user, refreshedToken: false };

  try {
    const data = await apiSwitchAcademy(resolvedAcademyId);
    setTokens(data.accessToken, getAccessToken() ?? "");
    const updated = await fetchCurrentUser();
    return { user: updated ?? user, refreshedToken: true };
  } catch {
    return { user, refreshedToken: false };
  }
}

function decodeJwtProducts(token: string | null): string[] {
  if (!token) return [];
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Array.isArray(payload.products) ? (payload.products as string[]) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
    email: null,
    id: null,
    accessProfile: null,
    permissions: [],
    activeAcademyId: null,
    academies: [],
    branding: null,
  });

  // FE-1.7.3: Apply academy branding on mount (before auth check), graceful fallback
  useEffect(() => {
    void fetchBranding().then(applyBranding).catch(() => { /* silently use default theme */ });
  }, []);

  // Load auth from localStorage on mount (access token may be expired; fetchCurrentUser uses refresh via authFetch)
  useEffect(() => {
    if (!getAccessToken()) return;

    let cancelled = false;

    void (async () => {
      try {
        const user = await fetchCurrentUser();
        if (cancelled) return;
        if (user) {
          let academies: AcademyForUser[] = [];
          try { academies = await fetchUserAcademies(); } catch { /* schema may not exist yet */ }
          const activeAcademyId = resolveActiveAcademyId(academies);
          // If JWT was issued without academy context, auto-switch to get proper permissions
          const { user: finalUser } = await ensureAcademyContext(user, activeAcademyId);

          // Hidrata localStorage com onboarding vindo do servidor (cross-device sync)
          if (finalUser.id && finalUser.onboardingAnswers) {
            hydrateOnboardingFromUser(
              String(finalUser.id),
              finalUser.onboardingAnswers as any
            );
          }

          setState({
            isAuthenticated: true,
            role: finalUser.role,
            email: finalUser.email,
            id: finalUser.id?.toString(),
            user: finalUser,
            profileCompleted: finalUser.profileCompleted,
            accessProfile: finalUser.accessProfile ?? null,
            permissions: finalUser.permissions ?? [],
            activeAcademyId,
            academies,
            branding: null,
            products: decodeJwtProducts(getAccessToken()),
          });
        } else {
          clearStoredTokens();
          setState({ isAuthenticated: false, role: null, email: null, id: null, accessProfile: null, permissions: [], activeAcademyId: null, academies: [], branding: null });
        }
      } catch (err) {
        console.error("Error restoring session:", err);
        if (cancelled) return;
        clearStoredTokens();
        setState({ isAuthenticated: false, role: null, email: null, id: null, accessProfile: null, permissions: [], activeAcademyId: null, academies: [], branding: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      clearStoredTokens();
      setState({
        isAuthenticated: false,
        role: null,
        email: null,
        id: null,
        accessProfile: null,
        permissions: [],
        activeAcademyId: null,
        academies: [],
        branding: null,
      });
      if (window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const value = useMemo<AuthContextType>(() => {
    return {
      ...state,
      accessProfile: resolvePermissions(state.role, state.user?.accessProfile, state.user?.permissions).profile,
      permissions: resolvePermissions(state.role, state.user?.accessProfile, state.user?.permissions).permissions,
      hasPermission: (permission) =>
        checkPermission(
          resolvePermissions(state.role, state.user?.accessProfile, state.user?.permissions).permissions,
          permission
        ),
      hasProduct: (productKey: string) => {
        if (state.role === 'admin') return true; // MetaCore admin bypasses all product gates
        // Academy staff profiles implicitly hold the 'academia' product even if
        // user_products was not yet seeded (e.g. seed missing in production).
        if (
          productKey === 'academia' &&
          typeof state.user?.accessProfile === 'string' &&
          state.user.accessProfile.startsWith('academy_') &&
          state.user.accessProfile !== 'academy_student'
        ) {
          return true;
        }
        return (state.products ?? []).includes(productKey);
      },

      switchAcademy: async (academyId) => {
        try {
          const data = await apiSwitchAcademy(academyId);
          setTokens(data.accessToken, getAccessToken() ?? "");

          // FE-1.7.3: hard redirect to the academy's subdomain so browser storage is isolated.
          // In dev (no subdomain routing), fall back to SPA navigation.
          const slug = data.activeAcademy?.slug;
          const isProd = window.location.hostname.endsWith('.minutofit.com.br') ||
                         window.location.hostname === 'minutofit.com.br';
          if (slug && isProd) {
            window.location.href = `https://${slug}.minutofit.com.br/app/academy/dashboard`;
            return { ok: true as const };
          }

          // Dev: SPA navigation
          removeBranding();
          setState((prev) => ({
            ...prev,
            activeAcademyId: academyId,
            branding: data.activeAcademy.branding ?? null,
          }));
          return { ok: true as const };
        } catch (err: any) {
          return { ok: false as const, message: err.message || "Erro ao trocar academia." };
        }
      },

      login: async (email, password) => {
        const normalizedEmail = normalizeEmail(email);
        const normalizedPass = (password ?? "").trim();

        if (!normalizedEmail || !normalizedEmail.includes("@")) {
          return { ok: false, message: "Informe um e-mail válido." };
        }
        if (!normalizedPass) {
          return { ok: false, message: "Informe sua senha." };
        }

        try {
          const data = await loginWithPassword(normalizedEmail, normalizedPass);
          setTokens(data.accessToken, data.refreshToken);

          let academies: AcademyForUser[] = [];
          try { academies = await fetchUserAcademies(); } catch { /* schema may not exist yet */ }
          const activeAcademyId = resolveActiveAcademyId(academies);
          const { user: finalUser } = await ensureAcademyContext(data.user, activeAcademyId);

          setState({
            isAuthenticated: true,
            role: finalUser.role,
            email: finalUser.email,
            id: finalUser.id?.toString(),
            user: finalUser,
            profileCompleted: finalUser.profileCompleted,
            accessProfile: finalUser.accessProfile ?? null,
            permissions: finalUser.permissions ?? [],
            activeAcademyId,
            academies,
            branding: null,
            products: decodeJwtProducts(getAccessToken()),
          });

          return {
            ok: true as const,
            role: finalUser.role,
            email: finalUser.email,
            id: finalUser.id?.toString(),
          };
        } catch (err: any) {
          return {
            ok: false as const,
            message: err.message || "Credenciais inválidas. Verifique e-mail e senha.",
          };
        }
      },

      register: async (payload) => {
        try {
          const data = await registerWithPassword(payload);
          setTokens(data.accessToken, data.refreshToken);

          setState({
            isAuthenticated: true,
            role: data.user.role,
            email: data.user.email,
            id: data.user.id?.toString(),
            user: data.user,
            profileCompleted: data.user.profileCompleted,
            accessProfile: data.user.accessProfile ?? null,
            permissions: data.user.permissions ?? [],
            products: decodeJwtProducts(getAccessToken()),
          });

          return {
            ok: true as const,
            role: data.user.role,
            email: data.user.email,
            id: data.user.id?.toString(),
            requiresProfileCompletion: !data.user.profileCompleted,
          };
        } catch (err: unknown) {
          const e = err as { message?: string; code?: string };
          return {
            ok: false as const,
            message: e.message || "Nao foi possivel criar sua conta.",
            ...(typeof e.code === "string" ? { code: e.code } : {}),
          };
        }
      },

      loginWithOAuth: async (provider, idToken, userData) => {
        try {
          const data = await loginWithProvider(provider, idToken, userData);
          const { user, accessToken, refreshToken, requiresProfileCompletion } = data;
          setTokens(accessToken, refreshToken);

          // Update state
          setState({
            isAuthenticated: true,
            role: user.role,
            email: user.email,
            id: user.id?.toString(),
            user,
            profileCompleted: user.profileCompleted,
            accessProfile: user.accessProfile ?? null,
            permissions: user.permissions ?? [],
            products: decodeJwtProducts(getAccessToken()),
          });

          return {
            ok: true as const,
            role: user.role,
            email: user.email,
            id: user.id?.toString(),
            requiresProfileCompletion: requiresProfileCompletion || !user.profileCompleted,
          };
        } catch (err: any) {
          console.error('OAuth error:', err);
          return {
            ok: false as const,
            message: err.message || 'OAuth login failed',
          };
        }
      },

      logout: () => {
        // Fire-and-forget: invalidate refresh token on backend (JTI denylist)
        const refreshToken = getRefreshToken();
        const accessToken = getAccessToken();
        if (refreshToken && accessToken) {
          fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ refreshToken }),
          }).catch(() => {
            // ignore network errors — local state is cleared regardless
          });
        }
        clearStoredTokens();
        removeBranding(); // FE-1.7.3: clean up injected academy CSS on logout
        setState({
          isAuthenticated: false,
          role: null,
          email: null,
          id: null,
          accessProfile: null,
          permissions: [],
          activeAcademyId: null,
          academies: [],
          branding: null,
        });
      },

      getUser: async () => {
        if (!getAccessToken()) return null;

        try {
          const user = await fetchCurrentUser();
          if (user) {
            setState((prev) => ({
              ...prev,
              user,
              profileCompleted: user.profileCompleted ?? prev.profileCompleted,
              accessProfile: user.accessProfile ?? null,
              permissions: user.permissions ?? [],
            }));
          }
          return user;
        } catch (err) {
          console.error("Error fetching user:", err);
          return null;
        }
      },

    };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
