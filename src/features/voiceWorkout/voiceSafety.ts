/**
 * Safety mínimo do Voice Workout (P5B).
 *
 * NÃO é o classificador completo da P5D — é uma checagem determinística por
 * léxico que decide UMA coisa: essa observação merece parar a automação e
 * pedir atenção, em vez de ser tratada como comentário banal? Nunca
 * diagnostica, nunca decide sozinha — só interrompe e devolve a decisão para
 * a pessoa ("pare o exercício e verifique").
 */

const SINAIS_DE_ATENCAO = [
  "dor no peito",
  "aperto no peito",
  "tontura",
  "tonto",
  "tonta",
  "falta de ar",
  "quase desmaiei",
  "desmaiar",
  "vou desmaiar",
  "dor muito forte",
  "dor insuportavel",
];

/** Remove acentos/caixa — mesma normalização leve do parser, sem depender dele. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** A observação contém um relato que merece pausar a automação e pedir atenção? */
export function hasAttentionSignal(texto: string): boolean {
  const normalizado = normalizar(texto);
  return SINAIS_DE_ATENCAO.some((sinal) => normalizado.includes(sinal));
}

/** Frase neutra, sem diagnóstico — nunca nomeia uma condição clínica. */
export const ATTENTION_SIGNAL_MESSAGE =
  "Entendi. Se você está sentindo isso agora, pare o exercício e procure ajuda de alguém na academia. Registrei o seu relato — diga de novo se quiser confirmar a série.";
