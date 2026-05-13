import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type ExerciseCatalogEntry = {
  id: string;
  name: string;
  group: string;
  source: "seed" | "video";
  videoUrl?: string | null;
};

export async function fetchExerciseCatalog(filters?: { q?: string; group?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.q) params.set("q", filters.q);
  if (filters?.group) params.set("group", filters.group);
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const response = await authFetch(`${API_URL}/personal/exercise-catalog${qs ? `?${qs}` : ""}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar o catalogo de exercicios.");
  }
  return (data?.data || []) as ExerciseCatalogEntry[];
}
