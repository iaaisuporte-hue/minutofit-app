import { createWorkoutSession } from "../../../services/workoutSessionApi";
import { addWorkoutHistoryEntry, type MuscleGroup } from "../workoutHistory";

// Finalizador ÚNICO de uma sessão de treino. Reusado pela ficha (folha pós-treino)
// e pelo Modo Treino ao vivo. Desde o P0-1 da auditoria é UMA só chamada ao
// servidor (POST /training/sessions com awardGamification): execução rica
// (workout_sessions + set logs), log raso (user_workout_logs) e XP/streak são
// gravados na MESMA transação — sem a antiga 2ª chamada a /gamification/checkins,
// que podia divergir/perder registro. Lança se o servidor não confirmar.

const MUSCLE_KEYWORD_MAP: Array<[RegExp, MuscleGroup]> = [
  [/peito|chest|peitoral/i, "chest"],
  [/cost[as]|back|dorsal|lat[s]?/i, "back"],
  [/perna|leg[s]?|glúteo|glute/i, "legs"],
  [/ombro|shoulder/i, "shoulders"],
  [/bra[çc]o|arm[s]?|bícep|bicep|trícep|tricep/i, "arms"],
  [/core|abdômen|abdom|abs/i, "core"],
  [/corpo inteiro|full.?body|geral|total/i, "full_body"],
  [/cardio|aeró|aerob/i, "cardio"],
  [/mobilidade|flexib|stretching/i, "mobility"],
];

export function deriveMuscleGroupsFromFocus(
  focus: string | null,
  selectedGroup: string | null,
): MuscleGroup[] {
  const text = focus ?? selectedGroup ?? "";
  if (!text) return ["full_body"];
  const found: MuscleGroup[] = [];
  for (const [pattern, group] of MUSCLE_KEYWORD_MAP) {
    if (pattern.test(text) && !found.includes(group)) found.push(group);
  }
  return found.length > 0 ? found : ["full_body"];
}

export type RegisterSessionStatus = "completed" | "partial" | "abandoned";

export interface PrescribedSnapshotItem {
  exerciseId?: string | null;
  name: string;
  sets: string;
  reps: string;
  rest: string;
}

export interface RegisterSessionParams {
  planId: number;
  planTitle: string;
  selectedGroup: string | null;
  dayIndex: number | null;
  dayName: string;
  dayFocus: string | null;
  /** Itens (já adaptados) usados como snapshot do prescrito. */
  prescribed: PrescribedSnapshotItem[];
  /** Séries detalhadas (carga/reps reais) — opcional. */
  sets?: unknown[];
  status: RegisterSessionStatus;
  sessionRpe?: number | null;
  notes?: string | null;
}

export interface RegisterSessionResult {
  streak: number | null;
  title: string;
}

export async function registerWorkoutSession(
  p: RegisterSessionParams,
): Promise<RegisterSessionResult> {
  const title = `${p.planTitle} · ${p.dayName}`;
  const workoutId = `plan-${p.planId}-day-${p.dayIndex ?? 0}-${Date.now()}`;
  const muscleGroups = deriveMuscleGroupsFromFocus(p.dayFocus, p.selectedGroup);

  // Cache local do histórico (heurística dos motores de recomendação). Migra
  // para leitura de backend no P1 — por ora permanece como cache.
  addWorkoutHistoryEntry({
    workoutId,
    title,
    muscleGroups,
    date: new Date().toISOString(),
  });

  // Chamada ÚNICA: execução rica + log raso + XP/streak na mesma transação.
  const session = await createWorkoutSession({
    source: "personal",
    status: p.status,
    title,
    planId: p.planId,
    dayIndex: p.dayIndex,
    sessionRpe: p.sessionRpe ?? null,
    notes: p.notes ?? null,
    prescribed: p.prescribed.map((it) => ({
      exerciseId: it.exerciseId ?? null,
      name: it.name,
      sets: it.sets,
      reps: it.reps,
      rest: it.rest,
    })),
    sets: p.sets && p.sets.length > 0 ? p.sets : undefined,
    awardGamification: true,
    muscleGroups,
  });

  // null = falha (rede/HTTP/sem token). O registro é o dado essencial: lança
  // para que a UI de erro apareça (ficha) ou seja engolida onde já é
  // best-effort (Modo Treino ao vivo — confirmFinish já faz try/catch).
  if (!session) {
    throw new Error("Não foi possível registrar a sessão.");
  }

  return { streak: session.streak, title };
}
