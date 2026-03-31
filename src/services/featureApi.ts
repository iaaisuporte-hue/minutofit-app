import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type FeatureItem = {
  id: number;
  key: string;
  name: string;
  description?: string;
};

export type PlanItem = {
  id: number;
  name: string;
  description?: string;
};

export async function getMyFeatures() {
  const response = await authFetch(`${API_URL}/me/features`);
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel carregar as features do usuario.");
  }
  return payload.data as { plan: PlanItem | null; features: Record<string, boolean> };
}

export async function getPlans() {
  const response = await authFetch(`${API_URL}/plans`);
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel carregar planos.");
  }
  return (payload.data?.plans || []) as PlanItem[];
}

export async function getFeatures() {
  const response = await authFetch(`${API_URL}/features`);
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel carregar features.");
  }
  return (payload.data?.features || []) as FeatureItem[];
}

export async function getPlanFeatures(planId: number) {
  const response = await authFetch(`${API_URL}/plans/${planId}/features`);
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel carregar matriz de features.");
  }
  return payload.data as {
    plan: PlanItem;
    features: Array<FeatureItem & { enabled: boolean }>;
  };
}

export async function updatePlanFeatures(
  planId: number,
  updates: Array<{ key: string; enabled: boolean }>
) {
  const response = await authFetch(`${API_URL}/plans/${planId}/features`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features: updates }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel salvar permissoes do plano.");
  }
  return payload.data as { planId: number; updated: number };
}

