// src/auth/AuthContext.tsx
import React, { createContext, useContext, useMemo, useState } from "react";

export type Role = "user" | "personal" | "nutri" | "admin";

type AuthState = {
  isAuthenticated: boolean;
  role: Role | null;
  email: string | null;
  /** ✅ id estável para o storage (no MVP, email normalizado) */
  id: string | null;
};

type LoginResult = { ok: true; role: Role; email: string; id: string } | { ok: false; message: string };

type AuthContextType = AuthState & {
  login: (email: string, password: string) => LoginResult;
  logout: () => void;

  /** ✅ Admin */
  resetUserPassword: (email: string, newPassword?: string) => { ok: true; message: string } | { ok: false; message: string };
  listUsers: () => Array<{ email: string; role: Role }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

type UserRecord = { email: string; password: string; role: Role };

const USERS_KEY = "treinai_mock_users_v1";

const DEFAULT_USERS: UserRecord[] = [
  { email: "teste1@treinai.com", password: "123456", role: "user" },
  { email: "teste2@treinai.com", password: "123456", role: "user" },
  { email: "teste3@treinai.com", password: "123456", role: "user" },
  { email: "teste4@treinai.com", password: "123456", role: "user" },
  { email: "teste5@treinai.com", password: "123456", role: "user" },

  { email: "personal@treinai.com", password: "123456", role: "personal" },
  { email: "admin@treinai.com", password: "123456", role: "admin" },
];

function normalizeEmail(email: string) {
  return (email ?? "").trim().toLowerCase();
}

function ensureUsersSeeded() {
  const raw = localStorage.getItem(USERS_KEY);
  if (raw) return;
  localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
}

function readUsers(): UserRecord[] {
  ensureUsersSeeded();
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as UserRecord[]) : DEFAULT_USERS;
    // validação mínima
    if (!Array.isArray(parsed)) return DEFAULT_USERS;
    return parsed.filter((u) => u?.email && u?.password && u?.role);
  } catch {
    return DEFAULT_USERS;
  }
}

function writeUsers(users: UserRecord[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
    email: null,
    id: null,
  });

  const value = useMemo<AuthContextType>(() => {
    return {
      ...state,

      login: (email, password) => {
        const normalizedEmail = normalizeEmail(email);
        const normalizedPass = (password ?? "").trim();

        if (!normalizedEmail || !normalizedEmail.includes("@")) {
          return { ok: false, message: "Informe um e-mail válido." };
        }
        if (!normalizedPass) {
          return { ok: false, message: "Informe sua senha." };
        }

        const users = readUsers();
        const found = users.find(
          (u) => normalizeEmail(u.email) === normalizedEmail && u.password === normalizedPass
        );

        if (!found) {
          return { ok: false, message: "Credenciais inválidas. Verifique e-mail e senha." };
        }

        const id = normalizedEmail; // ✅ no MVP: id = email normalizado
        setState({ isAuthenticated: true, role: found.role, email: found.email, id });
        return { ok: true, role: found.role, email: found.email, id };
      },

      logout: () => setState({ isAuthenticated: false, role: null, email: null, id: null }),

      resetUserPassword: (email, newPassword) => {
        const target = normalizeEmail(email);
        if (!target || !target.includes("@")) return { ok: false, message: "Informe um e-mail válido." };

        const pass = (newPassword ?? "123456").trim();
        if (pass.length < 4) return { ok: false, message: "A senha deve ter pelo menos 4 caracteres (MVP)." };

        const users = readUsers();
        const idx = users.findIndex((u) => normalizeEmail(u.email) === target);
        if (idx === -1) return { ok: false, message: "Usuário não encontrado no mock." };

        users[idx] = { ...users[idx], password: pass };
        writeUsers(users);

        return { ok: true, message: `Senha atualizada para ${users[idx].email} (nova: ${pass}).` };
      },

      listUsers: () => {
        const users = readUsers();
        return users.map((u) => ({ email: u.email, role: u.role }));
      },
    };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}