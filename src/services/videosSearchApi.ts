import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type VideoSearchRow = {
  id: number;
  title: string;
  description?: string;
  url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  tags?: string[];
};

export async function fetchVideosSearch(options: { limit?: number; q?: string }) {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(Math.max(options.limit ?? 40, 1), 50)));
  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  const response = await authFetch(`${API_URL}/videos/search?${params.toString()}`);
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar a biblioteca de videos.");
  }
  return (data?.data || []) as VideoSearchRow[];
}
