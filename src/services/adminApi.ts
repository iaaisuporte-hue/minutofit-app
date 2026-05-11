import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";

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

