/**
 * Cliente do Motor de Substituições Inteligentes (Sprint P2A,
 * `docs/sprints/P2A_SMART_EXERCISE_SUBSTITUTION.md`).
 *
 * `GET /api/exercises/:id/replacement-suggestions` — camada ANTES da busca
 * manual, nunca a substitui. Diferente dos demais clientes deste diretório
 * (`exercisesApi.ts`, `personalExercisesApi.ts`), esta função NUNCA lança:
 * quem chama (`ReplacementSuggestionsSheet`) precisa cair no fallback de
 * busca manual em qualquer cenário — rede fora do ar, timeout, 404, 500 —
 * sem um `try/catch` a mais espalhado pela UI. `null` é o sinal único de
 * "sem sugestão disponível agora, siga para a busca manual".
 */
import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import type { Exercise } from "./exercisesApi";

/** Espelha `ReplacementReasonCategory` do backend (D4 do harness). */
export type ReplacementReasonCategory = "equipment_unavailable" | "pain_discomfort" | "other";

export type ReplacementSuggestionTier = "PERSONAL_DEFINED" | "HEURISTIC";

export type ReplacementSuggestion = {
  exercise: Exercise;
  tier: ReplacementSuggestionTier;
  /** `null` quando `cautionAdvisory` está ativo (D8) — nenhum rótulo de confiança. */
  label: string | null;
  /** Selo complementar "Você já usou esta alternativa" — nunca substitui `label` (D6). */
  usedBeforeBadge: boolean;
  reason: string;
};

export type ReplacementSuggestionsResult = {
  originalExerciseId: string;
  cautionAdvisory: boolean;
  suggestions: ReplacementSuggestion[];
};

/** O motor nunca pode travar quem está treinando — corta e cai no fallback. */
const REQUEST_TIMEOUT_MS = 6000;

/**
 * Busca sugestões de substituição para `exerciseId`.
 *
 * Devolve `null` em QUALQUER falha (rede, timeout, 400/404/500, resposta
 * malformada) — nunca lança. A decisão de reasonCategory desta sprint (D10,
 * ver harness): o frontend não envia `reasonCategory` nesta chamada, porque
 * ela acontece ANTES do motivo ser perguntado em `SubstitutionConfirmSheet`
 * — perguntar o motivo duas vezes (uma vez cedo para o motor, outra na
 * confirmação de sempre) seria fricção nova sem necessidade clara. Isso
 * significa que `cautionAdvisory` nunca vem `true` por este caminho nesta
 * sprint; o parâmetro segue aceito pela API para uso futuro.
 */
export async function fetchReplacementSuggestions(
  exerciseId: string,
  reasonCategory?: ReplacementReasonCategory,
): Promise<ReplacementSuggestionsResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const qs = reasonCategory ? `?reasonCategory=${encodeURIComponent(reasonCategory)}` : "";
    const response = await authFetch(
      `${API_URL}/exercises/${encodeURIComponent(exerciseId)}/replacement-suggestions${qs}`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    const data = await parseJson(response);
    if (!data || !Array.isArray(data.suggestions)) return null;
    return data as ReplacementSuggestionsResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
