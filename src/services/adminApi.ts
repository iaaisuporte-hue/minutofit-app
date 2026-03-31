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

