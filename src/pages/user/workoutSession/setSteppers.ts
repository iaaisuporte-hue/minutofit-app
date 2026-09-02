// Ajuste de carga e repetições por TOQUE, sem teclado (SPEC P1 §7 e §10).
//
// O motivo é medido: registrar a primeira série a partir da Home custava 7
// interações, e duas delas eram digitação. Digitar no meio da academia, com a
// mão suada e o teclado cobrindo metade da tela, é o gesto mais caro do fluxo.
//
// Funções puras de propósito: a regra de "de onde parte o primeiro toque" é o
// que faz o stepper valer a pena, e ela precisa ser testável sem montar a tela.

/** Passos de carga. 2,5 kg é o menor par de anilhas comum; 5 kg é o salto. */
export const PASSOS_CARGA = [2.5, 5] as const;

/** Teto defensivo: carga acima disto é erro de digitação, não treino. */
const CARGA_MAX = 999;
const REPS_MAX = 999;

/**
 * Arredonda para 1 casa e remove o ".0" — 82.5 fica "82.5", 80.0 fica "80".
 * O campo é texto e vai para o servidor como veio; sujeira aqui vira sujeira
 * no histórico.
 */
function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

function parse(v: string): number | null {
  if (v == null) return null;
  const t = String(v).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Valor de partida da carga quando o campo está vazio.
 *
 * Ordem deliberada: a carga da série anterior DESTE treino vence a do último
 * treino. Quem já subiu o peso na série 1 de hoje não quer o número da semana
 * passada de volta na série 2.
 */
export function cargaInicial(opts: {
  atual: string;
  cargaSerieAnterior?: string | null;
  ultimaCarga?: number | null;
}): number {
  const atual = parse(opts.atual);
  if (atual != null) return atual;
  const anterior = parse(opts.cargaSerieAnterior ?? "");
  if (anterior != null) return anterior;
  if (opts.ultimaCarga != null && Number.isFinite(opts.ultimaCarga)) return opts.ultimaCarga;
  return 0;
}

/**
 * Aplica um passo de carga. Nunca desce abaixo de zero — carga negativa não
 * existe, e o toque a mais no "−" não deve quebrar o campo.
 */
export function passoCarga(
  valorAtual: number,
  delta: number,
): string {
  const n = Math.min(CARGA_MAX, Math.max(0, valorAtual + delta));
  return fmt(n);
}

/**
 * Valor de partida das repetições.
 *
 * Aqui a prescrição vence: "10-12" quer dizer que o alvo é 10, e é dali que a
 * pessoa ajusta para mais ou para menos. Sem prescrição legível, parte das reps
 * da série anterior deste treino.
 */
export function repsIniciais(opts: {
  atual: string;
  prescritas?: string | null;
  repsSerieAnterior?: string | null;
}): number {
  const atual = parse(opts.atual);
  if (atual != null) return atual;
  const alvo = primeiroNumero(opts.prescritas ?? "");
  if (alvo != null) return alvo;
  const anterior = parse(opts.repsSerieAnterior ?? "");
  if (anterior != null) return anterior;
  return 0;
}

/**
 * Primeiro número de uma prescrição livre: "10-12" → 10, "12" → 12,
 * "até a falha" → null. O personal escreve isto à mão, então o parser tem que
 * aceitar o que ele escreve, não o que gostaríamos que escrevesse.
 */
export function primeiroNumero(texto: string): number | null {
  const m = String(texto ?? "").match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Aplica um passo de repetições (inteiro, nunca negativo). */
export function passoReps(valorAtual: number, delta: number): string {
  const n = Math.min(REPS_MAX, Math.max(0, Math.round(valorAtual + delta)));
  return String(n);
}

/**
 * A série que o botão grande do rodapé opera: a primeira não concluída.
 * Devolve `null` quando o exercício acabou — aí o rodapé mostra outra ação.
 */
export function serieAtual<T extends { setIndex: number; done: boolean }>(
  sets: T[],
): T | null {
  return sets.find((s) => !s.done) ?? null;
}
