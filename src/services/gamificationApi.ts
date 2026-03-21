import { API_URL } from "./apiBase";

function getToken() {
  return localStorage.getItem("minutofit_token");
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

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
  const token = getToken();
  if (!token) return null;

  const response = await fetch(`${API_URL}/gamification/checkins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel persistir a gamificacao.");
  }

  return data?.data || null;
}

export async function fetchGamificationSummary() {
  const token = getToken();
  if (!token) return null;

  const response = await fetch(`${API_URL}/gamification/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar o resumo de gamificacao.");
  }

  return data?.data || null;
}
