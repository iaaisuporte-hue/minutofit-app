/**
 * Chips de grupo do seletor de exercícios do ALUNO (treino livre).
 *
 * Deliberadamente separado do `CATALOG_GROUPS` do builder do personal: aquela
 * lista omite `mobilidade`, `aquecimento` e `antebraço`, e cerca de 20
 * exercícios do catálogo ficam invisíveis para quem só navega por chip. No
 * builder existe busca textual e um profissional que sabe o que procura; aqui o
 * aluno está de pé na academia, e o que não tem chip não existe.
 *
 * `bodyPart` é o valor EXATO do banco (lowercase, com acento) porque o filtro
 * do servidor compara `LOWER(body_part) = $n` — igualdade, não `LIKE`.
 */

export interface CatalogGroupChip {
  /** Rótulo exibido no chip. */
  label: string;
  /** Valor enviado em `GET /api/exercises?bodyPart=`. */
  bodyPart: string;
}

export const FREE_WORKOUT_GROUPS: CatalogGroupChip[] = [
  { label: "Peito", bodyPart: "peito" },
  { label: "Costas", bodyPart: "costas" },
  { label: "Perna", bodyPart: "perna" },
  { label: "Glúteo", bodyPart: "glúteo" },
  { label: "Panturrilha", bodyPart: "panturrilha" },
  { label: "Ombro", bodyPart: "ombro" },
  { label: "Bíceps", bodyPart: "bíceps" },
  { label: "Tríceps", bodyPart: "tríceps" },
  { label: "Antebraço", bodyPart: "antebraço" },
  { label: "Abdômen", bodyPart: "abdômen" },
  { label: "Cardio", bodyPart: "cardio" },
  { label: "Mobilidade", bodyPart: "mobilidade" },
  { label: "Aquecimento", bodyPart: "aquecimento" },
];
