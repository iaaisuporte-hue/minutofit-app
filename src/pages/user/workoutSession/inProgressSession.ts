// Detecção de treino em andamento, para o aviso de retomada ao reabrir o app.
//
// Por que existe: o rascunho (`sessionDraft.ts`) já sobrevive a minimizar, ao
// processo morrer e ao aparelho reiniciar — mas só é ENCONTRADO por quem volta
// exatamente à mesma URL da sessão. O caso real do celular é outro: o Android
// mata o app, a pessoa toca no ícone e cai na Hoje. O treino continuava lá,
// invisível, e ela começava outro (QA mobile set/2026).
//
// Este módulo varre as chaves de rascunho e devolve a sessão mais recente com
// o que a UI precisa para oferecer "Continuar" — sem acoplar a tela ao formato
// interno do rascunho.

import {
  clearDraft,
  clearFreeDraft,
  draftKey,
  loadFreeDraft,
  type DraftExercise,
  type FreeSessionDraft,
  type SessionDraft,
} from "./sessionDraft";

const PREFIX = "s2core:workout:draft:";

/**
 * Um treino aberto neste aparelho, pronto para ser retomado.
 * `mode` decide a rota e o texto — o resto é igual nos dois fluxos.
 */
export interface InProgressSession {
  mode: "plan" | "free";
  /** Rota que reabre a sessão exatamente onde parou. */
  route: string;
  /** Início da sessão (ms) — ordena quando há mais de um rascunho. */
  startedAt: number;
  /**
   * Última atividade real (ms): a série marcada mais recente, ou o início.
   *
   * Separa "estou treinando agora" de "esqueci um treino aberto ontem". O
   * mini-player serve o primeiro caso; o card grande de retomada, o segundo.
   * Sem essa distinção os dois apareciam juntos na Hoje dizendo a mesma coisa.
   */
  lastActivityAt: number;
  doneSets: number;
  totalSets: number;
  /** Nome do exercício em que a pessoa parou, quando dá para saber. */
  currentExercise: string | null;
  /** Argumentos para descartar este rascunho. */
  planId: number | null;
  dayIndex: number | null;
  /**
   * Instante (ms) em que o descanso em curso termina, ou null.
   *
   * É um instante ABSOLUTO, não uma contagem — é o que permite o mini-player
   * mostrar o descanso certo sem que ninguém tenha contado os segundos
   * enquanto a tela de treino estava desmontada (SPEC P1 §12).
   */
  restEndsAt: number | null;
}

function contaSeries(exercises: DraftExercise[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets ?? []) {
      total += 1;
      if (s.done) done += 1;
    }
  }
  return { done, total };
}

function exercicioAtual(exercises: DraftExercise[], idx: number): string | null {
  return exercises[idx]?.name?.trim() || null;
}

/**
 * Instante da série concluída mais recente, ou 0 se nenhuma.
 *
 * Exportado porque a tela de sessão precisa da MESMA definição ao retomar um
 * treino: o lembrete de treino não finalizado parte da última atividade real,
 * e derivá-la de novo lá abriria espaço para as duas contas divergirem.
 */
export function ultimaAtividade(exercises: DraftExercise[]): number {
  let max = 0;
  for (const ex of exercises) {
    for (const s of ex.sets ?? []) {
      if (s.done && s.completedAt && s.completedAt > max) max = s.completedAt;
    }
  }
  return max;
}

/**
 * Depois de quanto tempo parado um treino aberto deixa de ser "em andamento".
 *
 * Três horas: um treino longo com pausa para o almoço ainda é o mesmo treino;
 * o que se abriu ontem à noite, não.
 */
export const LIMITE_SESSAO_ATIVA_MS = 3 * 60 * 60 * 1000;

/** A sessão ainda está em curso (vs. esquecida aberta)? */
export function sessaoAtiva(s: InProgressSession, agora = Date.now()): boolean {
  return agora - s.lastActivityAt < LIMITE_SESSAO_ATIVA_MS;
}

/** Rascunho do treino livre, quando existe e tem alguma série lançada. */
function doLivre(d: FreeSessionDraft | null): InProgressSession | null {
  if (!d || !d.exercises.length) return null;
  const { done, total } = contaSeries(d.exercises);
  return {
    mode: "free",
    route: "/app/user/treino-livre/sessao",
    startedAt: d.startedAt ?? 0,
    lastActivityAt: Math.max(d.startedAt ?? 0, ultimaAtividade(d.exercises)),
    doneSets: done,
    totalSets: total,
    currentExercise: exercicioAtual(d.exercises, d.currentIndex ?? 0),
    planId: null,
    dayIndex: null,
    restEndsAt: d.restEndsAt ?? null,
  };
}

/** Rascunhos prescritos: uma chave por plano+dia, então é preciso varrer. */
function doPrescrito(): InProgressSession[] {
  const out: InProgressSession[] = [];
  let chaves: string[];
  try {
    chaves = Object.keys(localStorage);
  } catch {
    return out; // modo privado / storage bloqueado
  }
  for (const k of chaves) {
    if (!k.startsWith(PREFIX) || k === `${PREFIX}free`) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(k) || "null") as SessionDraft | null;
      if (parsed?.version !== 1 || !Array.isArray(parsed.exercises) || !parsed.exercises.length) continue;
      // Só interessa quem já lançou alguma série: abrir a tela e sair na hora
      // grava um rascunho zerado, e avisar sobre ele seria ruído.
      const { done, total } = contaSeries(parsed.exercises);
      if (done === 0) continue;
      out.push({
        mode: "plan",
        route: `/app/user/treino/${parsed.planId}/${parsed.dayIndex}`,
        startedAt: parsed.startedAt ?? 0,
        lastActivityAt: Math.max(parsed.startedAt ?? 0, ultimaAtividade(parsed.exercises)),
        doneSets: done,
        totalSets: total,
        currentExercise: exercicioAtual(parsed.exercises, parsed.currentIndex ?? 0),
        planId: parsed.planId,
        dayIndex: parsed.dayIndex,
        restEndsAt: parsed.restEndsAt ?? null,
      });
    } catch {
      /* rascunho corrompido — ignora, nunca derruba a Hoje */
    }
  }
  return out;
}

/**
 * O treino aberto mais recente, ou null. Quando há mais de um (ficha em um dia,
 * livre em outro), vence o que começou por último: é o que a pessoa lembra.
 */
export function findInProgressSession(): InProgressSession | null {
  const livre = doLivre(loadFreeDraft());
  const todos = doPrescrito();
  if (livre && livre.doneSets > 0) todos.push(livre);
  if (!todos.length) return null;
  return todos.sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** Descarta o rascunho da sessão indicada ("Encerrar treino"). */
export function discardInProgressSession(s: InProgressSession): void {
  if (s.mode === "free") {
    clearFreeDraft();
    return;
  }
  if (s.planId != null && s.dayIndex != null) clearDraft(s.planId, s.dayIndex);
}

/** Exportado só para teste: confere que a chave lida é a mesma que a gravada. */
export const __draftKey = draftKey;
