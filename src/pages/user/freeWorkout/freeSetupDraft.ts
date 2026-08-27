/**
 * Rascunho da MONTAGEM do treino livre (antes de "Começar treino").
 *
 * A seleção só existia em `useState`: um F5 na tela de montagem — ou o Android
 * matando a aba do PWA enquanto o aluno atende o telefone — apagava os oito
 * exercícios escolhidos um a um. Guardar aqui é o mesmo contrato do rascunho de
 * sessão: `localStorage`, best-effort, silencioso quando indisponível.
 *
 * Chave PRÓPRIA (`…:free:setup`), separada da chave da sessão (`…:free`), e a
 * separação é a regra: montagem salva não é treino em execução. Confundir as
 * duas faria a tela mostrar o banner "Retomar/Descartar" para quem só tinha
 * escolhido exercícios, e o "Começar treino" ficaria bloqueado por uma sessão
 * que nunca existiu.
 *
 * A restauração sanitiza item a item porque o conteúdo vem do aparelho, não do
 * servidor: um JSON adulterado ou de uma versão futura não pode montar uma
 * lista que o POST recusaria depois do treino feito.
 */

import {
  DEFAULT_REPS,
  DEFAULT_REST_S,
  DEFAULT_SETS,
  MAX_EXERCISES,
  MAX_REPS,
  MAX_REST_S,
  MAX_SETS,
  MIN_REPS,
  MIN_REST_S,
  MIN_SETS,
  type FreeWorkoutItem,
} from "./freeSessionOps";

const SETUP_KEY = "s2core:workout:draft:free:setup";

interface StoredSetupDraft {
  version: 1;
  mode: "free-setup";
  updatedAt: number;
  items: FreeWorkoutItem[];
}

/**
 * Só número ou string numérica valem; qualquer outra coisa cai no padrão da
 * tela. Aceitar o que `Number()` aceita seria pior que descartar: `Number(null)`
 * é 0, e um campo ausente viraria "1 repetição" em vez das 10 do padrão.
 */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function sanitizeItem(raw: unknown): FreeWorkoutItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const exerciseId = typeof item.exerciseId === "string" ? item.exerciseId.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  // Sem id não dá para montar a sessão (o POST referencia `exercises.id`) e sem
  // nome o aluno não reconheceria a linha — descartar o item é melhor que
  // exibir "undefined" no meio da lista.
  if (!exerciseId || !name) return null;
  return {
    exerciseId,
    name,
    bodyPart: typeof item.bodyPart === "string" ? item.bodyPart : null,
    sets: clampInt(item.sets, MIN_SETS, MAX_SETS, DEFAULT_SETS),
    reps: String(clampInt(item.reps, MIN_REPS, MAX_REPS, Number(DEFAULT_REPS))),
    restS: clampInt(item.restS, MIN_REST_S, MAX_REST_S, DEFAULT_REST_S),
  };
}

/** Serialização — exportada para o teste cobrir o par escrever/ler sem tela. */
export function serializeFreeSetupDraft(items: readonly FreeWorkoutItem[], now = Date.now()): string {
  const draft: StoredSetupDraft = {
    version: 1,
    mode: "free-setup",
    updatedAt: now,
    items: items.slice(0, MAX_EXERCISES) as FreeWorkoutItem[],
  };
  return JSON.stringify(draft);
}

/**
 * Restauração — devolve lista vazia para qualquer entrada que não seja um
 * rascunho de montagem íntegro. Vazio é o estado inicial da tela, então
 * conteúdo corrompido degrada para "nada escolhido", nunca para erro.
 */
export function parseFreeSetupDraft(raw: string | null | undefined): FreeWorkoutItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const draft = parsed as Partial<StoredSetupDraft>;
  if (draft.version !== 1 || draft.mode !== "free-setup" || !Array.isArray(draft.items)) return [];

  const seen = new Set<string>();
  const items: FreeWorkoutItem[] = [];
  for (const entry of draft.items) {
    const item = sanitizeItem(entry);
    if (!item || seen.has(item.exerciseId)) continue;
    seen.add(item.exerciseId);
    items.push(item);
    if (items.length >= MAX_EXERCISES) break;
  }
  return items;
}

export function loadFreeSetupDraft(): FreeWorkoutItem[] {
  try {
    return parseFreeSetupDraft(localStorage.getItem(SETUP_KEY));
  } catch {
    return [];
  }
}

/** Lista vazia apaga a chave: montagem sem exercício não é rascunho. */
export function saveFreeSetupDraft(items: readonly FreeWorkoutItem[]): void {
  try {
    if (!items.length) {
      localStorage.removeItem(SETUP_KEY);
      return;
    }
    localStorage.setItem(SETUP_KEY, serializeFreeSetupDraft(items));
  } catch {
    /* quota/privado: rascunho é best-effort */
  }
}

export function clearFreeSetupDraft(): void {
  try {
    localStorage.removeItem(SETUP_KEY);
  } catch {
    /* silencioso */
  }
}

export const FREE_SETUP_DRAFT_KEY = SETUP_KEY;
