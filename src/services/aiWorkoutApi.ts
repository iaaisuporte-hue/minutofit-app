import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type AiGeneratedExercise = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  note?: string | null;
};

export type AiGeneratedDay = {
  name: string;
  focus: string;
  exercises: AiGeneratedExercise[];
};

export type AiGeneratedWeeklyPlan = {
  title: string;
  weekPreset: string;
  split: string;
  days: AiGeneratedDay[];
};

export async function generateWorkoutWithAi(
  prompt: string,
  catalogNames: string[]
): Promise<AiGeneratedWeeklyPlan> {
  const response = await authFetch(`${API_URL}/personal/ai/generate-workout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, catalogNames }),
  });

  if (response.status === 401) {
    throw new Error("Sessão expirada. Faça login novamente para usar a geração por IA.");
  }

  const data = await parseJson(response);

  if (response.status === 503) {
    throw new Error("Geração com IA não está configurada neste ambiente.");
  }
  if (response.status === 429) {
    throw new Error(data?.error || "Limite de chamadas de IA atingido. Aguarde alguns minutos.");
  }
  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível gerar a ficha.");
  }

  return data?.data as AiGeneratedWeeklyPlan;
}
