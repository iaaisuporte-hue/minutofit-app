import type { Role } from "../auth/AuthContext";
import type { AccessProfile, AppPermission } from "../auth/accessControl";
import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { extractTenantSlug } from "./tenantHost";

export interface AuthApiHealthFlags {
  semHistoricoHipertensao?: boolean;
  semHistoricoCardiaco?: boolean;
  semRestricaoMedicaExercicio?: boolean;
  aptoParaAtividadeFisica?: boolean;
  aceitaResponsabilidadeInformacoes?: boolean;
}

export interface AuthApiUser {
  id: number;
  email: string;
  name?: string;
  cpf?: string;
  phone?: string;
  role: Role;
  photoUrl?: string;
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
  parqExpiresAt?: string;
  parqSignatureLevel?: number;
  physicalActivityClearance?: {
    valid: boolean;
    signedAt: string | null;
    expiresAt: string | null;
    reason: 'ok' | 'never_signed' | 'expired' | 'incomplete_health_flags' | 'not_applicable';
  };
  studentComplianceComplete?: boolean;
  mustChangePassword?: boolean;
}

export interface RegisterPayload {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
  /** Triagem em Configurações quando omitido. */
  healthFlags?: {
    sem_historico_hipertensao: boolean;
    sem_historico_cardiaco: boolean;
    sem_restricao_medica_exercicio: boolean;
    apto_para_atividade_fisica: boolean;
    aceita_responsabilidade_informacoes: boolean;
  };
  /** Token Cloudflare Turnstile (obrigatório quando o site usa CAPTCHA no cadastro). */
  captchaToken?: string;
  /** Aceite dos Termos de Uso + Política de Privacidade (obrigatório — LGPD art. 8º). */
  acceptedTerms: boolean;
}

/** Cadastro de personal: sem PAR-Q (é triagem de aluno), com CREF opcional. */
export interface RegisterPersonalPayload {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
  /** CREF declarado. Texto livre, não verificado pela plataforma. */
  registryCode?: string;
  /** Token Cloudflare Turnstile (obrigatório quando o site usa CAPTCHA no cadastro). */
  captchaToken?: string;
  /** Aceite dos Termos de Uso + Política de Privacidade (obrigatório — LGPD art. 8º). */
  acceptedTerms: boolean;
}

export async function submitStudentCompliance(payload: {
  healthFlags: {
    sem_historico_hipertensao: boolean;
    sem_historico_cardiaco: boolean;
    sem_restricao_medica_exercicio: boolean;
    apto_para_atividade_fisica: boolean;
    aceita_responsabilidade_informacoes: boolean;
  };
  onboardingAnswers: Record<string, unknown>;
  parqAnswers: Array<{ id: string; yes: boolean }>;
  parqSignatureDataUrl: string;
  parqFormVersion: string;
}): Promise<AuthApiUser> {
  const response = await authFetch(`${API_URL}/auth/student-compliance`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel salvar o compliance.");
  }

  return data.data.user as AuthApiUser;
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }): Promise<AuthApiUser> {
  const response = await authFetch(`${API_URL}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel alterar a senha.");
  }

  return data.data.user as AuthApiUser;
}

export interface AuthApiSuccess {
  user: AuthApiUser;
  accessToken: string;
  refreshToken?: string;
  requiresProfileCompletion?: boolean;
}

export async function loginWithPassword(email: string, password: string): Promise<AuthApiSuccess> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tenantSlug = extractTenantSlug();
  if (tenantSlug && typeof window !== "undefined") {
    headers["X-Tenant-Host"] = window.location.hostname;
  }
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel entrar.");
  }

  return data.data;
}

export async function registerWithPassword(payload: RegisterPayload): Promise<AuthApiSuccess> {
  const { captchaToken, ...rest } = payload;
  const body: Record<string, unknown> = { ...rest };
  if (captchaToken) {
    body.captchaToken = captchaToken;
  }

  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    const err = new Error(data?.error || "Nao foi possivel criar sua conta.") as Error & {
      status?: number;
      code?: string;
    };
    err.status = response.status;
    if (typeof data?.code === "string") err.code = data.code;
    throw err;
  }

  return data.data;
}

/** Cadastro público de personal trainer (Spec 026). A role é fixada pelo backend. */
export async function registerPersonalWithPassword(
  payload: RegisterPersonalPayload,
): Promise<AuthApiSuccess> {
  const { captchaToken, ...rest } = payload;
  const body: Record<string, unknown> = { ...rest };
  if (captchaToken) {
    body.captchaToken = captchaToken;
  }

  const response = await fetch(`${API_URL}/auth/register-personal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    const err = new Error(data?.error || "Nao foi possivel criar sua conta.") as Error & {
      status?: number;
      code?: string;
    };
    err.status = response.status;
    if (typeof data?.code === "string") err.code = data.code;
    throw err;
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

export async function fetchCurrentUser(): Promise<AuthApiUser | null> {
  const response = await authFetch(`${API_URL}/auth/me`);

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const data = await parseJson(response);
  return data?.data?.user || null;
}

export interface AcademyBranding {
  logoUrl?: string;
  displayName?: string;
  primaryColor?: string;
  primaryHover?: string;
  accentColor?: string;
  welcomeMessage?: string;
  theme?: string;
}

export interface AcademyForUser {
  id: number;
  slug: string;
  displayName: string;
  logoUrl?: string;
  roleSlug: string;
  roleLabel: string;
  status: string;
  branding?: AcademyBranding;
}

export async function fetchUserAcademies(): Promise<AcademyForUser[]> {
  const response = await authFetch(`${API_URL}/auth/academies`);
  if (!response.ok) return [];
  const data = await parseJson(response);
  return (data?.data?.academies ?? []) as AcademyForUser[];
}

export interface SwitchAcademyResult {
  accessToken: string;
  activeAcademy: AcademyForUser & { branding?: AcademyBranding };
}

export async function switchAcademy(academyId: number): Promise<SwitchAcademyResult> {
  const response = await authFetch(`${API_URL}/auth/switch-academy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ academyId }),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Erro ao trocar academia.");
  }
  return data.data as SwitchAcademyResult;
}
