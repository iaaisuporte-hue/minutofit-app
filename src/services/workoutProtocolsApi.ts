import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import type { WorkoutPlanItem } from "./personalWorkoutApi";

export type ProtocolScope = "personal" | "academy" | "platform";

export type WorkoutProtocol = {
  id: number;
  scope: ProtocolScope;
  academyId: number | null;
  ownerPersonalId: number | null;
  title: string;
  description: string | null;
  tags: Record<string, unknown>;
  weekPreset: string;
  selectedGroup: string | null;
  items: WorkoutPlanItem[];
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
};

export type ProtocolSuggestion = {
  protocolId: number;
  title: string;
  scope: ProtocolScope;
  reason: string;
  score: number;
};

export async function fetchWorkoutProtocols(filters?: {
  q?: string;
  scope?: ProtocolScope | "all";
  tagGoal?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.q) params.set("q", filters.q);
  if (filters?.scope) params.set("scope", filters.scope);
  if (filters?.tagGoal) params.set("tagGoal", filters.tagGoal);
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const response = await authFetch(`${API_URL}/personal/protocols${qs ? `?${qs}` : ""}`);
  const data = await parseJson(response);
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar os protocolos.");
  }
  return (data?.data || []) as WorkoutProtocol[];
}

export async function fetchWorkoutProtocolById(protocolId: number) {
  const response = await authFetch(`${API_URL}/personal/protocols/${protocolId}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Protocolo nao encontrado.");
  }
  return data?.data as WorkoutProtocol;
}

export async function setProtocolFavorite(protocolId: number, favorite: boolean) {
  const response = await authFetch(`${API_URL}/personal/protocols/${protocolId}/favorite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favorite }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel atualizar favorito.");
  }
  return data;
}

export async function fetchProtocolSuggestions(studentId: string) {
  const response = await authFetch(`${API_URL}/personal/students/${studentId}/protocol-suggestions`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar sugestoes.");
  }
  return (data?.data || []) as ProtocolSuggestion[];
}

export async function createWorkoutProtocol(input: {
  title: string;
  description?: string;
  weekPreset: string;
  selectedGroup: string | null;
  items: WorkoutPlanItem[];
}) {
  const response = await authFetch(`${API_URL}/personal/protocols`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "personal", ...input }),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Nao foi possivel salvar o template.");
  return data?.data as WorkoutProtocol;
}
