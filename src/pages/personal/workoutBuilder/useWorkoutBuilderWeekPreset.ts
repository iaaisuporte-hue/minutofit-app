import { useCallback } from "react";
import { weekPresetToCount, type DayMeta, type WeekPreset, type WorkoutExercise } from "./builderTypes";

type Args = {
  setWeekPreset: (wp: WeekPreset) => void;
  setDaysMeta: React.Dispatch<React.SetStateAction<DayMeta[]>>;
  setDaysItems: React.Dispatch<React.SetStateAction<Record<number, WorkoutExercise[]>>>;
  setSelectedDayIdx: React.Dispatch<React.SetStateAction<number>>;
};

/**
 * Sincroniza preset de dias da semana com daysMeta + daysItems
 * (Onda A do plano de arquitetura 7→8).
 *
 * Sem isso, trocar 4×/5×/6× só mudava o label e o save caía no branch
 * legacy single-day, perdendo dias 2..N.
 */
export function useWorkoutBuilderWeekPreset(args: Args) {
  const applyWeekPreset = useCallback(
    (newPreset: WeekPreset) => {
      const n = weekPresetToCount(newPreset);
      args.setWeekPreset(newPreset);
      args.setDaysMeta((prev) => {
        const out: DayMeta[] = [];
        for (let i = 0; i < n; i++) {
          const existing = prev[i];
          const isLegacyPlaceholder = !existing || existing.name === "Único";
          out.push({
            index: i + 1,
            name: isLegacyPlaceholder ? `Treino ${String.fromCharCode(65 + i)}` : existing.name,
            focus: existing?.focus ?? null,
          });
        }
        return out;
      });
      args.setDaysItems((prev) => {
        const out: Record<number, WorkoutExercise[]> = {};
        for (let i = 0; i < n; i++) out[i] = prev[i] ?? [];
        return out;
      });
      args.setSelectedDayIdx((curr) => Math.min(curr, n - 1));
    },
    [args],
  );

  return { applyWeekPreset };
}
