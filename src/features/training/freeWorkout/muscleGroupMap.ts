/**
 * Tradução entre o `body_part` do catálogo (português, lowercase, como está no
 * banco) e o enum de grupo muscular que o servidor aceita em `muscleGroups`.
 *
 * O treino livre é montado pelo aluno escolhendo exercícios soltos — não há
 * grupo declarado em lugar nenhum. Ele é *derivado* do que foi escolhido, e o
 * servidor sanitiza contra o enum `chest|back|legs|shoulders|arms|core|
 * full_body|cardio|mobility`: qualquer coisa fora disso é descartada em
 * silêncio, então a conversão precisa acontecer aqui, antes do POST.
 *
 * TS puro de propósito — a regra que decide como um treino entra no histórico
 * não deveria depender de renderização para ser testada.
 */

import type { MuscleGroup } from "../../../pages/user/workoutHistory";

/** lowercase + sem acento: o catálogo tem "abdômen", "bíceps", "glúteo". */
function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const BODY_PART_TO_GROUP: Record<string, MuscleGroup> = {
  peito: "chest",
  costas: "back",
  perna: "legs",
  pernas: "legs",
  gluteo: "legs",
  gluteos: "legs",
  panturrilha: "legs",
  ombro: "shoulders",
  ombros: "shoulders",
  biceps: "arms",
  triceps: "arms",
  antebraco: "arms",
  braco: "arms",
  bracos: "arms",
  abdomen: "core",
  core: "core",
  cardio: "cardio",
  mobilidade: "mobility",
  aquecimento: "mobility",
  alongamento: "mobility",
};

/**
 * Grupo do servidor para um `body_part` do catálogo.
 *
 * O fallback é `full_body` e não uma exceção: o catálogo tem valores fora da
 * lista curada (`funcional`, por exemplo) e um exercício desconhecido não pode
 * impedir o aluno de treinar.
 */
export function bodyPartToServerGroup(bodyPart: string | null | undefined): MuscleGroup {
  return BODY_PART_TO_GROUP[normalize(bodyPart)] ?? "full_body";
}

/** Conta ocorrências preservando a ordem de primeira aparição (desempate estável). */
function countByFirstSeen<T extends string>(values: T[]): { value: T; count: number }[] {
  const order: T[] = [];
  const counts = new Map<T, number>();
  values.forEach((value) => {
    if (!counts.has(value)) order.push(value);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return order.map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

function rankByFrequency<T extends string>(values: T[]): T[] {
  return countByFirstSeen(values)
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.value);
}

/**
 * Grupos do servidor presentes na seleção, do mais ao menos frequente.
 *
 * Empate mantém a ordem em que o aluno escolheu — é o que ele reconhece como
 * "o treino de hoje". Lista vazia devolve `['full_body']` porque o histórico
 * precisa de pelo menos um grupo para exibir a sessão.
 */
export function deriveGroupsFromExercises(
  exercises: Array<{ bodyPart?: string | null }>,
): MuscleGroup[] {
  const groups = rankByFrequency(exercises.map((ex) => bodyPartToServerGroup(ex.bodyPart)));
  return groups.length ? groups : ["full_body"];
}

/** Rótulo PT-BR do `body_part` cru — é o que o aluno reconhece na ficha. */
const BODY_PART_LABEL_PT: Record<string, string> = {
  peito: "Peito",
  costas: "Costas",
  perna: "Pernas",
  pernas: "Pernas",
  gluteo: "Glúteo",
  gluteos: "Glúteo",
  panturrilha: "Panturrilha",
  ombro: "Ombros",
  ombros: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebraco: "Antebraço",
  abdomen: "Abdômen",
  cardio: "Cardio",
  mobilidade: "Mobilidade",
  aquecimento: "Aquecimento",
  alongamento: "Alongamento",
  funcional: "Funcional",
};

const GROUP_LABEL_PT: Record<MuscleGroup, string> = {
  chest: "Peito",
  back: "Costas",
  legs: "Pernas",
  shoulders: "Ombros",
  arms: "Braços",
  core: "Abdômen",
  full_body: "Corpo inteiro",
  cardio: "Cardio",
  mobility: "Mobilidade",
};

/** Todos os rótulos PT-BR da seleção, do dominante ao acessório, sem repetir. */
function rankTitleLabels(exercises: Array<{ bodyPart?: string | null }>): string[] {
  return rankByFrequency(
    exercises.map((ex) => {
      const key = normalize(ex.bodyPart);
      return BODY_PART_LABEL_PT[key] ?? GROUP_LABEL_PT[bodyPartToServerGroup(ex.bodyPart)];
    }),
  );
}

/**
 * Rótulos para o título "Treino livre · Costas e Bíceps".
 *
 * Usa o `body_part` cru, não o grupo do servidor: quem escolheu rosca direta
 * espera ler "Bíceps", não "Braços" — o enum existe para o histórico agregar,
 * não para conversar com o aluno. O que não estiver no catálogo cai no rótulo
 * do grupo derivado, que sempre existe.
 */
export function deriveTitleGroupsPt(
  exercises: Array<{ bodyPart?: string | null }>,
  maxGroups = 2,
): string[] {
  return rankTitleLabels(exercises).slice(0, Math.max(1, maxGroups));
}

/** "Costas e Bíceps" — junção com "e" no último, como se fala. */
export function joinGroupsPt(labels: readonly string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

/**
 * Trecho de grupos do título, já cortado no que cabe.
 *
 * Existe porque o corte em dois rótulos, sozinho, mentia: peito + costas +
 * perna + bíceps virava "Peito e Costas", que se lê como "treinei só esses
 * dois". Quando sobra grupo de fora, o "e mais" diz que a lista continua —
 * curto o bastante para o título ir inteiro ao histórico e ao card de
 * compartilhar, e honesto sobre o que ficou de fora.
 */
export function describeTitleGroupsPt(
  exercises: Array<{ bodyPart?: string | null }>,
  maxGroups = 2,
): string {
  const labels = rankTitleLabels(exercises);
  if (labels.length === 0) return "";
  const shown = labels.slice(0, Math.max(1, maxGroups));
  return joinGroupsPt(shown.length < labels.length ? [...shown, "mais"] : shown);
}

export const FREE_WORKOUT_TITLE = "Treino livre";

/**
 * Título da sessão livre — o mesmo no cabeçalho do Modo Treino e no `title` que
 * vai para o servidor. Um só lugar porque é o rótulo que o aluno vai reencontrar
 * no histórico: ler "Treino livre · Costas e Bíceps" na tela e outra coisa na
 * Evolução seria a mesma sessão com dois nomes.
 */
export function freeWorkoutTitle(exercises: Array<{ bodyPart?: string | null }>): string {
  const groups = describeTitleGroupsPt(exercises);
  return groups ? `${FREE_WORKOUT_TITLE} · ${groups}` : FREE_WORKOUT_TITLE;
}
