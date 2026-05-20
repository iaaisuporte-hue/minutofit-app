import { useCallback } from "react";
import type { TechniqueConfig } from "../../../features/training/techniques/technique.types";
import type { Exercise, WorkoutExercise } from "./builderTypes";

function randomUuidV4(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (out: Uint8Array) => void } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  g.crypto?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type SetDaysItems = React.Dispatch<React.SetStateAction<Record<number, WorkoutExercise[]>>>;

type Args = {
  selectedDayIdx: number;
  setDaysItems: SetDaysItems;
};

/**
 * Operações sobre exercícios do dia ativo (Onda A do plano de arquitetura 7→8).
 *
 * Todas as funções atuam exclusivamente no `selectedDayIdx`, mantendo
 * dias inativos intactos. Inclui housekeeping de bi-set: trocar técnica
 * ou desemparelhar limpa o parceiro do grupo automaticamente.
 */
export function useWorkoutBuilderExerciseOps({ selectedDayIdx, setDaysItems }: Args) {
  const addExercise = useCallback(
    (ex: Exercise) => {
      setDaysItems((prev) => ({
        ...prev,
        [selectedDayIdx]: [
          ...(prev[selectedDayIdx] ?? []),
          { exerciseId: ex.id, name: ex.name, sets: "4", reps: "10-12", rest: "60s" },
        ],
      }));
    },
    [selectedDayIdx, setDaysItems],
  );

  const removeExercise = useCallback(
    (exerciseId: string) => {
      setDaysItems((prev) => ({
        ...prev,
        [selectedDayIdx]: (prev[selectedDayIdx] ?? []).filter((i) => i.exerciseId !== exerciseId),
      }));
    },
    [selectedDayIdx, setDaysItems],
  );

  const moveExercise = useCallback(
    (exerciseId: string, dir: -1 | 1) => {
      setDaysItems((prev) => {
        const dayItems = [...(prev[selectedDayIdx] ?? [])];
        const idx = dayItems.findIndex((i) => i.exerciseId === exerciseId);
        if (idx < 0) return prev;
        const next = idx + dir;
        if (next < 0 || next >= dayItems.length) return prev;
        [dayItems[idx], dayItems[next]] = [dayItems[next], dayItems[idx]];
        return { ...prev, [selectedDayIdx]: dayItems };
      });
    },
    [selectedDayIdx, setDaysItems],
  );

  const updateItem = useCallback(
    (exerciseId: string, patch: Partial<WorkoutExercise>) => {
      setDaysItems((prev) => ({
        ...prev,
        [selectedDayIdx]: (prev[selectedDayIdx] ?? []).map((i) =>
          i.exerciseId === exerciseId ? { ...i, ...patch } : i,
        ),
      }));
    },
    [selectedDayIdx, setDaysItems],
  );

  /**
   * Sets technique on an exercise. Handles the bi-set group housekeeping:
   * leaving a bi-set clears the partner's pairing too; switching to a different
   * technique leaves the partner unpaired.
   */
  const setItemTechnique = useCallback(
    (exerciseId: string, next: TechniqueConfig | undefined) => {
      setDaysItems((prev) => {
        const day = [...(prev[selectedDayIdx] ?? [])];
        const idx = day.findIndex((i) => i.exerciseId === exerciseId);
        if (idx < 0) return prev;
        const previous = day[idx].technique;

        if (previous?.type === "bi_set" && previous.biSetGroupId) {
          const groupId = previous.biSetGroupId;
          if (next?.type !== "bi_set" || next.biSetGroupId !== groupId) {
            for (let j = 0; j < day.length; j++) {
              if (j !== idx && day[j].technique?.type === "bi_set" && day[j].technique?.biSetGroupId === groupId) {
                day[j] = { ...day[j], technique: undefined };
              }
            }
          }
        }
        day[idx] = { ...day[idx], technique: next };
        return { ...prev, [selectedDayIdx]: day };
      });
    },
    [selectedDayIdx, setDaysItems],
  );

  /** Pairs two exercises in a bi-set (creates a new groupId if needed). */
  const pairBiSet = useCallback(
    (exerciseIdA: string, exerciseIdB: string | null) => {
      setDaysItems((prev) => {
        const day = [...(prev[selectedDayIdx] ?? [])];
        const a = day.findIndex((i) => i.exerciseId === exerciseIdA);
        if (a < 0) return prev;

        const aPrev = day[a].technique;
        const existingGroupId = aPrev?.type === "bi_set" ? aPrev.biSetGroupId : undefined;

        if (!exerciseIdB) {
          if (existingGroupId) {
            for (let j = 0; j < day.length; j++) {
              if (day[j].technique?.type === "bi_set" && day[j].technique?.biSetGroupId === existingGroupId) {
                day[j] = { ...day[j], technique: undefined };
              }
            }
          } else {
            day[a] = { ...day[a], technique: undefined };
          }
          return { ...prev, [selectedDayIdx]: day };
        }

        const b = day.findIndex((i) => i.exerciseId === exerciseIdB);
        if (b < 0) return prev;

        const bPrev = day[b].technique;
        if (bPrev?.type === "bi_set" && bPrev.biSetGroupId && bPrev.biSetGroupId !== existingGroupId) {
          const stale = bPrev.biSetGroupId;
          for (let j = 0; j < day.length; j++) {
            if (j !== b && day[j].technique?.type === "bi_set" && day[j].technique?.biSetGroupId === stale) {
              day[j] = { ...day[j], technique: undefined };
            }
          }
        }

        const groupId = existingGroupId ?? randomUuidV4();
        day[a] = { ...day[a], technique: { type: "bi_set", biSetGroupId: groupId } };
        day[b] = { ...day[b], technique: { type: "bi_set", biSetGroupId: groupId } };
        return { ...prev, [selectedDayIdx]: day };
      });
    },
    [selectedDayIdx, setDaysItems],
  );

  return { addExercise, removeExercise, moveExercise, updateItem, setItemTechnique, pairBiSet };
}
