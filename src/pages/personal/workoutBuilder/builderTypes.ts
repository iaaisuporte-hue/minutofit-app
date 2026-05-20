import { exerciseSummaryToCatalogEntry } from "../../../services/exercisesApi";

export type MuscleGroup =
  | "Perna"
  | "Peito"
  | "Costas"
  | "Ombro"
  | "Bíceps"
  | "Tríceps"
  | "Abdômen"
  | "Glúteo"
  | "Cardio"
  | "Outros";

export type Exercise = {
  id: string;
  name: string;
  group: MuscleGroup;
  videoUrl?: string;
  source: "seed" | "video" | "metacore";
  bodyPart?: string;
  equipment?: string;
  primaryMediaUrl?: string | null;
};

export type WorkoutExercise = {
  exerciseId: string;
  name: string;
  sets: string;
  reps: string;
  rest: string;
  rpe?: string;
  cadence?: string;
  restPause?: boolean;
  technique?: import("../../../features/training/techniques/technique.types").TechniqueConfig;
  notes?: string;
};

export type DayMeta = {
  index: number;
  name: string;
  focus: string | null;
};

export type WeekPreset = "semana_util" | "4" | "5" | "6";

export const KNOWN_GROUPS: MuscleGroup[] = [
  "Perna", "Peito", "Costas", "Ombro", "Bíceps", "Tríceps", "Abdômen", "Glúteo", "Cardio", "Outros",
];

export const CATALOG_GROUPS: MuscleGroup[] = [
  "Perna", "Peito", "Costas", "Ombro", "Bíceps", "Tríceps", "Abdômen", "Glúteo", "Cardio",
];

export function catalogEntryToExercise(e: ReturnType<typeof exerciseSummaryToCatalogEntry>): Exercise {
  const group = (KNOWN_GROUPS.includes(e.group as MuscleGroup) ? e.group : "Outros") as MuscleGroup;
  return {
    id: e.id,
    name: e.name,
    group,
    videoUrl: e.videoUrl ?? undefined,
    source: "metacore",
    bodyPart: e.bodyPart,
    equipment: e.equipment,
    primaryMediaUrl: e.primaryMediaUrl,
  };
}

export function coerceWeekPreset(raw: string): WeekPreset {
  const w = String(raw || "5");
  if (w === "semana_util" || w === "4" || w === "5" || w === "6") return w;
  return "5";
}

export function weekPresetToCount(preset: WeekPreset): number {
  return preset === "semana_util" ? 5 : Number(preset);
}

export function buildDefaultDayMeta(count: number): DayMeta[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i + 1,
    name: `Treino ${String.fromCharCode(65 + i)}`,
    focus: null,
  }));
}

export function buildEmptyDayItems(count: number): Record<number, WorkoutExercise[]> {
  const out: Record<number, WorkoutExercise[]> = {};
  for (let i = 0; i < count; i++) out[i] = [];
  return out;
}
