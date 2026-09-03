/**
 * Selo de origem do exercício — Biblioteca Personalizada do Personal
 * (Sprint P1_PERSONAL_CUSTOM_EXERCISES).
 *
 * Vive em `features/training/` (não em `pages/personal/`) porque os DOIS
 * consumidores estão em módulos diferentes: o builder do personal
 * (`pages/personal/workoutBuilder/WorkoutBuilderPage.tsx`) e o seletor do
 * aluno (`pages/user/freeWorkout/FreeExercisePickerSheet.tsx`). Mesmo padrão
 * de cross-import já usado por `FREE_WORKOUT_GROUPS` (`freeWorkout/
 * catalogGroups.ts`), só que na direção oposta — aqui o import compartilhado
 * fica num terceiro lugar em vez de um módulo "pertencer" ao outro.
 *
 * Por que não precisa comparar `ownerPersonalId` com o id do personal
 * logado: o backend já resolve visibilidade no servidor (D4 do harness da
 * sprint) — o personal só enxerga exercício global ou o PRÓPRIO, nunca o de
 * outro personal; o aluno só enxerga global ou o do PRÓPRIO personal
 * atribuído. Ou seja, dentro de cada `context`, `ownerPersonalId !== null`
 * só pode significar uma coisa — a comparação de id seria redundante.
 */
import type { CSSProperties } from "react";

export type ExerciseOriginContext = "personal" | "student";

interface Props {
  /** `null` = catálogo global S2CORE. */
  ownerPersonalId: string | null;
  context: ExerciseOriginContext;
  /**
   * Listas densas em mobile (picker do aluno) pedem um selo menor. Ajusta só
   * padding/tamanho de fonte — cor continua vindo 100% de `.badge-neutral`/
   * `.badge-brand` (tokens), nunca hardcoded aqui.
   */
  compact?: boolean;
}

const compactStyle: CSSProperties = { padding: "1px 7px", fontSize: 10 };

export function ExerciseOriginBadge({ ownerPersonalId, context, compact }: Props) {
  if (ownerPersonalId == null) {
    // Global sem selo no aluno: densidade de lista mobile (harness item 5) —
    // "S2CORE" em toda linha não ajuda quem está escolhendo de pé, só ocupa
    // espaço. No builder o personal se beneficia de saber que é catálogo
    // compartilhado, e há espaço sobrando na linha.
    if (context === "student") return null;
    return (
      <span className="badge badge-neutral" style={compact ? compactStyle : undefined}>
        S2CORE
      </span>
    );
  }
  return (
    <span className="badge badge-brand" style={compact ? compactStyle : undefined}>
      {context === "personal" ? "Meu exercício" : "Do seu personal"}
    </span>
  );
}
