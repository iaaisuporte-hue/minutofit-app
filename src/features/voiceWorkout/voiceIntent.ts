/**
 * Parser determinístico de comandos de voz (P5B).
 *
 * Função pura: nenhuma dependência de React, Capacitor ou rede. Recebe o
 * transcript (+ um contexto mínimo e opcional da sessão) e devolve uma
 * intent tipada ou `null`. Regra de ouro do produto (mesma do motor de
 * substituição): decisão por REGRA, nunca por IA — o fallback pra LLM
 * (P5D) recebe o mesmo schema de saída, nunca acesso a dado.
 *
 * Ordem de correspondência (evita ambiguidade — ver plano P5 §7):
 *   1. diálogo (confirmar/negar/repetir/ajuda/desfazer/desligar)
 *   2. finalizar treino (crítico)
 *   3. observação explícita ("anota que…")
 *   4. substituição de exercício
 *   5. comandos de descanso
 *   6. consultas (somente leitura)
 *   7. navegação
 *   8. carga/reps avulsos (sem concluir)
 *   9. concluir série (com observação embutida opcional)
 *  10. nada reconhecido → null
 */

// ── Intents ──────────────────────────────────────────────────────────────

export type ReplacementReason = "equipment_unavailable" | "pain_discomfort" | "other";

export type VoiceIntent =
  | { type: "complete_set"; reps: number | null; loadKg: number | null; targetReps?: number | null; observation: string | null }
  | { type: "set_load"; loadKg: number }
  | { type: "set_reps"; reps: number }
  | { type: "next_exercise" }
  | { type: "previous_exercise" }
  | { type: "go_to_exercise"; nameQuery: string; matches: string[] }
  | { type: "pause_rest" }
  | { type: "resume_rest" }
  | { type: "skip_rest" }
  | { type: "extend_rest"; seconds: 15 | 30 }
  | { type: "query_current_exercise" }
  | { type: "query_current_set" }
  | { type: "query_next_exercise" }
  | { type: "query_workout_elapsed" }
  | { type: "query_rest_remaining" }
  | { type: "query_previous_load" }
  | { type: "query_previous_reps" }
  | { type: "add_observation"; observation: string }
  | { type: "request_exercise_substitution"; reason: ReplacementReason }
  | { type: "finish_workout" }
  | { type: "confirm" }
  | { type: "deny" }
  | { type: "repeat" }
  | { type: "help" }
  | { type: "undo" }
  | { type: "voice_off" };

export interface VoiceParseContext {
  /** Nomes dos exercícios da sessão — universo de `go_to_exercise`. */
  sessionExerciseNames?: string[];
  /** Prescrição da série atual ("10-12", "12"…), para decidir "10 de 12". */
  plannedReps?: string | null;
}

export interface VoiceParseResult {
  intent: VoiceIntent | null;
  /** Transcript normalizado (sem acento/pontuação), seguro para telemetria. */
  normalized: string;
}

// ── Normalização e números ──────────────────────────────────────────────

const NUMEROS_POR_EXTENSO: Record<string, number> = {
  zero: 0, uma: 1, um: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100,
};

/** Prefixos de wake word residual — sem wake word real ainda (P5C), mas a
 *  gramática já tolera se o STT capturar algo antes do PTT abrir. */
const PREFIXOS_WAKE_WORD = ["s2core", "s2 core", "esse dois core", "ei s2core", "ei s2 core"];

/** Remove acentos e baixa a caixa — mesma normalização para toda a gramática. */
function normalizar(texto: string): string {
  let t = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Pontuação vira espaço, EXCETO vírgula/ponto decimal ("27,5") — sem o
    // lookahead, "com 27,5" virava os tokens "27" e "5" separados, perdendo
    // a casa decimal.
    .replace(/[.,!?](?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const prefixo of PREFIXOS_WAKE_WORD) {
    if (t.startsWith(`${prefixo} `)) {
      t = t.slice(prefixo.length).trim();
      break;
    }
    if (t === prefixo) t = "";
  }
  return t;
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
 * tokens, incluindo sufixos "e meio"/"e meia" (+0,5) e "vírgula N" (decimal).
 * Devolve o valor e quantos tokens consumiu, para o chamador avançar.
 */
function lerNumero(tokens: string[], start: number): { valor: number; consumidos: number } | null {
  const primeiro = tokens[start];
  if (primeiro == null) return null;

  let valor: number | null = null;
  let consumidos = 0;

  if (/^\d+([.,]\d+)?$/.test(primeiro)) {
    valor = Number(primeiro.replace(",", "."));
    consumidos = 1;
  } else if (tokens[start + 1] === "e" && tokens[start + 2] != null) {
    // três tokens: "vinte e oito"
    const composto = numeroPorExtenso(`${primeiro} e ${tokens[start + 2]}`);
    if (composto != null) {
      valor = composto;
      consumidos = 3;
    }
  }
  if (valor == null) {
    const simples = numeroPorExtenso(primeiro);
    if (simples == null) return null;
    valor = simples;
    consumidos = 1;
  }

  // Sufixo "e meio"/"e meia" — "vinte e oito e meio" (a composição de dezena
  // já consumiu o primeiro "e"; este é um segundo "e", depois do número).
  if (tokens[start + consumidos] === "e" && (tokens[start + consumidos + 1] === "meio" || tokens[start + consumidos + 1] === "meia")) {
    valor += 0.5;
    consumidos += 2;
  } else if (tokens[start + consumidos] === "virgula" && tokens[start + consumidos + 1] != null) {
    // "vinte e sete vírgula cinco" → 27.5
    const casaDecimal = lerNumero(tokens, start + consumidos + 1);
    if (casaDecimal && casaDecimal.consumidos === 1 && casaDecimal.valor < 10) {
      valor += casaDecimal.valor / 10;
      consumidos += 1 + casaDecimal.consumidos;
    }
  }

  return { valor, consumidos };
}

/**
 * Todos os inteiros de um texto livre — "10-12" → [10, 12], "até a falha" →
 * []. Usado para casar "fiz N de M" contra QUALQUER ponta do intervalo
 * prescrito, não só o primeiro número (diferente de `primeiroNumero` em
 * `setSteppers.ts`, que decide o valor de PARTIDA do stepper — pergunta
 * diferente da que este parser faz, que é "M é uma meta plausível?").
 */
function numerosDoTexto(texto: string | null | undefined): number[] {
  if (!texto) return [];
  const m = texto.match(/\d+/g);
  return m ? m.map(Number) : [];
}

const UNIDADES_CARGA = new Set(["kg", "kilo", "kilos", "quilo", "quilos"]);
const UNIDADES_REPS = new Set(["reps", "repeticoes", "repeticao"]);

// ── Palavras-chave de cada categoria ─────────────────────────────────────

const PALAVRAS_CONFIRMAR = new Set(["sim", "confirma", "confirmo", "isso", "pode", "exato", "positivo"]);
const PALAVRAS_NEGAR = new Set(["nao", "cancela", "cancelar", "negativo"]);
const PALAVRAS_REPETIR = new Set(["repete", "repetir"]);
const PALAVRAS_AJUDA = new Set(["ajuda", "ajudar", "comandos"]);
const PALAVRAS_DESFAZER = new Set(["desfaz", "desfazer"]);

function contemTodos(tokens: string[], termos: string[]): boolean {
  return termos.every((t) => tokens.includes(t));
}
function contemAlgum(tokens: string[], termos: string[]): boolean {
  return termos.some((t) => tokens.includes(t));
}
function comecaComPrefixo(tokens: string[], termos: string[]): string | null {
  return termos.find((t) => tokens[0] === t) ?? null;
}

/**
 * Índice do primeiro token de uma cláusula de observação embutida
 * ("fiz 10 porque senti uma fisgada" / "fiz 8 com 30, estava pesado
 * demais"), ou `-1` quando a frase não tem uma.
 */
const PALAVRAS_CLAUSULA_OBSERVACAO = ["porque", "mas", "estava", "senti", "sentindo", "pois"];
function indiceClausulaObservacao(tokens: string[]): number {
  for (let i = 1; i < tokens.length; i++) {
    if (PALAVRAS_CLAUSULA_OBSERVACAO.includes(tokens[i])) return i;
  }
  return -1;
}

// ── Parser principal ──────────────────────────────────────────────────────

export function parseVoiceCommand(transcript: string, ctx: VoiceParseContext = {}): VoiceParseResult {
  const normalized = normalizar(transcript);
  const tokens = normalized.split(" ").filter(Boolean);
  // Tokens "crus" (mesmo split, sem normalizar caixa/acento) — usados só para
  // reconstruir o RELATO original de uma observação, preservando o que a
  // pessoa disse em vez da versão ASCII em minúsculas usada para casar regra.
  const tokensOriginais = transcript.trim().split(/\s+/);

  if (tokens.length === 0) return { intent: null, normalized };

  // 1. Diálogo — frases curtas, checadas primeiro para não colidir com a
  // gramática numérica ("sim" não é confundido com nada abaixo).
  if (tokens.length <= 2) {
    if (tokens.some((t) => PALAVRAS_CONFIRMAR.has(t))) return { intent: { type: "confirm" }, normalized };
    if (tokens.some((t) => PALAVRAS_NEGAR.has(t))) return { intent: { type: "deny" }, normalized };
    if (tokens.some((t) => PALAVRAS_REPETIR.has(t))) return { intent: { type: "repeat" }, normalized };
    if (tokens.some((t) => PALAVRAS_AJUDA.has(t))) return { intent: { type: "help" }, normalized };
    if (tokens.some((t) => PALAVRAS_DESFAZER.has(t))) return { intent: { type: "undo" }, normalized };
  }
  if (contemTodos(tokens, ["desliga", "voz"]) || contemTodos(tokens, ["desligar", "voz"]) || contemTodos(tokens, ["desativa", "voz"])) {
    return { intent: { type: "voice_off" }, normalized };
  }

  // 2. Finalizar treino — crítico, checado antes de qualquer outra coisa que
  // possa conter "treino"/"exercício" no meio.
  if (
    (tokens.some((t) => t.startsWith("finaliz")) || tokens.some((t) => t.startsWith("encerr"))) &&
    tokens.includes("treino")
  ) {
    return { intent: { type: "finish_workout" }, normalized };
  }

  // 3. Observação explícita — "anota (que/aí)? …", "registra observação …".
  const prefixoObservacao = comecaComPrefixo(tokens, ["anota", "anote", "registra", "registre"]);
  if (prefixoObservacao) {
    let resto = tokensOriginais.slice(1);
    // pula "que"/"aí" logo depois do verbo, sem exigir presença
    const primeiroRestoNormalizado = tokens[1];
    if (primeiroRestoNormalizado === "que" || primeiroRestoNormalizado === "ai") resto = resto.slice(1);
    const observation = resto.join(" ").trim().slice(0, 280);
    if (observation) return { intent: { type: "add_observation", observation }, normalized };
  }

  // 4. Substituição de exercício.
  const mencionaEquipamento = contemAlgum(tokens, ["maquina", "aparelho", "banco", "equipamento", "barra"]);
  const mencionaIndisponivel =
    contemAlgum(tokens, ["ocupada", "ocupado"]) || tokens.some((t) => t.startsWith("quebr"));
  const mencionaTroca = contemAlgum(tokens, ["troca", "trocar", "substitui", "substituir"]);
  const mencionaDor =
    contemAlgum(tokens, ["dor", "incomodo", "incomodou", "desconforto"]) || tokens.some((t) => t.startsWith("doe"));
  if ((mencionaEquipamento && mencionaIndisponivel) || mencionaTroca) {
    const reason: ReplacementReason = mencionaDor
      ? "pain_discomfort"
      : mencionaEquipamento && mencionaIndisponivel
        ? "equipment_unavailable"
        : "other";
    return { intent: { type: "request_exercise_substitution", reason }, normalized };
  }

  // 5. Descanso.
  if (tokens.includes("mais") && contemAlgum(tokens, ["segundos", "segundo"])) {
    const idxMais = tokens.indexOf("mais");
    const numero = lerNumero(tokens, idxMais + 1);
    if (numero && (numero.valor === 15 || numero.valor === 30)) {
      return { intent: { type: "extend_rest", seconds: numero.valor as 15 | 30 }, normalized };
    }
  }
  if (tokens.some((t) => t.startsWith("pausa")) || tokens.some((t) => t.startsWith("pause"))) {
    return { intent: { type: "pause_rest" }, normalized };
  }
  if (tokens.some((t) => t.startsWith("retoma")) || tokens.some((t) => t.startsWith("continu"))) {
    return { intent: { type: "resume_rest" }, normalized };
  }
  if (tokens.some((t) => t.startsWith("pula")) || tokens.some((t) => t.startsWith("pular"))) {
    return { intent: { type: "skip_rest" }, normalized };
  }

  // 6. Consultas (somente leitura) — sempre com palavra de pergunta. Ordem
  // das MAIS específicas para as MAIS genéricas: "qual minha última carga
  // nesse EXERCÍCIO" contém "exercício", mas é sobre carga, não sobre qual
  // exercício é — se o check genérico viesse primeiro, ele venceria errado.
  const perguntando = contemAlgum(tokens, ["qual", "quais", "que", "quanto", "quantas", "quantos", "quem"]);
  if (perguntando) {
    if (tokens.includes("carga") && (tokens.includes("ultima") || tokens.includes("anterior"))) {
      return { intent: { type: "query_previous_load" }, normalized };
    }
    if (contemAlgum(tokens, ["reps", "repeticoes"]) && tokens.includes("anterior")) {
      return { intent: { type: "query_previous_reps" }, normalized };
    }
    if (contemAlgum(tokens, ["tempo", "minutos"]) && contemAlgum(tokens, ["treino", "treinando"])) {
      return { intent: { type: "query_workout_elapsed" }, normalized };
    }
    if (tokens.includes("falta")) {
      return { intent: { type: "query_rest_remaining" }, normalized };
    }
    if (tokens.includes("proximo")) {
      return { intent: { type: "query_next_exercise" }, normalized };
    }
    if (tokens.includes("serie") && !tokens.includes("anterior")) {
      return { intent: { type: "query_current_set" }, normalized };
    }
    if (contemAlgum(tokens, ["exercicio"])) {
      return { intent: { type: "query_current_exercise" }, normalized };
    }
  }

  // 7. Navegação — imperativa, sem palavra de pergunta (senão já teria caído
  // no bloco de consultas acima).
  if (tokens[0] === "vai" || tokens[0] === "ir") {
    // "vai para o supino" / "vai pro leg press" — o resto vira a busca.
    let resto = tokens.slice(1);
    if (resto[0] === "para" || resto[0] === "pra" || resto[0] === "pro") resto = resto.slice(1);
    if (resto[0] === "o" || resto[0] === "a") resto = resto.slice(1);
    const nameQuery = resto.join(" ").trim();
    if (nameQuery) {
      const nomes = ctx.sessionExerciseNames ?? [];
      const matches = nomes.filter((n) => normalizar(n).includes(nameQuery));
      return { intent: { type: "go_to_exercise", nameQuery, matches }, normalized };
    }
  }
  if (tokens.includes("proximo") || tokens.includes("avanca") || tokens.includes("avancar") || tokens.includes("seguinte")) {
    return { intent: { type: "next_exercise" }, normalized };
  }
  if (tokens.includes("anterior") || (tokens[0] === "volta" && tokens.length <= 3)) {
    return { intent: { type: "previous_exercise" }, normalized };
  }

  // 8. Carga/reps avulsos (sem verbo de conclusão).
  const verboAjusteCarga = comecaComPrefixo(tokens, ["coloca", "sobe", "subi", "baixa", "diminui", "aumenta"]);
  if (verboAjusteCarga) {
    let i = 1;
    if (tokens[i] === "para" || tokens[i] === "pra") i += 1;
    const numero = lerNumero(tokens, i);
    if (numero) {
      const fim = i + numero.consumidos;
      if (UNIDADES_REPS.has(tokens[fim] ?? "")) {
        return { intent: { type: "set_reps", reps: Math.round(numero.valor) }, normalized };
      }
      return { intent: { type: "set_load", loadKg: numero.valor }, normalized };
    }
  }
  // "30 quilos" bare — número seguido de unidade de carga, sem verbo de
  // conclusão em lugar nenhum da frase.
  {
    const numero = lerNumero(tokens, 0);
    if (numero && UNIDADES_CARGA.has(tokens[numero.consumidos] ?? "")) {
      const temVerboConclusao = contemAlgum(tokens, ["fiz", "consegui", "completei", "terminei"]);
      if (!temVerboConclusao) return { intent: { type: "set_load", loadKg: numero.valor }, normalized };
    }
  }

  // 9. Concluir série — "fiz 12 com 28 quilos" / "12 com 28" / "só 12" /
  // "concluir série" / com observação embutida.
  {
    const idxClausula = indiceClausulaObservacao(tokens);
    const tokensComando = idxClausula === -1 ? tokens : tokens.slice(0, idxClausula);
    const observation =
      idxClausula === -1 ? null : tokensOriginais.slice(idxClausula).join(" ").trim().slice(0, 280) || null;

    if (contemTodos(tokensComando, ["concluir", "serie"]) || contemTodos(tokensComando, ["concluiu", "serie"])) {
      return { intent: { type: "complete_set", reps: null, loadKg: null, observation }, normalized };
    }

    let i = 0;
    if (["fiz", "consegui", "completei", "terminei"].includes(tokensComando[i])) i += 1;
    if (["so", "somente", "apenas"].includes(tokensComando[i])) i += 1;

    const reps = lerNumero(tokensComando, i);
    if (!reps) return { intent: null, normalized };
    i += reps.consumidos;

    if (UNIDADES_REPS.has(tokensComando[i] ?? "")) i += 1;

    let loadKg: number | null = null;
    let targetReps: number | null = null;
    if (tokensComando[i] === "com" || tokensComando[i] === "de") {
      const marcador = tokensComando[i];
      const proximoToken = tokensComando[i + 1];
      if (proximoToken != null) {
        const segundo = lerNumero(tokensComando, i + 1);
        if (segundo) {
          const fimSegundo = i + 1 + segundo.consumidos;
          const temUnidadeCarga = UNIDADES_CARGA.has(tokensComando[fimSegundo] ?? "");
          const numerosAlvo = numerosDoTexto(ctx.plannedReps);
          // "10 de 12": sem unidade de carga e o segundo número bate com
          // QUALQUER ponta da prescrição ("10-12" → 10 ou 12) → é a META de
          // reps, não carga. "10 de 30 quilos" (ou sem prescrição
          // correspondente) continua sendo carga.
          if (marcador === "de" && !temUnidadeCarga && numerosAlvo.includes(Math.round(segundo.valor))) {
            targetReps = segundo.valor;
            i = fimSegundo;
          } else {
            loadKg = segundo.valor;
            i = fimSegundo;
            if (temUnidadeCarga) i += 1;
          }
        }
      }
    }

    return { intent: { type: "complete_set", reps: reps.valor, loadKg, targetReps, observation }, normalized };
  }
}
