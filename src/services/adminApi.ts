import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";
import type { WorkoutProtocol } from "./workoutProtocolsApi";

export type AdminDashboardMetrics = {
  totalUsers: number;
  activeSubscriptions: number;
  mrr: number;
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
  app: "App MetaCore",
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

export async function deleteAdminUser(userId: string) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}`, {
    method: "DELETE",
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível excluir o usuário.");
  }
}


