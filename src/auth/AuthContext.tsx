// src/auth/AuthContext.tsx
import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import {
  fetchCurrentUser,
  loginWithPassword,
  loginWithProvider,
  registerWithPassword,
  type AuthApiHealthFlags,
  type RegisterPayload,
} from "../services/authApi";
import { hasPermission as checkPermission, resolvePermissions, type AccessProfile, type AppPermission } from "./accessControl";
import { SESSION_EXPIRED_EVENT } from "../services/apiBase";
import { clearTokens as clearStoredTokens, getAccessToken, setTokens } from "../services/authTokens";

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
}

type AuthState = {
  isAuthenticated: boolean;
  role: Role | null;
  email: string | null;
  id: string | null;
  user?: AuthUser;
  profileCompleted?: boolean;
  accessProfile?: AccessProfile | null;
  permissions?: AppPermission[];
};

type LoginResult = Promise<{ ok: true; role: Role; email: string; id: string } | { ok: false; message: string }>;
type RegisterResult = Promise<{ ok: true; role: Role; email: string; id: string; requiresProfileCompletion: boolean } | { ok: false; message: string }>;
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

  /** ✅ Admin (Mock)*/
  resetUserPassword: (email: string, newPassword?: string) => { ok: true; message: string } | { ok: false; message: string };
  listUsers: () => Array<{ email: string; role: Role }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeEmail(email: string) {
  return (email ?? "").trim().toLowerCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
    email: null,
    id: null,
    accessProfile: null,
    permissions: [],
  });

  // Load auth from localStorage on mount (access token may be expired; fetchCurrentUser uses refresh via authFetch)
  useEffect(() => {
    if (!getAccessToken()) return;

    let cancelled = false;

    void (async () => {
      try {
        const user = await fetchCurrentUser();
        if (cancelled) return;
        if (user) {
          setState({
            isAuthenticated: true,
            role: user.role,
            email: user.email,
            id: user.id?.toString(),
            user,
            profileCompleted: user.profileCompleted,
            accessProfile: user.accessProfile ?? null,
            permissions: user.permissions ?? [],
          });
        } else {
          clearStoredTokens();
          setState({ isAuthenticated: false, role: null, email: null, id: null, accessProfile: null, permissions: [] });
        }
      } catch (err) {
        console.error("Error restoring session:", err);
        if (cancelled) return;
        clearStoredTokens();
        setState({ isAuthenticated: false, role: null, email: null, id: null, accessProfile: null, permissions: [] });
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

          setState({
            isAuthenticated: true,
            role: data.user.role,
            email: data.user.email,
            id: data.user.id?.toString(),
            user: data.user,
            profileCompleted: data.user.profileCompleted,
            accessProfile: data.user.accessProfile ?? null,
            permissions: data.user.permissions ?? [],
          });

          return {
            ok: true as const,
            role: data.user.role,
            email: data.user.email,
            id: data.user.id?.toString(),
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
          });

          return {
            ok: true as const,
            role: data.user.role,
            email: data.user.email,
            id: data.user.id?.toString(),
            requiresProfileCompletion: !data.user.profileCompleted,
          };
        } catch (err: any) {
          return {
            ok: false as const,
            message: err.message || "Nao foi possivel criar sua conta.",
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
        clearStoredTokens();
        setState({
          isAuthenticated: false,
          role: null,
          email: null,
          id: null,
          accessProfile: null,
          permissions: [],
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

      resetUserPassword: (email, newPassword) => {
        const target = normalizeEmail(email);
        if (!target || !target.includes("@")) return { ok: false, message: "Informe um e-mail válido." };

        const pass = (newPassword ?? "123456").trim();
        if (pass.length < 4) return { ok: false, message: "A senha deve ter pelo menos 4 caracteres." };

        return { ok: false, message: "Reset local desativado. Use o backend/admin para gerenciar senhas." };
      },

      listUsers: () => [],
    };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
