import { generateWorkoutWithAi, type AiGeneratedExercise, type AiGeneratedWeeklyPlan } from "../../../services/aiWorkoutApi";
import { searchExercises } from "../../../services/exercisesApi";
import { buildDefaultDayMeta, coerceWeekPreset, type DayMeta, type Exercise, type WeekPreset, type WorkoutExercise } from "./builderTypes";

export type { AiGeneratedWeeklyPlan };

export async function resolveAiExercises(
  allExercises: Exercise[],
  generated: AiGeneratedExercise[]
): Promise<{ resolved: WorkoutExercise[]; unresolved: string[] }> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  type Pending = { g: AiGeneratedExercise; match: Exercise | null };

  const pass1: Pending[] = generated.map((g) => {
    const byId = (g as { exercise_id?: string }).exercise_id;
    if (byId && UUID_RE.test(byId)) {
      const m = allExercises.find((c) => c.id === byId);
      if (m) return { g, match: m };
    }
    const nameLower = g.name.toLowerCase();
    const m =
      allExercises.find((c) => c.name.toLowerCase() === nameLower) ??
      allExercises.find((c) => c.name.toLowerCase().includes(nameLower.split(" ")[0]));
    return { g, match: m ?? null };
  });

  const needsApi = pass1.filter((p) => !p.match);
  if (needsApi.length > 0) {
    const apiResults = await Promise.all(
      needsApi.slice(0, 10).map(async (p) => {
        try {
          const rows = await searchExercises({ q: p.g.name, limit: 1 });
          return { g: p.g, match: rows[0] ? ({ id: rows[0].id, name: rows[0].name } as Exercise) : null };
        } catch {
          return { g: p.g, match: null };
        }
      })
    );
    for (const r of apiResults) {
      const entry = pass1.find((p) => p.g === r.g);
      if (entry) entry.match = r.match;
    }
  }

  const resolved: WorkoutExercise[] = [];
  const unresolved: string[] = [];

  for (const { g, match } of pass1) {
    if (match) {
      resolved.push({
        exerciseId: match.id,
        name: match.name,
        sets: g.sets,
        reps: g.reps,
        rest: g.rest,
        technique: g.technique ?? undefined,
        notes: g.note ?? undefined,
      });
    } else {
      unresolved.push(g.name);
    }
  }

  return { resolved, unresolved };
}

export async function runAiWorkoutGeneration(
  prompt: string,
  allExercises: Exercise[]
): Promise<{
  plan: AiGeneratedWeeklyPlan;
  weekPreset: WeekPreset;
  daysItems: Record<number, WorkoutExercise[]>;
  daysMeta: DayMeta[];
  unresolved: string[];
}> {
  const catalogNames = allExercises.map((e) => e.name);
  const result = await generateWorkoutWithAi(prompt, catalogNames);

  const allUnresolved: string[] = [];
  const daysItems: Record<number, WorkoutExercise[]> = {};
  const daysMeta: DayMeta[] = [];

  for (let i = 0; i < result.days.length; i++) {
    const day = result.days[i];
    const { resolved, unresolved } = await resolveAiExercises(allExercises, day.exercises);
    daysItems[i] = resolved;
    daysMeta.push({ index: i + 1, name: day.name, focus: day.focus });
    allUnresolved.push(...unresolved);
  }

  if (daysMeta.length === 0) {
    const fallbackCount = 5;
    for (let i = 0; i < fallbackCount; i++) daysItems[i] = [];
    daysMeta.push(...buildDefaultDayMeta(fallbackCount));
  }

  return {
    plan: result,
    weekPreset: result.weekPreset ? coerceWeekPreset(result.weekPreset) : "5",
    daysItems,
    daysMeta,
    unresolved: allUnresolved,
  };
}
