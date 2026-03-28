import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";

export async function persistGamificationCheckin(payload: {
  source: "workout" | "activity";
  xp: number;
  workout?: {
    workoutId: string;
    title: string;
    muscleGroups: string[];
  };
  activity?: {
    type: "walk" | "run" | "cycling";
    durationSeconds: number;
    distanceKm: number;
    pace: number;
  };
}) {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/gamification/checkins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel persistir a gamificacao.");
  }

  return data?.data || null;
}

export async function fetchGamificationSummary() {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/gamification/summary`);

  if (response.status === 401) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar o resumo de gamificacao.");
  }

  return data?.data || null;
}
