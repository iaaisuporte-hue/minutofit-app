import type { Role } from "../auth/AuthContext";
import type { AccessProfile, AppPermission } from "../auth/accessControl";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface AuthApiUser {
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

export interface RegisterPayload {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
  healthFlags: {
    sem_historico_hipertensao: boolean;
    sem_historico_cardiaco: boolean;
    sem_restricao_medica_exercicio: boolean;
    apto_para_atividade_fisica: boolean;
    aceita_responsabilidade_informacoes: boolean;
  };
}

export interface AuthApiSuccess {
  user: AuthApiUser;
  accessToken: string;
  refreshToken?: string;
  requiresProfileCompletion?: boolean;
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loginWithPassword(email: string, password: string): Promise<AuthApiSuccess> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel entrar.");
  }

  return data.data;
}

export async function registerWithPassword(payload: RegisterPayload): Promise<AuthApiSuccess> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel criar sua conta.");
  }

  return data.data;
}

export async function loginWithProvider(
  provider: "google" | "apple",
  idToken: string,
  userData?: { name?: string; email?: string },
): Promise<AuthApiSuccess> {
  const endpoint =
    provider === "google"
      ? `${API_URL}/auth/oauth/google/callback`
      : `${API_URL}/auth/oauth/apple/callback`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idToken: provider === "google" ? idToken : undefined,
      identityToken: provider === "apple" ? idToken : undefined,
      name: userData?.name,
      email: userData?.email,
    }),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `Falha no login com ${provider}.`);
  }

  return data.data;
}

export async function fetchCurrentUser(token: string): Promise<AuthApiUser | null> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await parseJson(response);
  return data?.data?.user || null;
}
