import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import type { Goal } from "../features/performance/performanceApi";

/**
 * Performance do aluno pelo lado do personal (Spec 033, Onda P5).
 *
 * Espelha o contrato do backend sem reinterpretá-lo: os três blocos —
 * `facts`, `signals` e a síntese — chegam separados e continuam separados aqui.
 * Achatar tudo num objeto só na camada de rede seria desfazer no cliente a
 * distinção que o servidor faz questão de manter entre número calculado e texto
 * gerado.
 */

export type SignalSeverity = "positive" | "neutral" | "attention";

export interface PerformanceSignal {
  type: string;
  severity: SignalSeverity;
  title: string;
  description: string;
  period: string;
  /** Os números que sustentam o sinal — é o que o personal pode conferir. */
  evidence: Record<string, number | string | null>;
}

export interface SnapshotFacts {
  score: number | null;
  scoreStatus: "onboarding" | "ok" | "unavailable";
  scoreTrend: "up" | "stable" | "down" | null;
  scoreFactors: { id: string; label: string; delta: number }[];
  scoreFormulaVersion: number | null;
  consistency: {
    pct: number | null;
    activeDays28: number;
    activeDaysThisWeek: number;
    activeDaysLastWeek: number;
    targetPerWeek: number | null;
  };
  trainingLoad: {
    effortLoad7d: number | null;
    band: "below" | "within" | "above" | "spike" | null;
    label: string | null;
  };
  recentPrs: {
    exerciseName: string;
    /** `null` = exercício saiu do catálogo. O nome sobrevive. */
    exerciseId: string | null;
    kind: string;
    value: number;
    previousValue: number | null;
    achievedAt: string;
  }[];
  progressionHighlights: { total: number; improved: number; regressed: number };
  goals: Goal[];
  streakDays: number | null;
  sessions30d: number;
}

export interface PerformanceSnapshot {
  generatedAt: string;
  studentId: number;
  facts: SnapshotFacts;
  signals: PerformanceSignal[];
  snapshotHash: string;
}

export interface PerformanceAiSummary {
  summary: string;
  highlights: string[];
  attentionPoints: string[];
  disclaimer: string;
  /** `deterministic` quando a IA não participou. A tela precisa dizer a verdade. */
  source: "ai" | "deterministic";
}

/** Erro com código estável — a UI decide a mensagem pelo código, não pela frase. */
export class PerformanceAccessError extends Error {
  /**
   * Campo declarado no corpo, e não como propriedade de parâmetro: o projeto
   * compila com `erasableSyntaxOnly`, que proíbe a forma curta.
   */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Busca o snapshot.
 *
 * Diferente das leituras do lado do aluno (que degradam para `null`), aqui o
 * motivo do bloqueio PRECISA chegar à tela: "o aluno revogou o acesso" e "deu
 * erro" pedem respostas opostas do personal, e um `null` silencioso faria as
 * duas parecerem a mesma coisa.
 */
export async function fetchStudentPerformance(
  studentId: string,
  signal?: AbortSignal,
): Promise<PerformanceSnapshot> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/performance`, { signal });
  const data = await parseJson(res);
  if (!res.ok) {
    const code = data?.code ?? (data?.error === "consent_required" ? "CONSENT_REQUIRED" : "UNKNOWN");
    throw new PerformanceAccessError(code, data?.error ?? "Não foi possível carregar a performance.");
  }
  return data.data as PerformanceSnapshot;
}

/**
 * Pede a síntese em linguagem natural.
 *
 * O corpo é vazio de propósito: o servidor recomputa o snapshot. Mandar os fatos
 * daqui permitiria pedir um resumo sobre números escritos pelo cliente.
 */
export async function requestPerformanceInsight(studentId: string): Promise<PerformanceAiSummary> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/performance/insight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new PerformanceAccessError(data?.code ?? "UNKNOWN", data?.error ?? "Não foi possível gerar o resumo.");
  }
  return data.data as PerformanceAiSummary;
}
