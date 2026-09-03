import { newClientKey } from "../../pages/user/workoutSession/sessionDraft";
import type { PontoBruto } from "./gpsFilter";
import type { Activity } from "./types";

/**
 * Rascunho da atividade em andamento (SPEC Mobile P2 §35/§36).
 *
 * ## O que estava errado
 *
 * A rota de uma corrida vivia SÓ no estado do React até o toque em "Finalizar".
 * O `localStorage` só era escrito no fim. Isso significa que fechar o app,
 * receber uma ligação que mate o processo, ou um crash em qualquer ponto de uma
 * corrida de uma hora apagava a corrida inteira — não parte dela, ela toda. A
 * §36 é explícita: "não guardar toda a rota apenas em memória até o final".
 *
 * É o mesmo defeito que a P0 corrigiu no treino, na mesma forma, e a solução é
 * a mesma: gravar a cada evento relevante, com instantes ABSOLUTOS, para que
 * reabrir reconstrua o estado em vez de recontá-lo.
 *
 * ## Por que instante absoluto e não contador
 *
 * `startedAt` e a lista de pausas guardam quando as coisas aconteceram. A
 * duração é DERIVADA na leitura. Um contador de segundos incrementado por
 * `setInterval` congela junto com o JS quando a tela apaga, e voltaria com o
 * cronômetro atrasado exatamente pelo tempo em que a pessoa continuou correndo.
 *
 * ## Uma atividade por aparelho
 *
 * Chave FIXA, mesma regra do treino livre: no máximo uma atividade em
 * andamento. Começar outra exige retomar ou descartar a aberta — é o que impede
 * "iniciei e esqueci" de virar duas corridas no histórico.
 */

const CHAVE = "s2core:activity:draft";

/** Um intervalo de pausa. `fim` null = pausa em curso. */
export interface Pausa {
  inicio: number;
  fim: number | null;
}

export interface ActivityDraft {
  version: 1;
  /** Idempotência ponta a ponta do envio final. */
  clientKey: string;
  tipo: Activity["type"];
  /** Instante de início (ms). */
  startedAt: number;
  /** Pontos BRUTOS, como o GPS entregou. O filtro roda na leitura. */
  pontos: PontoBruto[];
  pausas: Pausa[];
  /** Última gravação — diagnóstico de quão fresco é o rascunho. */
  atualizadoEm: number;
}

export function novoRascunho(tipo: Activity["type"], agora = Date.now()): ActivityDraft {
  return {
    version: 1,
    clientKey: newClientKey(),
    tipo,
    startedAt: agora,
    pontos: [],
    pausas: [],
    atualizadoEm: agora,
  };
}

export function carregarRascunho(): ActivityDraft | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;
    const p = JSON.parse(raw) as ActivityDraft;
    if (p?.version !== 1 || !Array.isArray(p.pontos) || !Array.isArray(p.pausas)) return null;
    if (!p.tipo || !Number.isFinite(p.startedAt)) return null;
    // Rascunho sem chave não é descartado: perder a atividade é pior que perder
    // a idempotência de um envio que ainda nem aconteceu.
    return p.clientKey ? p : { ...p, clientKey: newClientKey() };
  } catch {
    return null;
  }
}

export function gravarRascunho(d: ActivityDraft): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...d, atualizadoEm: Date.now() }));
  } catch {
    /* quota/modo privado: o rascunho é best-effort, a atividade em memória segue */
  }
}

export function limparRascunho(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* silencioso */
  }
}

/** Acrescenta um ponto e grava. É o coração do crash safety (§36). */
export function acrescentarPonto(d: ActivityDraft, ponto: PontoBruto): ActivityDraft {
  const novo = { ...d, pontos: [...d.pontos, ponto] };
  gravarRascunho(novo);
  return novo;
}

export function pausar(d: ActivityDraft, agora = Date.now()): ActivityDraft {
  if (estaPausada(d)) return d;
  const novo = { ...d, pausas: [...d.pausas, { inicio: agora, fim: null }] };
  gravarRascunho(novo);
  return novo;
}

export function retomar(d: ActivityDraft, agora = Date.now()): ActivityDraft {
  if (!estaPausada(d)) return d;
  const pausas = d.pausas.map((p, i) =>
    i === d.pausas.length - 1 && p.fim == null ? { ...p, fim: agora } : p,
  );
  const novo = { ...d, pausas };
  gravarRascunho(novo);
  return novo;
}

export function estaPausada(d: ActivityDraft): boolean {
  const ultima = d.pausas[d.pausas.length - 1];
  return !!ultima && ultima.fim == null;
}

/** Total pausado em ms. Pausa em curso conta até `agora`. */
export function tempoPausadoMs(d: ActivityDraft, agora = Date.now()): number {
  return d.pausas.reduce((soma, p) => soma + ((p.fim ?? agora) - p.inicio), 0);
}

/**
 * Duração ATIVA em segundos — tempo de parede menos as pausas.
 *
 * É esta que vai para o pace (§30) e para o registro. O tempo de parede
 * interessa só para saber há quanto tempo a pessoa saiu de casa.
 */
export function duracaoAtivaS(d: ActivityDraft, agora = Date.now()): number {
  const parede = agora - d.startedAt;
  return Math.max(0, Math.round((parede - tempoPausadoMs(d, agora)) / 1000));
}

/** Duração de parede em segundos (início até agora, pausas incluídas). */
export function duracaoParedeS(d: ActivityDraft, agora = Date.now()): number {
  return Math.max(0, Math.round((agora - d.startedAt) / 1000));
}

/**
 * Depois de quanto tempo sem gravação uma atividade aberta deixa de ser "em
 * andamento". Mesma ideia da sessão de treino (P1), com janela mais curta:
 * ninguém caminha 6 horas, e um rascunho desse tamanho é quase certamente
 * esquecimento.
 */
export const LIMITE_ATIVIDADE_ATIVA_MS = 6 * 60 * 60 * 1000;

export function atividadeAtiva(d: ActivityDraft, agora = Date.now()): boolean {
  return agora - d.atualizadoEm < LIMITE_ATIVIDADE_ATIVA_MS;
}
