import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  fetchPatientNutritionGoals,
  NutritionGoalsApiError,
  type NutritionGoals,
} from "../../../services/nutritionGoalsApi";
import { NutritionGoalsAction, NutritionGoalsCard, type NutritionGoalsCardState } from "./NutritionGoalsCard";
import { NutritionGoalsEditor } from "./NutritionGoalsEditor";

/**
 * Metas diárias no Resumo do paciente (Spec 039). Mesmo painel do aluno; a
 * diferença é a ação "Ajustar metas". Depois de salvar, o painel mostra o
 * que o SERVIDOR devolveu — é a mesma linha que o aluno lê.
 */
export function PatientNutritionGoalsSection({ patientId }: { patientId: number }) {
  const [state, setState] = useState<NutritionGoalsCardState>("loading");
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [consentRevoked, setConsentRevoked] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const fetchGoals = useCallback(() => {
    fetchPatientNutritionGoals(patientId)
      .then((g) => {
        setGoals(g);
        setState("ready");
      })
      .catch((err) => {
        if (err instanceof NutritionGoalsApiError && err.consentRevoked) setConsentRevoked(true);
        setState("error");
      });
  }, [patientId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  function retry() {
    setState("loading");
    fetchGoals();
  }

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 3000);
    return () => clearTimeout(t);
  }, [savedFlash]);

  // Sem consentimento de nutrição o Resumo já mostra o aviso próprio; o
  // painel simplesmente não aparece (nunca "sem metas", que seria falso).
  if (consentRevoked) return null;

  return (
    <>
      <NutritionGoalsCard
        title="Metas diárias do paciente"
        state={state}
        goals={goals}
        emptyMessage="Nenhuma meta definida ainda. Defina calorias, proteínas, fibras e água para orientar o paciente."
        onRetry={retry}
      >
        <NutritionGoalsAction
          icon={<SlidersHorizontal size={20} />}
          title={goals ? "Ajustar metas" : "Definir metas"}
          subtitle="Editar calorias, macros e observações"
          onClick={() => setEditorOpen(true)}
        />
        <div role="status" aria-live="polite" className="field-hint">
          {savedFlash ? "Metas salvas. O paciente já vê os novos valores." : ""}
        </div>
      </NutritionGoalsCard>

      {/* Montado só quando aberto: o formulário sempre parte do valor atual do servidor. */}
      {editorOpen && (
        <NutritionGoalsEditor
          open
          patientId={patientId}
          goals={goals}
          onClose={() => setEditorOpen(false)}
          onSaved={(saved) => {
            setGoals(saved);
            setEditorOpen(false);
            setSavedFlash(true);
          }}
        />
      )}
    </>
  );
}
