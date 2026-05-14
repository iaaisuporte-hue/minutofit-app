/**
 * API client para a biblioteca global de exercícios MetaCore.
 * Substitui/complementa o exerciseCatalogApi (legado).
 */

import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type ExerciseMedia = {
  id: string;
  exerciseId: string;
  mediaType: "gif" | "image" | "video" | "youtube";
  url: string;
  source: string | null;
  isPrimary: boolean;
};

export type ExerciseSummary = {
  id: string;
  externalId: string | null;
  source: string;
  name: string;
  normalizedName: string;
  bodyPart: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  tags: string[];
  primaryMediaUrl: string | null;
  primaryMediaType: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Exercise = Omit<ExerciseSummary, "primaryMediaUrl" | "primaryMediaType"> & {
  instructions: string[];
  tips: string[];
  media: ExerciseMedia[];
};

export type ExerciseSearchParams = {
  q?: string;
  bodyPart?: string;
  equipment?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
};

export async function searchExercises(filters: ExerciseSearchParams = {}): Promise<ExerciseSummary[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.bodyPart) params.set("bodyPart", filters.bodyPart);
  if (filters.equipment) params.set("equipment", filters.equipment);
  if (filters.tags?.length) params.set("tags", filters.tags.join(","));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));

  const qs = params.toString();
  const response = await authFetch(`${API_URL}/exercises${qs ? `?${qs}` : ""}`);
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Erro ao buscar exercícios.");
  return (data?.exercises || []) as ExerciseSummary[];
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const response = await authFetch(`${API_URL}/exercises/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Erro ao buscar exercício.");
  return (data?.exercise ?? null) as Exercise | null;
}

export async function getExercisesBatch(ids: string[]): Promise<Exercise[]> {
  if (!ids.length) return [];
  const response = await authFetch(
    `${API_URL}/exercises/batch?ids=${ids.map(encodeURIComponent).join(",")}`
  );
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Erro ao buscar exercícios em batch.");
  return (data?.exercises || []) as Exercise[];
}

/** Converte ExerciseSummary para o formato legado ExerciseCatalogEntry (compatibilidade) */
export function exerciseSummaryToCatalogEntry(e: ExerciseSummary) {
  return {
    id: e.id,
    name: e.name,
    group: bodyPartToGroup(e.bodyPart),
    source: "seed" as const,
    videoUrl: e.primaryMediaType === "youtube" ? e.primaryMediaUrl : null,
    bodyPart: e.bodyPart,
    equipment: e.equipment,
    primaryMediaUrl: e.primaryMediaUrl,
    primaryMediaType: e.primaryMediaType,
  };
}

function bodyPartToGroup(bodyPart: string): string {
  const map: Record<string, string> = {
    peito: "Peito",
    costas: "Costas",
    perna: "Perna",
    glúteo: "Glúteo",
    gluteo: "Glúteo",
    ombro: "Ombro",
    bíceps: "Bíceps",
    biceps: "Bíceps",
    tríceps: "Tríceps",
    triceps: "Tríceps",
    abdômen: "Abdômen",
    abdomen: "Abdômen",
    cardio: "Cardio",
  };
  return map[bodyPart.toLowerCase()] ?? "Outros";
}
