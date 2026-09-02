// "Repetir último treino" (SPEC P1 §24).
//
// A regra que a SPEC impõe e que decide o desenho: **criar nova sessão**, sem
// duplicar histórico antigo. Então nada aqui grava — a função só monta o ponto
// de partida e devolve para onde navegar. A gravação continua sendo a mesma
// do fim da sessão, com as mesmas proteções de idempotência do P0.
//
// Dois caminhos, porque o histórico tem duas naturezas:
//
//  - Sessão de FICHA (`source: personal`): a estrutura ainda existe do outro
//    lado, viva e possivelmente atualizada pelo personal. Repetir é abrir o
//    mesmo dia da ficha — e é deliberado que ele venha ATUALIZADO, não
//    congelado no que foi feito da última vez: quem manda no treino é quem
//    prescreve.
//  - Sessão LIVRE (`source: free`): não existe ficha nenhuma. A estrutura só
//    sobrevive no que foi executado, então é dali que ela é remontada.

import {
  newClientKey,
  saveFreeDraft,
  type DraftExercise,
  type DraftSetEntry,
} from "./sessionDraft";
import type { WorkoutSessionDetail, WorkoutSessionListItem } from "../../../services/workoutSessionApi";

export const FREE_SESSION_ROUTE = "/app/user/treino-livre/sessao";

/** O que a UI precisa saber para oferecer (ou não) a ação. */
export interface RepeatTarget {
  /** Rótulo do treino, para o botão: "Repetir Treino A · Peito + Tríceps". */
  title: string;
  /** Rota que abre a nova sessão. */
  route: string;
  kind: "plan" | "free";
}

/**
 * A sessão pode ser repetida?
 *
 * Sessão de ficha precisa de plano e dia; sessão livre precisa de séries para
 * remontar. `movement_lab` e retroativa ficam de fora: a primeira é a análise
 * de um exercício isolado, a segunda é um registro de algo feito fora do app —
 * nenhuma das duas é um treino para refazer.
 */
export function podeRepetir(s: WorkoutSessionListItem | null | undefined): boolean {
  if (!s) return false;
  if (s.isRetroactive) return false;
  if (s.source === "personal") return s.planId != null && s.dayIndex != null;
  if (s.source === "free") return s.setsDone > 0;
  return false;
}

/** Alvo de navegação para uma sessão de ficha. Não toca em armazenamento. */
export function alvoDePlano(s: WorkoutSessionListItem): RepeatTarget {
  return {
    title: s.title?.trim() || "último treino",
    route: `/app/user/treino/${s.planId}/${s.dayIndex}`,
    kind: "plan",
  };
}

/**
 * Reconstrói as séries de um exercício a partir do que foi EXECUTADO.
 *
 * As cargas entram como referência preenchida, não como fato: a pessoa vai
 * confirmar (ou ajustar) cada série de novo. É isso que a SPEC quer com
 * "carregar últimas cargas/repetições como referência" — repetir um treino não
 * é declarar que ele já foi feito.
 */
function seriesDe(
  linhas: { setIndex: number; plannedReps: string | null; repsDone: number | null; loadDoneKg: number | null }[],
): DraftSetEntry[] {
  return linhas
    .slice()
    .sort((a, b) => a.setIndex - b.setIndex)
    .map((l, i) => ({
      setIndex: i + 1,
      plannedReps: l.plannedReps ?? (l.repsDone != null ? String(l.repsDone) : ""),
      plannedRestS: null,
      // Pré-preenchido e NÃO marcado: é sugestão, não execução.
      loadKg: l.loadDoneKg != null ? String(l.loadDoneKg) : "",
      reps: l.repsDone != null ? String(l.repsDone) : "",
      done: false,
      restDoneS: null,
      completedAt: null,
    }));
}

/**
 * Monta os exercícios de um treino livre a partir da execução registrada.
 *
 * Descarta linha sem `exerciseId`: fichas e sessões referenciam
 * `exercises.id`, e um exercício só por nome seria rejeitado na gravação —
 * melhor sair da lista agora do que falhar no fim do treino.
 */
export function exerciciosDeSessaoLivre(detalhe: WorkoutSessionDetail): DraftExercise[] {
  const porExercicio = new Map<string, { nome: string; ordem: number; linhas: typeof detalhe.sets }>();

  for (const linha of detalhe.sets) {
    if (!linha.exerciseId) continue;
    if (linha.status !== "done") continue;
    const atual = porExercicio.get(linha.exerciseId);
    if (atual) atual.linhas.push(linha);
    else porExercicio.set(linha.exerciseId, { nome: linha.exerciseName, ordem: linha.orderIndex, linhas: [linha] });
  }

  return [...porExercicio.entries()]
    .sort((a, b) => a[1].ordem - b[1].ordem)
    .map(([id, v]) => ({
      exerciseId: id,
      name: v.nome,
      biSetGroupId: null,
      sets: seriesDe(v.linhas),
      bodyPart: null,
    }));
}

/**
 * Grava o rascunho de um treino livre repetido e devolve a rota.
 *
 * Retorna null quando não sobrou exercício aproveitável — a UI então explica,
 * em vez de abrir uma sessão vazia.
 */
export function prepararLivreRepetido(detalhe: WorkoutSessionDetail): RepeatTarget | null {
  const exercicios = exerciciosDeSessaoLivre(detalhe);
  if (exercicios.length === 0) return null;

  saveFreeDraft({
    version: 1,
    mode: "free",
    startedAt: Date.now(),
    currentIndex: 0,
    exercises: exercicios,
    restEndsAt: null,
    restForKey: null,
    // Chave NOVA: é outra sessão. Reaproveitar a antiga faria o servidor
    // devolver a sessão original como replay idempotente e o treino de hoje
    // nunca entraria no histórico.
    clientKey: newClientKey(),
  });

  return { title: detalhe.title?.trim() || "treino livre", route: FREE_SESSION_ROUTE, kind: "free" };
}
