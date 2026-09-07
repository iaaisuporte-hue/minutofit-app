/**
 * Parser mínimo de comando de voz (P5A — fundação do Voice Workout).
 *
 * Escopo desta fase: provar o loop ponta a ponta com UMA frase —
 * "fiz 12 com 28" (e variações próximas: "12 com 28", "fiz 10 com 30 quilos").
 * A gramática completa (navegação, descanso, consultas, substituição,
 * observação classificada, confirmação de risco) é P5B — não antecipar aqui.
 *
 * Função pura: nenhuma dependência de React, Capacitor ou rede. Recebe o
 * transcript e devolve uma intent tipada ou `null` quando não reconhece nada
 * — quem chama decide o que fazer (repetir, cair para IA em fases futuras).
 */

export interface CompleteSetVoiceIntent {
  type: "complete_set";
  reps: number | null;
  loadKg: number | null;
}

export type VoiceIntent = CompleteSetVoiceIntent;

export interface VoiceParseResult {
  intent: VoiceIntent | null;
  /** Transcript já normalizado (sem acento/pontuação), útil para telemetria sem PII. */
  normalized: string;
}

const NUMEROS_POR_EXTENSO: Record<string, number> = {
  zero: 0, uma: 1, um: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100,
};

/** Remove acentos e baixa a caixa — mesma normalização para toda a gramática. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Pontuação vira espaço, EXCETO vírgula/ponto decimal ("27,5") — sem o
    // lookahead, "com 27,5" virava os tokens "27" e "5" separados, perdendo
    // a casa decimal.
    .replace(/[.,!?](?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "vinte e oito" → 28, "trinta" → 30, "doze" → 12. Só compostos com "e"
 * (dezenas + unidade); não tenta centenas compostas — fora do que a gramática
 * mínima precisa (carga/reps de treino raramente passam de 2 dígitos).
 */
function numeroPorExtenso(texto: string): number | null {
  const partes = texto.trim().split(/\s+/);
  if (partes.length === 1) {
    const n = NUMEROS_POR_EXTENSO[partes[0]];
    return n ?? null;
  }
  if (partes.length === 3 && partes[1] === "e") {
    const dezena = NUMEROS_POR_EXTENSO[partes[0]];
    const unidade = NUMEROS_POR_EXTENSO[partes[2]];
    if (dezena != null && unidade != null && dezena >= 20 && unidade < 10) return dezena + unidade;
  }
  return null;
}

/**
 * Extrai um número (dígito ou extenso) a partir de uma posição na string de
 * tokens. Devolve o valor e quantos tokens consumiu, para o chamador avançar.
 */
function lerNumero(tokens: string[], start: number): { valor: number; consumidos: number } | null {
  const primeiro = tokens[start];
  if (primeiro == null) return null;

  if (/^\d+([.,]\d+)?$/.test(primeiro)) {
    return { valor: Number(primeiro.replace(",", ".")), consumidos: 1 };
  }

  // três tokens: "vinte e oito"
  if (tokens[start + 1] === "e" && tokens[start + 2] != null) {
    const composto = numeroPorExtenso(`${primeiro} e ${tokens[start + 2]}`);
    if (composto != null) return { valor: composto, consumidos: 3 };
  }

  const simples = numeroPorExtenso(primeiro);
  if (simples != null) return { valor: simples, consumidos: 1 };

  return null;
}

const UNIDADES_CARGA = new Set(["kg", "kilo", "kilos", "quilo", "quilos"]);

/**
 * "fiz 12 com 28 quilos" / "12 com 28" / "fiz 10 com 30 quilos" / "só 12".
 *
 * Gramática: [fiz|consegui|completei]? <reps> [reps|repeticoes]? [com|de] <carga> [kg|quilos]?
 * Números sem "com/de" depois viram só reps ("fiz 12"), sem carga.
 */
export function parseVoiceCommand(transcript: string): VoiceParseResult {
  const normalized = normalizar(transcript);
  const tokens = normalized.split(" ").filter(Boolean);

  let i = 0;
  if (tokens[i] === "fiz" || tokens[i] === "consegui" || tokens[i] === "completei") i += 1;
  if (tokens[i] === "so" || tokens[i] === "somente" || tokens[i] === "apenas") i += 1;

  const reps = lerNumero(tokens, i);
  if (!reps) return { intent: null, normalized };
  i += reps.consumidos;

  if (tokens[i] === "reps" || tokens[i] === "repeticoes") i += 1;

  let loadKg: number | null = null;
  if (tokens[i] === "com" || tokens[i] === "de") {
    const proximoToken = tokens[i + 1];
    // "com" antes de outro número é carga; "com" antes de qualquer outra
    // coisa não faz parte desta gramática mínima (observação, etc.) — não
    // reconhecer é melhor que reconhecer errado.
    if (proximoToken != null) {
      const carga = lerNumero(tokens, i + 1);
      if (carga) {
        loadKg = carga.valor;
        i += 1 + carga.consumidos;
        if (UNIDADES_CARGA.has(tokens[i] ?? "")) i += 1;
      }
    }
  }

  return {
    intent: { type: "complete_set", reps: reps.valor, loadKg },
    normalized,
  };
}
