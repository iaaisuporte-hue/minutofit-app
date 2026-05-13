import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type AiGeneratedExercise = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
};

export type AiGeneratedWorkout = {
  title: string;
  weekPreset: string;
  exercises: AiGeneratedExercise[];
};

export async function generateWorkoutWithAi(
  prompt: string,
  catalogNames: string[]
): Promise<AiGeneratedWorkout> {
  const response = await authFetch(`${API_URL}/personal/ai/generate-workout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, catalogNames }),
  });
  const data = await parseJson(response);
  if (response.status === 503) {
    throw new Error("Geração com IA não está configurada neste ambiente.");
  }
  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível gerar a ficha.");
  }
  return data?.data as AiGeneratedWorkout;
}
