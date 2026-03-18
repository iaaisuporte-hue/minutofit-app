// src/auth/AuthContext.tsx
import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { fetchCurrentUser, loginWithPassword, loginWithProvider, registerWithPassword, type RegisterPayload } from "../services/authApi";
import { hasPermission as checkPermission, resolvePermissions, type AccessProfile, type AppPermission } from "./accessControl";

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

const TOKEN_KEY = "minutofit_token";
const REFRESH_TOKEN_KEY = "minutofit_refresh_token";
const LEGACY_TOKEN_KEY = "token";

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

  // Load auth from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // Try to restore session from token
      restoreSessionFromToken(token);
    }
  }, []);

  async function restoreSessionFromToken(token: string) {
    try {
      const user = await fetchCurrentUser(token);
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
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        setState({ isAuthenticated: false, role: null, email: null, id: null });
      }
    } catch (err) {
      console.error("Error restoring session:", err);
      setState({ isAuthenticated: false, role: null, email: null, id: null });
    }
  }

  const value = useMemo<AuthContextType>(() => {
    const storeTokens = (accessToken: string, refreshToken?: string) => {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
    };

    const clearTokens = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    };

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
          storeTokens(data.accessToken, data.refreshToken);

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
          storeTokens(data.accessToken, data.refreshToken);

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
          storeTokens(accessToken, refreshToken);

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
        clearTokens();
        setState({ isAuthenticated: false, role: null, email: null, id: null });
      },

      getUser: async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;

        try {
          return await fetchCurrentUser(token);
        } catch (err) {
          console.error('Error fetching user:', err);
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
