import { createWorkoutSession } from "../../../services/workoutSessionApi";
import type { PrEventSummary } from "../../../features/performance/PrCelebration";
import { addWorkoutHistoryEntry, type MuscleGroup } from "../workoutHistory";
import {
  deriveGroupsFromExercises,
  freeWorkoutTitle,
} from "../../../features/training/freeWorkout/muscleGroupMap";
import type { DraftExercise } from "./sessionDraft";

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
  /** Recordes desta sessão (Spec 033, P2) — o resumo pós-treino reconhece. */
  prEvents: PrEventSummary[];
  celebrate: boolean;
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

  return {
    streak: session.streak,
    title,
    prEvents: session.prEvents ?? [],
    celebrate: session.celebrate === true,
  };
}

export interface RegisterFreeSessionParams {
  /** Chave do rascunho — dá idempotência ao reenvio depois de uma falha. */
  clientKey: string;
  /** Lista executada, na ordem em que o aluno treinou. */
  exercises: DraftExercise[];
  /** Séries detalhadas (mesmo shape do fluxo prescrito). */
  sets?: unknown[];
  status: RegisterSessionStatus;
  sessionRpe?: number | null;
  notes?: string | null;
}

/**
 * Finalizador do treino livre.
 *
 * Separado do prescrito porque quase tudo que aquele recebe pronto — plano, dia,
 * foco, grupos musculares — aqui precisa ser DERIVADO do que o aluno montou: não
 * há ficha nenhuma do outro lado.
 *
 * O `prescribed` vai preenchido de propósito, e não vazio: é o snapshot do que
 * ele planejou para si, o que dá contexto ao personal e deixa "repetir este
 * treino" possível depois. O backend não conta sessão livre na aderência à
 * ficha, então o snapshot não distorce métrica de execução do plano.
 */
export async function registerFreeWorkoutSession(
  p: RegisterFreeSessionParams,
): Promise<RegisterSessionResult> {
  const title = freeWorkoutTitle(p.exercises);
  const muscleGroups = deriveGroupsFromExercises(p.exercises);

  // Mesmo cache local do fluxo prescrito — é o que os motores de recomendação
  // leem para não repetir grupo muscular no dia seguinte.
  addWorkoutHistoryEntry({
    workoutId: `free-${p.clientKey}`,
    title,
    muscleGroups,
    date: new Date().toISOString(),
  });

  const session = await createWorkoutSession({
    source: "free",
    status: p.status,
    title,
    planId: null,
    dayIndex: null,
    clientKey: p.clientKey,
    sessionRpe: p.sessionRpe ?? null,
    notes: p.notes ?? null,
    prescribed: p.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: String(ex.sets.length),
      reps: ex.sets[0]?.plannedReps ?? "",
      rest: `${ex.sets[0]?.plannedRestS ?? 0}s`,
    })),
    sets: p.sets && p.sets.length > 0 ? p.sets : undefined,
    awardGamification: true,
    muscleGroups,
  });

  // Diferente do prescrito, aqui o erro NÃO pode ser engolido: sem ficha para
  // reconstruir, um treino livre perdido é perdido de vez. Quem chama mantém o
  // rascunho e oferece nova tentativa — o clientKey garante que ela não duplica.
  if (!session) {
    throw new Error("Não foi possível registrar a sessão.");
  }

  return {
    streak: session.streak,
    title,
    prEvents: session.prEvents ?? [],
    celebrate: session.celebrate === true,
  };
}
