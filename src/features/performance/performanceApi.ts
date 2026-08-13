import * as Sentry from "@sentry/react";
import { API_URL, parseJson } from "../../services/apiBase";
import { authFetch } from "../../services/apiClient";
import { getAccessToken } from "../../services/authTokens";

// Módulo Performance (Spec 033). Segue o padrão dos demais *Api.ts: devolve
// null/[] em falha e reporta ao Sentry — a Evolução nunca quebra por causa de
// uma seção que não carregou.

export type ActiveDaySource = "session" | "log" | "personal";

export interface ActiveDay {
  /** 'YYYY-MM-DD' no fuso do aluno. */
  date: string;
  active: boolean;
  sources: ActiveDaySource[];
  setsDone: number | null;
  tonnageKg: number | null;
}

export interface ConsistencySummary {
  /** null = sem ficha e sem meta, portanto sem denominador. Nunca 0. */
  pct: number | null;
  activeDays28: number;
  targetPerWeek: number | null;
  /**
   * `plan` = ficha do personal; `goal` = meta declarada pelo próprio aluno.
   * A tela usa isto para não dizer "sua ficha prescreve" a quem não tem ficha.
   */
  targetSource?: "plan" | "goal" | null;
}

/**
 * Progress Score. A FORMA é a que a spec fixou; os VALORES chegam na P3.
 * Declarado agora para que a P3 seja aditiva — tipar como o literal `null`
 * faria todo `if (score)` compilar contra um `never`.
 */
export interface ScoreFactor {
  id: string;
  label: string;
  delta: number;
}

export interface ProgressScoreBlock {
  /** `null` em onboarding — sem histórico não se afirma número. */
  value: number | null;
  status: "onboarding" | "ok";
  trend: "up" | "stable" | "down";
  /** Breakdown: nunca vazio quando há `value`. */
  factors: ScoreFactor[];
  /** O que mudou vs. 7 dias atrás. Vazio quando não há comparação. */
  changes7d: ScoreFactor[];
  updatedAt: string;
  formulaVersion: number;
}

export interface TrainingLoadBlock {
  effortLoad7d: number | null;
  /** Faixa qualitativa, nunca a razão crua — não é métrica clínica. */
  ratioBand: "below" | "within" | "above" | "spike" | null;
  ratioLabel: string | null;
}

export interface PerformanceOverview {
  gated: boolean;
  freeSummary: { sessions30d: number; activeDays28: number; currentStreak: number };
  consistency: ConsistencySummary;
  score: ProgressScoreBlock | null;
  load: TrainingLoadBlock | null;
  /** Frase observacional do período. Nunca atribui causa. */
  headline: string;
}

export interface ScoreHistoryResponse {
  gated: boolean;
  points: { date: string; score: number }[];
}

/** Série do Progress Score. Só pontos reais — dia sem snapshot não vira zero. */
export async function getScoreHistory(
  days = 90,
  signal?: AbortSignal,
): Promise<ScoreHistoryResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/score/history?days=${days}`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as ScoreHistoryResponse) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "score_history" } });
    return null;
  }
}

export async function getPerformanceOverview(signal?: AbortSignal): Promise<PerformanceOverview | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/overview`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as PerformanceOverview) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "overview" } });
    return null;
  }
}

// ── Recordes e progressão (P2) ─────────────────────────────────────────────

export type PrKind = "max_load" | "best_e1rm" | "session_volume" | "max_reps";

export interface PrRecord {
  /** `null` quando o exercício saiu do catálogo — o recorde continua valendo. */
  exerciseId: string | null;
  exerciseName: string;
  kind: PrKind;
  value: number;
  reps: number | null;
  loadKg: number | null;
  previousValue: number | null;
  /** Estreia da categoria: linha de base, não conquista. */
  isFirst: boolean;
  achievedAt: string;
  sessionId: number | null;
  exerciseInCatalog: boolean;
}

export interface PrRecordsResponse {
  gated: boolean;
  records: PrRecord[];
  events: PrRecord[];
}

export interface ProgressionPoint {
  date: string;
  maxLoadKg: number | null;
  bestE1rm: number | null;
  tonnageKg: number | null;
  topSetReps: number | null;
}

export interface ProgressionExercise {
  exerciseId: string;
  name: string;
  points: ProgressionPoint[];
  firstLoadKg: number | null;
  lastLoadKg: number | null;
  deltaKg: number | null;
  firstE1rm: number | null;
  lastE1rm: number | null;
  e1rmDeltaKg: number | null;
  pointCount: number;
}

export interface ProgressionResponse {
  gated: boolean;
  windowDays: number;
  exercises: ProgressionExercise[];
}

/** `null` distingue FALHA de "sem dados" — a UI mostra erro, não vazio. */
export async function getPrRecords(signal?: AbortSignal): Promise<PrRecordsResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/prs`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as PrRecordsResponse) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "prs" } });
    return null;
  }
}

export async function getProgression(
  windowDays = 90,
  signal?: AbortSignal,
): Promise<ProgressionResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/progression?windowDays=${windowDays}`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as ProgressionResponse) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "progression" } });
    return null;
  }
}

export async function getTrainingCalendar(
  month: string,
  signal?: AbortSignal,
): Promise<ActiveDay[]> {
  if (!getAccessToken()) return [];
  try {
    const res = await authFetch(`${API_URL}/performance/calendar?month=${encodeURIComponent(month)}`, { signal });
    if (!res.ok) return [];
    const data = await parseJson(res);
    return ((data?.data as { days?: ActiveDay[] })?.days) ?? [];
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return [];
    Sentry.captureException(err, { tags: { feature: "performance", reason: "calendar" } });
    return [];
  }
}


// ── Metas (Onda P4) ────────────────────────────────────────────────────────

export type GoalKind =
  | "exercise_load"
  | "exercise_e1rm"
  | "exercise_reps_at_load"
  | "weekly_frequency"
  | "monthly_frequency"
  | "streak";

export type GoalStatus = "active" | "achieved" | "abandoned" | "expired";

export interface Goal {
  id: string;
  kind: GoalKind;
  status: GoalStatus;
  /** Rótulo canônico, derivado no backend. Aluno e personal leem o mesmo texto. */
  displayLabel: string;
  exerciseId: string | null;
  /** Nome histórico: sobrevive à remoção do exercício do catálogo. */
  exerciseName: string | null;
  targetValue: number;
  targetReps: number | null;
  unit: string;
  progressUnit: string;
  baselineValue: number | null;
  currentValue: number | null;
  /** 0..1, ou `null` quando não há medição. Nunca NaN — o servidor garante. */
  progress: number | null;
  remaining: number | null;
  startsOn: string;
  dueOn: string | null;
  achievedAt: string | null;
  metricVersion: number;
  createdAt: string;
  monotonic: boolean;
}

export interface GoalsResponse {
  gated: boolean;
  goals: Goal[];
  activeCount: number;
  maxActive: number;
}

export async function getGoals(signal?: AbortSignal): Promise<GoalsResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/performance/goals`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as GoalsResponse) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "performance", reason: "goals" } });
    return null;
  }
}

export interface CreateGoalInput {
  kind: GoalKind;
  exerciseId?: string | null;
  targetValue: number;
  targetReps?: number | null;
  dueOn?: string | null;
}

/**
 * Cria a meta.
 *
 * Diferente das leituras do módulo, aqui o erro NÃO vira `null` silencioso: o
 * aluno acabou de agir e precisa saber por que não deu — em especial "você já
 * está nesse patamar", que é orientação, não falha.
 */
export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const res = await authFetch(`${API_URL}/performance/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Não foi possível criar a meta.");
  return data.data as Goal;
}

/** Abandona a meta. Não apaga — o histórico do aluno é preservado. */
export async function abandonGoal(goalId: string): Promise<Goal> {
  const res = await authFetch(`${API_URL}/performance/goals/${goalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "abandoned" }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || "Não foi possível abandonar a meta.");
  return data.data as Goal;
}

/* ------------------------------------------------------------------ *
 * Marcos (Spec 034, Onda C1)
 * ------------------------------------------------------------------ */

export interface Milestone {
  code: string;
  title: string;
  description: string;
  /** A regra exata, em uma frase — o aluno vê o critério do que ainda não tem. */
  criterion: string;
  /** `null` = ainda não conquistado. */
  unlockedAt: string | null;
  evidence: Record<string, unknown> | null;
  shared: boolean;
  /** `false` quando não há como conquistar no estado atual da conta. */
  available: boolean;
  unavailableReason: string | null;
}

export async function getMilestones(signal?: AbortSignal): Promise<Milestone[] | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/community/milestones`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data?.milestones as Milestone[]) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "community", reason: "milestones" } });
    return null;
  }
}

/**
 * Registra a intenção de compartilhar. Diferente das leituras, devolve `null`
 * em falha e o chamador reverte o estado otimista — o aluno precisa perceber
 * que a escolha dele sobre privacidade não foi salva.
 */
export async function setMilestoneShared(
  code: string,
  shared: boolean,
): Promise<Milestone | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/community/milestones/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shared }),
    });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data?.milestone as Milestone) ?? null;
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "community", reason: "milestone_share" } });
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Desafios (Spec 034, Onda C2)
 * ------------------------------------------------------------------ */

export type ChallengeKind = "consistency" | "weekly_goal" | "comeback";
export type ChallengeState = "scheduled" | "running" | "ended" | "cancelled";
export type ParticipantStatus = "invited" | "active" | "left" | "completed";
export type BandId = "completed" | "almost" | "in_progress" | "inactive";

export interface ChallengeSummary {
  id: string;
  /** Nome de quem criou o desafio. Convite anônimo não é convite. */
  invitedByName?: string | null;
  title: string;
  description: string | null;
  kind: ChallengeKind;
  /** A regra em português — o convite precisa dizer como o progresso é medido. */
  ruleText: string;
  startsOn: string;
  endsOn: string;
  state: ChallengeState;
  myStatus?: ParticipantStatus;
  finalPct?: number | null;
}

export interface MyChallengeProgress {
  /** `null` = não dá para afirmar (sem frequência prevista, sem pausa). */
  pct: number | null;
  weeksDone: number;
  weeksRequired: number;
  achieved?: boolean;
  blockedReason?: "no_target" | "no_inactivity" | null;
  band: BandId;
}

export interface BandCount {
  band: BandId;
  label: string;
  count: number;
}

export interface ChallengeDetail {
  challenge: ChallengeSummary;
  myStatus: ParticipantStatus;
  myProgress: MyChallengeProgress;
  participantsCount: number;
  /** `null` com menos de 5 participantes: a faixa identificaria a pessoa. */
  bands: BandCount[] | null;
}

async function communityGet<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await authFetch(`${API_URL}/community${path}`, { signal });
    if (!res.ok) return null;
    const data = await parseJson(res);
    return (data?.data as T) ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null;
    Sentry.captureException(err, { tags: { feature: "community", path } });
    return null;
  }
}

export async function getMyChallenges(signal?: AbortSignal) {
  const data = await communityGet<{ challenges: ChallengeSummary[] }>("/challenges", signal);
  return data?.challenges ?? null;
}

export async function getActiveChallenge(signal?: AbortSignal) {
  const data = await communityGet<{ challenge: (ChallengeSummary & { myProgress: MyChallengeProgress }) | null }>(
    "/challenges/active",
    signal,
  );
  return data?.challenge ?? null;
}

export async function getChallengeDetail(id: string, signal?: AbortSignal) {
  return communityGet<ChallengeDetail>(`/challenges/${encodeURIComponent(id)}`, signal);
}

/**
 * Entrar e sair são AÇÕES do titular: diferente das leituras, o erro não vira
 * `null` silencioso — quem acabou de decidir precisa saber se valeu.
 */
async function communityAction(path: string): Promise<{ ok: boolean; error?: string }> {
  if (!getAccessToken()) return { ok: false, error: "Sessão expirada." };
  try {
    const res = await authFetch(`${API_URL}/community${path}`, { method: "POST" });
    const data = await parseJson(res);
    if (!res.ok) return { ok: false, error: data?.error || "Não foi possível concluir." };
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "community", path } });
    return { ok: false, error: "Falha de conexão. Tente de novo." };
  }
}

export const joinChallenge = (id: string) =>
  communityAction(`/challenges/${encodeURIComponent(id)}/join`);
export const leaveChallenge = (id: string) =>
  communityAction(`/challenges/${encodeURIComponent(id)}/leave`);
