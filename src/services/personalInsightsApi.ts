import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

/**
 * Cliente de Aderência, Recorrência e Insights do Personal (Sprint P2B),
 * `/api/personal/students/:studentId/{adherence,exercise-insights}*`.
 *
 * Espelha o contrato do backend (`docs/sprints/P2B_ADHERENCE_RECURRING_INSIGHTS.md`,
 * `API_CHANGES`) sem reinterpretá-lo — mesmo espírito de `personalPerformanceApi.ts`:
 * os campos chegam com o mesmo nome e a mesma forma que o servidor devolve.
 */

export type ExecutionCategory =
  | "EXECUTADO_CONFORME_PRESCRITO"
  | "SUBSTITUIDO"
  | "PARCIAL"
  | "NAO_EXECUTADO";

export type ExerciseExecution = {
  sessionId: number;
  performedAt: string;
  exerciseId: string | null;
  exerciseName: string;
  category: ExecutionCategory;
  prescribedSets: number;
  doneSets: number;
  substitutedToExerciseId: string | null;
  substitutedToExerciseName: string | null;
  substitutionReason: string | null;
};

export type AddedExerciseExecution = {
  sessionId: number;
  performedAt: string;
  exerciseId: string | null;
  exerciseName: string;
  setsDone: number;
};

export type AdherenceSummary = {
  windowDays: number;
  sessionsConsidered: number;
  /** Total de exercícios PRESCRITOS na janela — denominador dos 4 buckets. */
  denominator: number;
  buckets: Record<ExecutionCategory, { count: number; pct: number | null }>;
  /** Fora do denominador (D4 do harness) — nunca somar ao mesmo total. */
  addedCount: number;
  items: ExerciseExecution[];
  added: AddedExerciseExecution[];
};

export type InsightType = "DISCOMFORT_PATTERN" | "RECURRING_REPLACEMENT";

export type InsightAlternative = {
  exerciseId: string;
  exerciseName: string;
  count: number;
  approvedByPersonal: boolean;
};

export type ExerciseInsight = {
  type: InsightType;
  originalExerciseId: string;
  originalExerciseName: string;
  windowSize: number;
  occurrenceCount: number;
  mostRecentAt: string;
  alternatives: InsightAlternative[];
  predominantReason: { text: string; count: number } | null;
  auditSessionIds: number[];
};

export type ExerciseInsightsSummary = {
  recurrenceWindowDays: number;
  sessionsConsidered: number;
  insights: ExerciseInsight[];
};

export type ExerciseInsightDetail = {
  originalExerciseId: string;
  originalExerciseName: string;
  windowSize: number;
  /** As mesmas <= 5 ocorrências usadas no cálculo — auditabilidade do "por que apareceu". */
  occurrences: ExerciseExecution[];
  recurringReplacement: ExerciseInsight | null;
  discomfortPattern: ExerciseInsight | null;
};

export type PlanReviewDismissed = { applied: false; dismissed: true };

export type PlanReviewRequiresManualEdit = {
  applied: false;
  requiresManualEdit: true;
  reason: "BI_SET_MEMBER";
  planId: number;
  dayIndex: number;
};

/**
 * `plan` chega no shape de linha de `personal_workout_plans` (o mesmo devolvido
 * por `updatePersonalWorkoutPlanWithDays` no backend) — a UI aqui não depende
 * do formato exato, só de `applied: true` para saber que deu certo.
 */
export type PlanReviewApplied = { applied: true; plan: unknown };

export type PlanReviewResult = PlanReviewDismissed | PlanReviewRequiresManualEdit | PlanReviewApplied;

/**
 * Erro com código estável — mesmo padrão de `PerformanceAccessError`
 * (`personalPerformanceApi.ts`): a UI decide a mensagem pelo código, nunca
 * pela frase crua que vem da API.
 */
export class PersonalInsightsError extends Error {
  readonly code: string;
  readonly status: number;
  /** Só preenchido em `INVALID_EXERCISES` — lista de motivos, não é texto do usuário. */
  readonly details?: string[];

  constructor(code: string, status: number, message: string, details?: string[]) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Deriva um código estável a partir de respostas que nem sempre trazem `code`
 * no corpo (`sendReadError`/`roleCheckMiddleware` em alguns caminhos não
 * incluem — só `error` como frase). 403 sem `code` e sem `consent_required`
 * só acontece por `ASSIGNMENT_REQUIRED` (vínculo inativo) nestas rotas — é o
 * único caminho de 403 que os serviços chamados aqui produzem.
 */
function deriveReadErrorCode(status: number, payload: { code?: string; error?: string } | null): string {
  if (payload?.code) return payload.code;
  if (payload?.error === "consent_required") return "CONSENT_REQUIRED";
  if (status === 403) return "ASSIGNMENT_REQUIRED";
  return "UNKNOWN";
}

async function readOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new PersonalInsightsError(deriveReadErrorCode(response.status, payload), response.status, payload?.error || fallback);
  }
  return payload.data as T;
}

export async function getStudentAdherence(
  studentId: string,
  windowDays = 30,
  signal?: AbortSignal,
): Promise<AdherenceSummary> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/adherence?window=${windowDays}`, { signal });
  return readOrThrow<AdherenceSummary>(res, "Não foi possível calcular a aderência à ficha.");
}

export async function getExerciseInsights(
  studentId: string,
  signal?: AbortSignal,
): Promise<ExerciseInsightsSummary> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/exercise-insights`, { signal });
  return readOrThrow<ExerciseInsightsSummary>(res, "Não foi possível carregar os insights de execução.");
}

/**
 * `null` quando o exercício nunca foi prescrito na janela de recorrência —
 * o backend responde 404 nesse caso (não é erro de acesso, é "nada a
 * mostrar"), então essa condição vira `null` aqui em vez de exceção.
 */
export async function getExerciseInsightDrillDown(
  studentId: string,
  exerciseId: string,
  signal?: AbortSignal,
): Promise<ExerciseInsightDetail | null> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/exercise-insights/${exerciseId}`, { signal });
  if (res.status === 404) {
    const payload = await parseJson(res);
    const code = deriveReadErrorCode(404, payload);
    // 404 por vínculo/consent não é "nada a mostrar" — continua erro.
    if (code === "ASSIGNMENT_REQUIRED" || code === "CONSENT_REQUIRED") {
      throw new PersonalInsightsError(code, 404, payload?.error || "Acesso negado.");
    }
    return null;
  }
  return readOrThrow<ExerciseInsightDetail>(res, "Não foi possível carregar o detalhe do insight.");
}

/**
 * Deriva o código de erro da revisão assistida — a rota de escrita nem sempre
 * inclui `code` no corpo (ver `personalInsights.ts`: `invalid_action` e
 * `invalid_target_exercise_id` só têm `error`; `INVALID_EXERCISES` só tem
 * `error`+`details`; os demais, vindos de `fail()`, trazem `code`).
 */
function deriveReviewErrorCode(status: number, payload: { code?: string; error?: string; details?: string[] } | null): string {
  if (payload?.code) return payload.code;
  if (payload?.details) return "INVALID_EXERCISES";
  if (payload?.error === "invalid_target_exercise_id") return "INVALID_TARGET_EXERCISE_ID";
  if (payload?.error === "invalid_action") return "INVALID_ACTION";
  if (status === 404) return "PLAN_NOT_FOUND";
  return "UNKNOWN";
}

/**
 * Revisão assistida — decisão EXPLÍCITA do Personal (nunca automática).
 * `action: 'dismiss'` não persiste nada no servidor (FUTURE_WORK do harness);
 * é fire-and-forget do ponto de vista de dado, mas ainda esperamos a resposta
 * aqui para não fechar o card antes de saber que a chamada foi aceita.
 */
export async function reviewExerciseInsight(
  studentId: string,
  exerciseId: string,
  body: { action: "dismiss" } | { action: "apply"; targetExerciseId: string },
): Promise<PlanReviewResult> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/exercise-insights/${exerciseId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parseJson(res);
  if (!res.ok) {
    throw new PersonalInsightsError(
      deriveReviewErrorCode(res.status, payload),
      res.status,
      payload?.error || "Não foi possível revisar a ficha.",
      payload?.details,
    );
  }
  return payload.data as PlanReviewResult;
}
