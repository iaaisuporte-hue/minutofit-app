/**
 * Séries preenchidas mas não marcadas.
 *
 * ## O defeito que isto existe para evitar
 *
 * No Modo Treino, o ✓ verde é o ÚNICO gesto que marca uma série como feita.
 * `buildSessionPayload` envia `repsDone` e `loadDoneKg` apenas quando `done` é
 * verdadeiro — então quem digita carga e repetições na ficha inteira e não toca
 * em nenhum check grava uma sessão com todas as séries `skipped`, status
 * `abandoned`, e os números digitados descartados no caminho.
 *
 * O resultado, do ponto de vista do aluno, é o pior possível: ele preencheu
 * tudo, viu o app aceitar, e o treino não conta para frequência, XP nem
 * recordes. Foi assim que cinco sessões chegaram à produção com dezenas de
 * séries e zero feitas — e foi o que um aluno relatou como "treinei a semana
 * toda e o sistema não mostra".
 *
 * Estas funções são puras de propósito: a regra que decide se um trabalho conta
 * ou não é a última coisa que deveria depender de renderização para ser testada.
 */

/** O que o Modo Treino guarda de cada série enquanto o aluno treina. */
export interface EditableSet {
  setIndex: number;
  done: boolean;
  /** Texto do input — vazio, espaços ou `undefined` significam "não digitou". */
  reps?: string | null;
  loadKg?: string | null;
}

export interface EditableExercise {
  sets: EditableSet[];
}

function typed(value: string | null | undefined): boolean {
  return String(value ?? '').trim() !== '';
}

/**
 * O aluno escreveu algo nesta série?
 *
 * Carga OU repetições bastam. Exigir as duas deixaria de fora o caso comum do
 * peso corporal, em que só as repetições são digitadas — justamente um treino
 * que existe e contaria como nada.
 */
export function isFilled(set: EditableSet): boolean {
  return typed(set.reps) || typed(set.loadKg);
}

/** Séries com trabalho digitado que seriam descartadas ao salvar. */
export function findFilledUnchecked(
  exercises: readonly EditableExercise[],
): { exIndex: number; setIndex: number }[] {
  return exercises.flatMap((ex, exIndex) =>
    ex.sets
      .filter((s) => !s.done && isFilled(s))
      .map((s) => ({ exIndex, setIndex: s.setIndex })),
  );
}

/**
 * Marca como feitas todas as séries preenchidas.
 *
 * Um toque no lugar de N. Não toca em série vazia: o aluno que pulou um
 * exercício de verdade continua com ele pulado — a função converte trabalho
 * registrado, não presume trabalho que ninguém registrou.
 *
 * Devolve uma cópia; nada é mutado no lugar.
 */
export function markFilledDone<T extends EditableExercise>(
  exercises: readonly T[],
  now: number,
): T[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) =>
      !s.done && isFilled(s) ? { ...s, done: true, completedAt: now } : s,
    ),
  }));
}
