// Rascunho da sessão de treino em andamento (estados "pausado"/"retomado"/
// "abandonado"). Fica em localStorage para sobreviver a sair e voltar da tela
// sem depender do backend. A persistência real (POST /training/sessions) só
// acontece na finalização. Uma chave por plano+dia no treino prescrito; uma
// chave fixa no treino livre (ver bloco no fim do arquivo).

import type { TechniqueConfig } from "../../../features/training/techniques/technique.types";

/**
 * De onde saiu o exercício que está sendo executado. Ausente é o mesmo que
 * `prescribed`: rascunhos gravados antes deste campo existir não têm nada aqui,
 * e todos eles são da ficha.
 */
export type DraftExerciseOrigin = "prescribed" | "replacement" | "user_added";

export interface DraftSetEntry {
  setIndex: number;
  plannedReps: string;
  plannedRestS: number | null;
  loadKg: string;
  reps: string;
  done: boolean;
  restDoneS: number | null;
  completedAt: number | null;
}

export interface DraftExercise {
  exerciseId: string | null;
  name: string;
  biSetGroupId: string | null;
  sets: DraftSetEntry[];
  /**
   * `body_part` do catálogo. Opcional: o fluxo prescrito nunca gravou este
   * campo e drafts antigos precisam continuar parseando. O treino livre usa
   * para derivar `muscleGroups` e o título da sessão sem ir ao servidor.
   */
  bodyPart?: string | null;
  /** Origem do exercício na execução. Ausente = prescrito (default histórico). */
  origin?: DraftExerciseOrigin;
  /**
   * Estado completo do exercício ANTES da substituição — desfazer restaura
   * séries e técnica exatamente como estavam. Ausente quando `origin` não é
   * `replacement`.
   */
  replacedSnapshot?: DraftExercise;
  /** Motivo opcional informado na substituição (≤ 280 chars, o cap do backend). */
  substitutionReason?: string | null;
  /**
   * Técnica do item, copiada da ficha na montagem. Guardar aqui desacopla a
   * execução de reler o plano por índice — que deixa de casar assim que o aluno
   * adiciona, remove ou substitui alguém no meio do treino.
   */
  technique?: TechniqueConfig | null;
}

export interface SessionDraft {
  version: 1;
  planId: number;
  dayIndex: number;
  startedAt: number;
  currentIndex: number;
  exercises: DraftExercise[];
  /** Instante (ms) em que um descanso ativo termina — recalculado ao retomar. */
  restEndsAt: number | null;
  restForKey: string | null;
  /**
   * Fingerprint da ficha no instante em que o rascunho nasceu. Na retomada diz
   * se o personal editou a ficha desde então — o que a contagem de exercícios
   * sozinha não vê (trocar reps ou o exercício mantém o comprimento). Ausente em
   * rascunho antigo, que cai no fallback por comprimento que já existia.
   */
  prescribedBaseline?: string;
}

/** Item da ficha, no mínimo que a comparação de baseline precisa enxergar. */
export interface PrescribedBaselineItem {
  exerciseId: string | null;
  name: string;
  sets: string;
  reps: string;
  rest: string;
  technique?: { type: string; biSetGroupId?: string | null } | null;
}

/**
 * Serializa a ficha para comparação por igualdade de string.
 *
 * É posicional de propósito: reordenar os exercícios do dia muda o treino que o
 * aluno vai executar, então tem de contar como ficha diferente. Não é hash — só
 * precisa ser determinístico, e um JSON de tuplas já é.
 */
export function computePrescribedBaseline(items: readonly PrescribedBaselineItem[]): string {
  return JSON.stringify(
    items.map((item) => [
      item.exerciseId ?? null,
      item.name,
      item.sets,
      item.reps,
      item.rest,
      item.technique?.type ?? null,
      item.technique?.biSetGroupId ?? null,
    ]),
  );
}

const PREFIX = "s2core:workout:draft:";

export function draftKey(planId: number, dayIndex: number): string {
  return `${PREFIX}${planId}:${dayIndex}`;
}

export function loadDraft(planId: number, dayIndex: number): SessionDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(planId, dayIndex));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraft;
    if (parsed?.version !== 1 || !Array.isArray(parsed.exercises)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: SessionDraft): void {
  try {
    localStorage.setItem(draftKey(draft.planId, draft.dayIndex), JSON.stringify(draft));
  } catch {
    /* quota/privado: rascunho é best-effort */
  }
}

export function clearDraft(planId: number, dayIndex: number): void {
  try {
    localStorage.removeItem(draftKey(planId, dayIndex));
  } catch {
    /* silencioso */
  }
}

// ── Treino livre ────────────────────────────────────────────────────────────
// O treino montado pelo aluno não tem plano nem dia, então não há como compor
// uma chave por plano+dia. A chave é FIXA, e isso é a regra de negócio: no
// máximo um treino livre em andamento por aparelho. Começar outro exige retomar
// ou descartar o que está aberto — é assim que "iniciei e esqueci" deixa de
// virar duas sessões concorrentes.

export interface FreeSessionDraft {
  version: 1;
  mode: "free";
  startedAt: number;
  currentIndex: number;
  exercises: DraftExercise[];
  /** Instante (ms) em que um descanso ativo termina — recalculado ao retomar. */
  restEndsAt: number | null;
  restForKey: string | null;
  /**
   * Identificador do treino gerado no cliente, na criação do rascunho. Viaja no
   * POST final e dá idempotência ponta a ponta: recarregar a página, perder a
   * rede e reenviar não cria uma segunda sessão, porque o servidor tem UNIQUE
   * parcial sobre esta chave.
   */
  clientKey: string;
}

const FREE_KEY = `${PREFIX}free`;

/**
 * UUID v4 com fallback — `crypto.randomUUID` não existe em WebView Android
 * antigo (nem fora de contexto seguro), e ficar sem `clientKey` custaria
 * justamente a idempotência que ele existe para dar.
 */
export function newClientKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (typeof c?.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function loadFreeDraft(): FreeSessionDraft | null {
  try {
    const raw = localStorage.getItem(FREE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FreeSessionDraft;
    if (parsed?.version !== 1 || parsed?.mode !== "free" || !Array.isArray(parsed.exercises)) {
      return null;
    }
    // Rascunho sem chave não é descartado: perder o treino em andamento é pior
    // que perder a idempotência de um envio que ainda nem aconteceu.
    return parsed.clientKey ? parsed : { ...parsed, clientKey: newClientKey() };
  } catch {
    return null;
  }
}

export function saveFreeDraft(draft: FreeSessionDraft): void {
  try {
    localStorage.setItem(FREE_KEY, JSON.stringify(draft));
  } catch {
    /* quota/privado: rascunho é best-effort */
  }
}

export function clearFreeDraft(): void {
  try {
    localStorage.removeItem(FREE_KEY);
  } catch {
    /* silencioso */
  }
}
