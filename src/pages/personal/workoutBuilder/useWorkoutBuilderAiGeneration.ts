import { useCallback, useState } from "react";
import { runAiWorkoutGeneration, type AiGeneratedWeeklyPlan } from "./builderAi";
import type { DayMeta, Exercise, WeekPreset, WorkoutExercise } from "./builderTypes";

type Feedback = { kind: "success" | "error"; message: string } | null;

type Args = {
  allExercises: Exercise[];
  setFeedback: (f: Feedback) => void;
  setWeekPreset: (wp: WeekPreset) => void;
  setWeeklyPlan: (p: AiGeneratedWeeklyPlan | null) => void;
  setDaysItems: (i: Record<number, WorkoutExercise[]>) => void;
  setDaysMeta: (m: DayMeta[]) => void;
  setSelectedDayIdx: (i: number) => void;
  setWorkoutName: (n: string) => void;
};

/**
 * Geração de ficha via IA (Onda A do plano de arquitetura 7→8).
 * Extraído do WorkoutBuilderPage para isolar a coreografia de
 * prompt → setters → feedback do componente principal.
 */
export function useWorkoutBuilderAiGeneration(args: Args) {
  const [aiLoading, setAiLoading] = useState(false);

  const generateWithAi = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || aiLoading) return;
      setAiLoading(true);
      args.setFeedback(null);
      try {
        const { plan, weekPreset: wp, daysItems: newDaysItems, daysMeta: newDaysMeta, unresolved } =
          await runAiWorkoutGeneration(trimmed, args.allExercises);
        args.setWeekPreset(wp);
        args.setWeeklyPlan(plan);
        args.setDaysItems(newDaysItems);
        args.setDaysMeta(newDaysMeta);
        args.setSelectedDayIdx(0);
        args.setWorkoutName(plan.title);

        const totalEx = Object.values(newDaysItems).reduce((s, arr) => s + arr.length, 0);
        if (unresolved.length > 0) {
          args.setFeedback({
            kind: "error",
            message: `${unresolved.length} exercício(s) não encontrado(s): ${unresolved.slice(0, 3).map((n) => `"${n}"`).join(", ")}${unresolved.length > 3 ? "…" : ""} — adicione manualmente.`,
          });
        } else {
          args.setFeedback({
            kind: "success",
            message: `Plano ${plan.split ?? ""} gerado: ${plan.days.length} dias, ${totalEx} exercícios. Selecione o dia e revise.`,
          });
        }
      } catch (e) {
        args.setFeedback({
          kind: "error",
          message: e instanceof Error ? e.message : "Não foi possível gerar a ficha.",
        });
      } finally {
        setAiLoading(false);
      }
    },
    [aiLoading, args],
  );

  return { aiLoading, generateWithAi };
}
