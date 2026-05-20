import { useCallback } from "react";
import {
  fetchWorkoutProtocolById,
  type WorkoutProtocol,
} from "../../../services/workoutProtocolsApi";
import {
  coerceWeekPreset,
  KNOWN_GROUPS,
  type DayMeta,
  type MuscleGroup,
  type WeekPreset,
  type WorkoutExercise,
} from "./builderTypes";
import type { AiGeneratedWeeklyPlan } from "./builderAi";

type Feedback = { kind: "success" | "error"; message: string } | null;

type Args = {
  setWorkoutName: (n: string) => void;
  setWeekPreset: (wp: WeekPreset) => void;
  setSourceProtocolId: (id: number | null) => void;
  setSelectedGroup: (g: MuscleGroup) => void;
  setDaysItems: (i: Record<number, WorkoutExercise[]>) => void;
  setDaysMeta: (m: DayMeta[]) => void;
  setSelectedDayIdx: (i: number) => void;
  setWeeklyPlan: (p: AiGeneratedWeeklyPlan | null) => void;
  setFeedback: (f: Feedback) => void;
};

/**
 * Carga de protocolo no builder (Onda A do plano de arquitetura 7→8).
 * Extraído do WorkoutBuilderPage para isolar a hidratação de meta-dados
 * de protocolo no estado do builder.
 *
 * Não inclui o useEffect que consome `?protocol=` da URL — esse fica no
 * componente pai porque depende de hooks do react-router. O hook expõe
 * `loadProtocolIntoBuilder` que o useEffect pai consome.
 */
export function useWorkoutBuilderProtocolLoading(args: Args) {
  const hydrateFromProtocol = useCallback(
    (p: WorkoutProtocol) => {
      args.setWorkoutName(p.title);
      args.setWeekPreset(coerceWeekPreset(p.weekPreset));
      args.setSourceProtocolId(p.id);
      const sg = p.selectedGroup;
      if (sg && KNOWN_GROUPS.includes(sg as MuscleGroup)) args.setSelectedGroup(sg as MuscleGroup);

      const protocolDays = Array.isArray(p.days) && p.days.length > 0
        ? p.days
        : [{ index: 1, name: "Único", focus: sg ?? null, items: p.items }];

      const nextItems: Record<number, WorkoutExercise[]> = {};
      const nextMeta: DayMeta[] = protocolDays.map((day, idx) => {
        nextItems[idx] = day.items.map((it) => ({
          exerciseId: it.exerciseId,
          name: it.name,
          sets: it.sets,
          reps: it.reps,
          rest: it.rest,
          rpe: it.rpe,
          cadence: it.cadence,
          restPause: it.restPause,
          technique: it.technique,
          notes: it.notes,
        }));
        return { index: idx + 1, name: day.name || `Treino ${String.fromCharCode(65 + idx)}`, focus: day.focus ?? null };
      });

      args.setDaysItems(nextItems);
      args.setDaysMeta(nextMeta);
      args.setSelectedDayIdx(0);
      args.setWeeklyPlan(null);
    },
    [args],
  );

  const loadProtocolIntoBuilder = useCallback(
    async (protocolId: number, msg?: string): Promise<boolean> => {
      try {
        const p = await fetchWorkoutProtocolById(protocolId);
        hydrateFromProtocol(p);
        args.setFeedback({ kind: "success", message: msg ?? `Protocolo "${p.title}" carregado.` });
        return true;
      } catch (e) {
        args.setFeedback({
          kind: "error",
          message: e instanceof Error ? e.message : "Não foi possível carregar o protocolo.",
        });
        return false;
      }
    },
    [args, hydrateFromProtocol],
  );

  const handleSourceProtocolChange = useCallback(
    async (raw: string) => {
      if (!raw) {
        args.setSourceProtocolId(null);
        return;
      }
      const protocolId = Number(raw);
      if (!Number.isFinite(protocolId)) return;
      await loadProtocolIntoBuilder(protocolId, "Protocolo da biblioteca aplicado.");
    },
    [args, loadProtocolIntoBuilder],
  );

  return { hydrateFromProtocol, loadProtocolIntoBuilder, handleSourceProtocolChange };
}
