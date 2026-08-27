// Converte uma sessão JÁ GRAVADA no material do card de compartilhamento.
//
// Existe porque o botão de compartilhar só vivia na tela de resumo, logo após
// salvar: quem saía dali nunca mais compartilhava aquele treino. Lendo de
// `GET /training/sessions/:id`, o card pode ser aberto depois — do gráfico do
// Hoje, por exemplo — com exatamente os mesmos dados.
//
// Puro de propósito: é ele que decide o que a arte afirma sobre o treino.

import {
  getWorkoutSessionDetail,
  listWorkoutSessionsPage,
  type WorkoutSessionDetail,
} from "../../../services/workoutSessionApi";
import { dayKey } from "../../../lib/appDay";
import type { WorkoutShareExercise, WorkoutShareStats } from "./shareWorkoutImage";

export type SessionShareData = {
  focus: string;
  dayName?: string;
  stats: WorkoutShareStats;
  exercises: WorkoutShareExercise[];
};

/**
 * O título é gravado como "Plano · Dia" ou "Treino livre · Costas e Ombros".
 * O último segmento é o que identifica o treino e vira o herói do card; o
 * primeiro vira a linha de contexto ao lado da data.
 */
function splitTitle(title: string | null): { focus: string; dayName?: string } {
  const clean = (title ?? "").trim();
  if (!clean) return { focus: "Treino" };
  const parts = clean.split("·").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { focus: clean };
  return { focus: parts[parts.length - 1], dayName: parts.slice(0, -1).join(" · ") };
}

/** Faixa de repetições realmente feitas ("12", "8-12"), com o previsto como rede. */
function repsRange(done: { repsDone: number | null; plannedReps: string | null }[]): string | null {
  const typed = done.map((s) => s.repsDone).filter((n): n is number => n != null && n > 0);
  if (typed.length) {
    const min = Math.min(...typed);
    const max = Math.max(...typed);
    return min === max ? String(min) : `${min}-${max}`;
  }
  return done.find((s) => s.plannedReps?.trim())?.plannedReps?.trim() ?? null;
}

export function buildShareFromSession(detail: WorkoutSessionDetail): SessionShareData {
  const { focus, dayName } = splitTitle(detail.title);

  // Agrupa por exercício preservando a ordem da execução.
  const byExercise = new Map<string, { order: number; sets: typeof detail.sets }>();
  for (const set of detail.sets) {
    const key = set.exerciseName;
    const entry = byExercise.get(key);
    if (entry) {
      entry.sets.push(set);
      entry.order = Math.min(entry.order, set.orderIndex);
    } else {
      byExercise.set(key, { order: set.orderIndex, sets: [set] });
    }
  }

  // Só o EXECUTADO entra na arte: exercício pulado por inteiro não aparece.
  const exercises: WorkoutShareExercise[] = [];
  for (const [name, entry] of [...byExercise.entries()].sort((a, b) => a[1].order - b[1].order)) {
    const done = entry.sets.filter((s) => s.status === "done");
    if (done.length) exercises.push({ name, sets: done.length, reps: repsRange(done) });
  }

  const doneSets = detail.sets.filter((s) => s.status === "done");
  let volumeKg = 0;
  for (const s of doneSets) {
    const reps = s.repsDone ?? Number.parseInt(s.plannedReps ?? "", 10);
    if (s.loadDoneKg && Number.isFinite(reps) && reps > 0) volumeKg += s.loadDoneKg * reps;
  }

  // Sessão retroativa não tem cronômetro: `ended_at` empata com o início e a
  // duração sai 0. Vale `null` — a linha de stats omite, em vez de "0 min".
  const startMs = Date.parse(detail.startedAt);
  const endMs = detail.endedAt ? Date.parse(detail.endedAt) : NaN;
  const durationMin =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? Math.round((endMs - startMs) / 60000)
      : null;

  return {
    focus,
    dayName,
    stats: {
      durationMin: durationMin && durationMin > 0 ? durationMin : null,
      doneSets: doneSets.length,
      totalSets: detail.sets.length,
      completionPct: detail.sets.length ? Math.round((doneSets.length / detail.sets.length) * 100) : null,
      volumeKg: volumeKg > 0 ? Math.round(volumeKg) : null,
    },
    exercises,
  };
}

/**
 * O treino DE HOJE como material do card, lido do servidor.
 *
 * Fonte única para todo botão de compartilhar que não seja o resumo ao vivo:
 * a arte tem que mostrar o que foi treinado de verdade. Antes a ficha
 * compartilhava os itens PRESCRITOS do dia — quem fez treino livre, ou fez
 * metade da ficha, publicava uma peça que não correspondia ao que executou.
 *
 * Devolve `null` quando não há sessão do dia (o marcador do gráfico nasce de
 * cache local e pode não ter par no servidor), para o chamador avisar em vez
 * de abrir um card vazio.
 */
export async function loadTodayShareData(): Promise<SessionShareData | null> {
  const today = dayKey();
  const { sessions } = await listWorkoutSessionsPage(20);
  // A lista vem da mais recente para a mais antiga: com dois treinos no mesmo
  // dia, compartilha o último — que é o que a pessoa acabou de fazer.
  const mine = sessions.find(
    (s) => dayKey(new Date(s.performedAt)) === today && s.status !== "started",
  );
  if (!mine) return null;
  const detail = await getWorkoutSessionDetail(mine.id);
  return detail ? buildShareFromSession(detail) : null;
}
