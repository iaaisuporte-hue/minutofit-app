import { useCallback, useState } from "react";
import {
  createPersonalWorkoutPlan,
  updatePersonalWorkoutPlan,
} from "../../../services/personalWorkoutApi";
import { createWorkoutProtocol } from "../../../services/workoutProtocolsApi";
import type { DayMeta, MuscleGroup, WeekPreset, WorkoutExercise } from "./builderTypes";

type Feedback = { kind: "success" | "error"; message: string } | null;

type Args = {
  daysItems: Record<number, WorkoutExercise[]>;
  daysMeta: DayMeta[];
  workoutName: string;
  weekPreset: WeekPreset;
  selectedGroup: MuscleGroup;
  sourceProtocolId: number | null;
  selectedStudentId: string;
  selectedStudentName?: string;
  editingPlanId: number | null;
  isMultiDay: boolean;
  setFeedback: (f: Feedback) => void;
  setSourceProtocolId: (id: number | null) => void;
  onSaved: (studentId: string) => Promise<void> | void;
};

/**
 * Persistência unificada do builder (Onda A do plano de arquitetura 7→8).
 * Cobre 4 caminhos:
 *   1) edição de plano existente (PATCH) — quando editingPlanId está setado
 *   2) novo plano multi-dia (POST com days[])
 *   3) novo plano single-dia (POST com items[] e selectedGroup)
 *   4) salvar como protocolo na biblioteca (sem aluno selecionado)
 *
 * `onSaved` recebe o studentId após persistência bem-sucedida — usado pelo
 * componente pai para refresh do "Recent plans".
 */
export function useWorkoutBuilderSave(args: Args) {
  const [saving, setSaving] = useState(false);

  const saveUnified = useCallback(async () => {
    const totalExercises = Object.values(args.daysItems).reduce((s, arr) => s + arr.length, 0);
    if (totalExercises === 0) return;

    setSaving(true);
    args.setFeedback(null);
    try {
      const days = args.daysMeta.map((m, i) => ({
        name: m.name,
        focus: m.focus,
        items: args.daysItems[i] ?? [],
      }));

      if (args.selectedStudentId) {
        if (args.editingPlanId) {
          await updatePersonalWorkoutPlan(args.selectedStudentId, args.editingPlanId, {
            title: args.workoutName,
            weekPreset: args.weekPreset,
            days,
          });
          args.setFeedback({
            kind: "success",
            message: `Ficha "${args.workoutName}" atualizada para ${args.selectedStudentName ?? "o aluno"}.`,
          });
        } else if (args.isMultiDay) {
          await createPersonalWorkoutPlan(args.selectedStudentId, {
            title: args.workoutName,
            weekPreset: args.weekPreset,
            days,
            sourceProtocolId: args.sourceProtocolId,
          });
          args.setFeedback({
            kind: "success",
            message: `Ficha "${args.workoutName}" salva para ${args.selectedStudentName ?? "o aluno"} e ligada à biblioteca.`,
          });
        } else {
          await createPersonalWorkoutPlan(args.selectedStudentId, {
            title: args.workoutName,
            weekPreset: args.weekPreset,
            selectedGroup: args.selectedGroup,
            items: args.daysItems[0] ?? [],
            sourceProtocolId: args.sourceProtocolId,
          });
          args.setFeedback({
            kind: "success",
            message: `Ficha "${args.workoutName}" salva para ${args.selectedStudentName ?? "o aluno"} e ligada à biblioteca.`,
          });
        }
        await args.onSaved(args.selectedStudentId);
      } else {
        await createWorkoutProtocol({
          title: args.workoutName,
          weekPreset: args.weekPreset,
          selectedGroup: args.isMultiDay ? null : args.selectedGroup,
          items: args.daysItems[0] ?? [],
          days,
        });
        args.setSourceProtocolId(null);
        args.setFeedback({ kind: "success", message: `Protocolo "${args.workoutName}" salvo na sua biblioteca.` });
      }
    } catch (e) {
      args.setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : "Não foi possível salvar.",
      });
    } finally {
      setSaving(false);
    }
  }, [args]);

  return { saving, saveUnified };
}
