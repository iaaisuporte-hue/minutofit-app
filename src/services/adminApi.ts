import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";
import type { WorkoutProtocol } from "./workoutProtocolsApi";

export type AdminDashboardMetrics = {
  totalUsers: number;
  activeSubscriptions: number;
  /** Receita recorrente real da V1: SaaS do personal + SaaS da academia. */
  mrr: number;
  /** Composição do MRR. `legacyB2c` fica FORA de `mrr` — funil B2C desativado. */
  mrrBreakdown?: { personal: number; academy: number; legacyB2c: number };
  totalRevenue: number;
  tierBreakdown: Array<{ name: string; count: string | number }>;
};

export async function fetchAdminDashboardMetrics() {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/admin/dashboard/metrics`);
  if (response.status === 401) return null;

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar metricas do dashboard admin.");
  }

  return (data?.data?.metrics || null) as AdminDashboardMetrics | null;
}

export type AdminUserRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  profile_completed: boolean;
  created_at: string;
  subscription_tier: string | null;
};

export type AdminUsersResponse = {
  users: AdminUserRow[];
  pagination: { total: number; limit: number; offset: number };
};

export async function fetchAdminUsers(params: {
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  if (!getAccessToken()) return null;

  const searchParams = new URLSearchParams();
  if (params.role) searchParams.set("role", params.role);
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  searchParams.set("limit", String(params.limit ?? 20));
  searchParams.set("offset", String(params.offset ?? 0));

  const response = await authFetch(`${API_URL}/admin/users?${searchParams.toString()}`);
  if (response.status === 401) return null;

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar a lista de usuarios.");
  }

  return (data?.data || null) as AdminUsersResponse | null;
}

export async function fetchAdminUserById(id: string | number) {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/admin/users/${id}`);
  if (response.status === 401) return null;

  const data = await parseJson(response);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar o usuario.");
  }

  return (data?.data?.user || null) as AdminUserRow | null;
}

export type AdminSubscriptionsReport = {
  activeByTier: Array<{ name: string; count: string | number; monthly_revenue: string | number }>;
  recentSubscriptions: Array<{ email: string; name: string | null; tier: string; status: string; active_from: string; active_to: string | null }>;
  churnLastMonth: string | number;
};

export async function fetchAdminSubscriptionsReport() {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/admin/subscriptions/report`);
  if (response.status === 401) return null;

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar relatorio de assinaturas.");
  }

  return (data?.data || null) as AdminSubscriptionsReport | null;
}

export type AdminPlatformHealth = {
  metabolismDistribution: { low: number; moderate: number; high: number; unknown: number };
  averageScore: number | null;
  adherenceAvg7d: number | null;
  activeUsers7d: number;
  usersWithoutCheckin7d: number;
  personalsWithFatigueClusters: number;
};

export async function fetchAdminPlatformHealth() {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/admin/dashboard/platform-health`);
  if (response.status === 401) return null;
  if (response.status === 404) return null;

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar saude da plataforma.");
  }

  return (data?.data || null) as AdminPlatformHealth | null;
}

export async function createAdminProfessional(params: {
  name: string;
  email: string;
  role: "personal" | "nutri";
  phone?: string;
  cpf?: string;
  registry?: string;
  specialty?: string;
  bio?: string;
}) {
  const response = await authFetch(`${API_URL}/admin/professionals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel cadastrar o profissional.");
  }

  return data?.data as { id: number; name: string; email: string; role: string; tempPassword: string };
}

export async function changeUserSubscription(userId: string | number, tierId: number) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tierId }),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel alterar o plano.");
  }

  return data?.data as { subscriptionId: number };
}

export async function setUserPassword(userId: string | number, password: string): Promise<void> {
  if (!getAccessToken()) throw new Error("Sessao expirada.");
  const response = await authFetch(`${API_URL}/admin/users/${userId}/set-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel definir a senha.");
  }
}

export const PRODUCT_KEYS = ['app', 'personal', 'nutri', 'academia', 'metabolismo'] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  app: "App S2Core",
  personal: 'Personal',
  nutri: 'Nutricionista',
  academia: 'Academia',
  metabolismo: 'Metabolismo',
};

export interface UserProductEntry {
  key: ProductKey;
  active: boolean;
}

export async function fetchUserProducts(userId: string | number): Promise<{
  activeKeys: ProductKey[];
  allProducts: UserProductEntry[];
}> {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/products`);
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar produtos.");
  return data?.data as { activeKeys: ProductKey[]; allProducts: UserProductEntry[] };
}

export async function grantUserProduct(
  userId: string | number,
  productKey: ProductKey,
  options?: { expiresAt?: string; notes?: string }
) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/products/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productKey, ...options }),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Nao foi possivel conceder produto.");
}

export async function revokeUserProduct(userId: string | number, productKey: ProductKey) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/products/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productKey }),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Nao foi possivel revogar produto.");
}

export async function fetchAdminPlatformProtocols(limit = 100) {
  const response = await authFetch(`${API_URL}/admin/workout-protocols/platform?limit=${limit}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar protocolos da plataforma.");
  }
  return (data?.data || []) as WorkoutProtocol[];
}

export async function createAdminPlatformProtocol(body: {
  title: string;
  description?: string | null;
  weekPreset?: string;
  selectedGroup?: string | null;
  items: unknown[];
}) {
  const response = await authFetch(`${API_URL}/admin/workout-protocols/platform`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel criar o protocolo.");
  }
  return data?.data as WorkoutProtocol;
}

export async function deleteAdminPlatformProtocol(protocolId: number) {
  const response = await authFetch(`${API_URL}/admin/workout-protocols/platform/${protocolId}`, {
    method: "DELETE",
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel excluir o protocolo.");
  }
}

export async function updateAdminPlatformProtocol(
  protocolId: number,
  body: Partial<{
    title: string;
    description: string | null;
    weekPreset: string;
    selectedGroup: string | null;
    items: unknown[];
  }>
) {
  const response = await authFetch(`${API_URL}/admin/workout-protocols/platform/${protocolId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel atualizar o protocolo.");
  }
  return data?.data as WorkoutProtocol;
}

export interface AdminLoopMetrics {
  windowDays: number;
  checkinD7: {
    cohort_size: number;
    retained: number;
    d7_retention_pct: number | null;
  };
  adaptationRate: {
    total_logs: number;
    with_changes: number;
    pct_adapted: number | null;
  };
  readinessDistribution: Array<{ readiness_level: string; count: number }>;
  bannerEngagement: {
    adapted_with_changes: number;
    banner_views: number;
    pct_banner_viewed: number | null;
  };
  dailyCheckinUsers: Array<{ day: string; users: number }>;
}

// Métricas de produto NÃO podem falhar em silêncio: se a query quebrar, o
// dashboard precisa dizer isso em vez de mostrar um painel vazio indistinguível
// de "ainda não há dados".
export async function fetchAdminLoopMetrics(days = 30): Promise<AdminLoopMetrics | null> {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/dashboard/loop-metrics?days=${days}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar metricas do loop.");
  }
  return data?.data as AdminLoopMetrics ?? null;
}

export interface AdminPmfMetrics {
  h1_personal_billing: {
    paying_active: number;
    trial_active: number;
    pending_checkout: number;
    lapsed: number;
    personals_with_row: number;
    mrr_cents: number;
  };
  h2_adaptive_adherence: {
    adapted_n: number;
    adapted_checkin_pct: number | null;
    control_n: number;
    control_checkin_pct: number | null;
  };
  h3_platform_counts: {
    app_memberships_active: number;
    personals_paying: number;
    academies_active: number;
  };
  h4_checkin_sustainability: {
    cohort_size: number;
    high_compliance: number;
    mid_compliance: number;
    low_compliance: number;
    pct_high: number | null;
  };
}

/** Spec 028 — telemetria de uso: DAU/MAU, retenção D30 e funil de ativação. */
export interface AdminPilotMetrics {
  dau: number;
  wau: number;
  mau: number;
  dauMauRatio: number | null;
  retention: { personalD30: number | null; studentD30: number | null };
  activationFunnel: Array<{ step: string; label: string; count: number }>;
}

export async function fetchAdminPilotMetrics(): Promise<AdminPilotMetrics | null> {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/dashboard/pilot-metrics`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar metricas do piloto.");
  }
  return data?.data as AdminPilotMetrics ?? null;
}

export async function fetchAdminPmfMetrics(): Promise<AdminPmfMetrics | null> {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/dashboard/pmf-metrics`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar metricas de PMF.");
  }
  return data?.data as AdminPmfMetrics ?? null;
}

export async function deleteAdminUser(userId: string) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}`, {
    method: "DELETE",
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível excluir o usuário.");
  }
}

// ---------------------------------------------------------------------------
// P0-8: Busca avançada (CPF, plano, subscriptionStatus)
// ---------------------------------------------------------------------------
export async function fetchAdminUsersAdvanced(params: {
  role?: string;
  search?: string;
  cpf?: string;
  plan?: string;
  subscriptionStatus?: string;
  limit?: number;
  offset?: number;
}) {
  if (!getAccessToken()) return null;
  const q = new URLSearchParams();
  if (params.role) q.set("role", params.role);
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.cpf?.trim()) q.set("cpf", params.cpf.trim());
  if (params.plan?.trim()) q.set("plan", params.plan.trim());
  if (params.subscriptionStatus) q.set("subscriptionStatus", params.subscriptionStatus);
  q.set("limit", String(params.limit ?? 20));
  q.set("offset", String(params.offset ?? 0));
  const response = await authFetch(`${API_URL}/admin/users?${q.toString()}`);
  if (response.status === 401) return null;
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível carregar usuários.");
  return data?.data as AdminUsersResponse | null;
}

// ---------------------------------------------------------------------------
// P0-2: Audit log viewer
// ---------------------------------------------------------------------------
export interface AdminAuditEntry {
  id: number;
  academy_id: number | null;
  user_id: number | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchAdminAuditLog(params?: {
  subjectUserId?: number;
  actorId?: number;
  action?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: AdminAuditEntry[]; pagination: { total: number; limit: number; offset: number } } | null> {
  if (!getAccessToken()) return null;
  const q = new URLSearchParams();
  if (params?.subjectUserId) q.set("subjectUserId", String(params.subjectUserId));
  if (params?.actorId) q.set("actorId", String(params.actorId));
  if (params?.action) q.set("action", params.action);
  q.set("limit", String(params?.limit ?? 50));
  q.set("offset", String(params?.offset ?? 0));
  const response = await authFetch(`${API_URL}/admin/audit?${q.toString()}`);
  if (!response.ok) return null;
  const data = await parseJson(response);
  return data?.data ?? null;
}

export async function fetchAdminUserAuditTrail(userId: number) {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/users/${userId}/audit-trail`);
  if (!response.ok) return null;
  const data = await parseJson(response);
  return (data?.data ?? []) as Array<{
    id: string;
    actorId: number;
    eventType: string;
    eventPayload: Record<string, unknown>;
    createdAt: string;
  }>;
}

// ---------------------------------------------------------------------------
// P0-5: Falhas de pagamento
// ---------------------------------------------------------------------------
export interface BillingFailureEntry {
  id: number;
  personal_id?: number;
  personal_name?: string;
  personal_email?: string;
  event_type?: string;
  payload_json?: Record<string, unknown>;
  occurred_at?: string;
}

export interface PaymentFailureEntry {
  id: number;
  user_id: number;
  user_name: string | null;
  user_email: string;
  amount_brl: number;
  status: string;
  provider_ref: string | null;
  created_at: string;
}

export async function fetchAdminBillingFailures(): Promise<{
  billingFailures: BillingFailureEntry[];
  paymentFailures: PaymentFailureEntry[];
} | null> {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/billing/failures`);
  if (!response.ok) return null;
  const data = await parseJson(response);
  return data?.data ?? null;
}

// ---------------------------------------------------------------------------
// P0-6: Vínculos personal/nutri/academia
// ---------------------------------------------------------------------------
export interface PersonalAssignment {
  id: number;
  personal_id: number;
  personal_name: string | null;
  personal_email: string;
  status: string;
  created_at: string;
  academy_id: number | null;
}

export interface NutriAssignment {
  id: number;
  nutri_id: number;
  nutri_name: string | null;
  nutri_email: string;
  status: string;
  created_at: string;
}

export interface AcademyMembership {
  academy_id: number;
  academy_name: string;
  slug: string;
  is_active: boolean;
  joined_at: string;
}

export async function fetchAdminUserRelationships(userId: number): Promise<{
  personals: PersonalAssignment[];
  nutris: NutriAssignment[];
  academies: AcademyMembership[];
} | null> {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/users/${userId}/relationships`);
  if (!response.ok) return null;
  const data = await parseJson(response);
  return data?.data ?? null;
}

export async function revokePersonalAssignment(userId: number, assignmentId: number) {
  const response = await authFetch(
    `${API_URL}/admin/users/${userId}/relationships/personal/${assignmentId}`,
    { method: "DELETE" }
  );
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível revogar o vínculo.");
}

// ---------------------------------------------------------------------------
// P0-4: Estado da Rede de Profissionais (credenciamento + visibilidade)
// ---------------------------------------------------------------------------
export interface NetworkProfessionalRow {
  professional_id: number;
  name: string | null;
  email: string;
  role: string;
  professional_code: string | null;
  /** false = nunca criou o perfil em /app/personal/meu-perfil (admin não pode criar por ele) */
  has_profile: boolean;
  /** true = passa nos 4 predicados da busca do aluno; é o único status que importa */
  discoverable: boolean;
  credential_code: string | null;
  credential_status: string | null;
  publication_status: string | null;
  admin_enabled: boolean | null;
  availability_status: string | null;
  review_notes: string | null;
  updated_at: string | null;
  active_students: number;
}

export async function fetchNetworkProfessionals(): Promise<NetworkProfessionalRow[] | null> {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/professionals/network-status`);
  if (!response.ok) return null;
  const data = await parseJson(response);
  return data?.data ?? null;
}

// P0-1: Gestão de sub-roles admin
export async function fetchAdminSubRoles(): Promise<Array<{
  id: number;
  name: string | null;
  email: string;
  admin_sub_role: string;
  created_at: string;
}> | null> {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/admin-roles`);
  if (!response.ok) return null;
  const data = await parseJson(response);
  return data?.data ?? null;
}

export async function fetchProfessionalStudents(professionalId: number): Promise<{
  assignedStudents: Array<{
    id: number; student_id: number; student_name: string | null;
    student_email: string; status: string; created_at: string; academy_id: number | null;
  }>;
  assignedPatients: Array<{
    id: number; student_id: number; student_name: string | null;
    student_email: string; status: string; created_at: string;
  }>;
} | null> {
  if (!getAccessToken()) return null;
  const response = await authFetch(`${API_URL}/admin/professionals/${professionalId}/students`);
  if (!response.ok) return null;
  const data = await parseJson(response);
  return data?.data ?? null;
}

export async function updateAdminSubRole(userId: number, subRole: "super_admin" | "support") {
  const response = await authFetch(`${API_URL}/admin/admin-roles/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subRole }),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível atualizar o sub-role.");
  return data?.data;
}


