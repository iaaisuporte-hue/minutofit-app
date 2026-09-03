import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import {
  PersonalInsightsError,
  reviewExerciseInsight,
  type ExerciseInsight,
} from "../../../services/personalInsightsApi";
import { trackPersonalInsightsEvent } from "./personalInsightsEvents";

/**
 * Revisão assistida da ficha (Sprint P2B, D-WRITE-ENDPOINT/D-BISET).
 *
 * Três telas dentro do mesmo modal, nunca uma troca silenciosa:
 *  1. `choice`   — exercício atual × alternativa(s) recorrente(s), Personal escolhe.
 *  2. `confirm`  — confirmação explícita (item 28 do harness): a troca vale só
 *     para execuções futuras, treinos passados não mudam.
 *  3. `manual`   — o alvo faz parte de um Bi-Set ativo (`requiresManualEdit`):
 *     nunca tentamos reaplicar, só direcionamos ao editor completo
 *     (`WorkoutBuilderPage`), que já valida o par.
 *
 * `personal_plan_review_started` dispara ao abrir; `personal_plan_review_cancelled`
 * dispara em QUALQUER saída sem aplicar (Manter, fechar, erro); `_updated_from_insight`
 * só no `applied: true`. `appliedRef` garante que só um dos dois seja relatado.
 */

const REASON_MESSAGE: Record<string, string> = {
  NO_ACTIVE_PLAN: "Este aluno não tem uma ficha ativa no momento — não há o que revisar.",
  EXERCISE_NOT_IN_PLAN: "Esse exercício não está mais na ficha ativa. O insight pode estar desatualizado — feche e recarregue a lista.",
  INVALID_EXERCISES: "O exercício de destino não está disponível na sua biblioteca. Escolha outra alternativa.",
  INVALID_EXERCISE_ID: "Não foi possível identificar o exercício de destino. Tente novamente.",
  INVALID_TARGET_EXERCISE_ID: "Não foi possível identificar o exercício de destino. Tente novamente.",
  ASSIGNMENT_REQUIRED: "O vínculo com este aluno não está mais ativo.",
  CONSENT_REQUIRED: "O aluno não compartilha os dados de treino com você no momento.",
  PLAN_NOT_FOUND: "Não foi possível localizar a ficha para atualizar. Tente novamente em instantes.",
};

function reviewErrorMessage(error: unknown): string {
  if (error instanceof PersonalInsightsError) {
    return REASON_MESSAGE[error.code] ?? "Não foi possível revisar a ficha agora. Tente novamente.";
  }
  return "Não foi possível revisar a ficha agora. Tente novamente.";
}

type Step = "choice" | "confirm" | "manual" | "error";

export function PlanReviewModal({
  studentId,
  insight,
  onClose,
  onApplied,
}: {
  studentId: string;
  insight: ExerciseInsight;
  onClose: () => void;
  /** O card no chamador remove/recarrega o insight aplicado. */
  onApplied: (originalExerciseId: string) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choice");
  const [selectedAltId, setSelectedAltId] = useState(insight.alternatives[0]?.exerciseId ?? "");
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualEdit, setManualEdit] = useState<{ planId: number; dayIndex: number } | null>(null);
  const appliedRef = useRef(false);

  useEffect(() => {
    trackPersonalInsightsEvent("personal_plan_review_started", { insightType: insight.type });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    if (!appliedRef.current) {
      trackPersonalInsightsEvent("personal_plan_review_cancelled", { insightType: insight.type, step });
    }
    onClose();
  }

  const selectedAlt = insight.alternatives.find((a) => a.exerciseId === selectedAltId) ?? insight.alternatives[0];

  async function confirmApply() {
    if (!selectedAlt) return;
    setApplying(true);
    setErrorMessage(null);
    try {
      const result = await reviewExerciseInsight(studentId, insight.originalExerciseId, {
        action: "apply",
        targetExerciseId: selectedAlt.exerciseId,
      });
      if (result.applied) {
        appliedRef.current = true;
        trackPersonalInsightsEvent("personal_plan_updated_from_insight", { insightType: insight.type });
        onApplied(insight.originalExerciseId);
        onClose();
        return;
      }
      if ("requiresManualEdit" in result && result.requiresManualEdit) {
        setManualEdit({ planId: result.planId, dayIndex: result.dayIndex });
        setStep("manual");
        return;
      }
    } catch (err) {
      setErrorMessage(reviewErrorMessage(err));
      setStep("error");
    } finally {
      setApplying(false);
    }
  }

  function openBuilder() {
    if (!manualEdit) return;
    // `dayIndex` do backend é 1-based (`day_index` gravado como `i + 1`,
    // `personalWorkoutPlanService.ts`); o `?day=` que o `WorkoutBuilderPage`
    // entende é 0-based (posição no array `daysItems`/`daysMeta`) — converte
    // aqui, no único ponto que fala com as duas convenções.
    navigate(
      `/app/personal/students/${studentId}/workouts/builder?planId=${manualEdit.planId}&day=${manualEdit.dayIndex - 1}`,
    );
    onClose();
  }

  return (
    <div className="pp-quick-msg-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="pp-quick-msg-modal" role="dialog" aria-modal="true" aria-label="Revisar ficha">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="pp-quick-msg-title">Revisar ficha</h3>
          <button onClick={handleClose} className="pp-icon-btn" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        {step === "choice" && (
          <>
            <div className="ppi-review-compare">
              <div className="ppi-review-col">
                <span className="ppf-muted">Na ficha hoje</span>
                <strong>{insight.originalExerciseName}</strong>
              </div>
              <div className="ppi-review-col">
                <span className="ppf-muted">
                  {insight.alternatives.length > 1 ? "Escolha a alternativa" : "Substituto recorrente"}
                </span>
                {insight.alternatives.map((alt) => (
                  <label key={alt.exerciseId} className="ppi-review-alt-option">
                    <input
                      type="radio"
                      name="targetExercise"
                      checked={selectedAltId === alt.exerciseId}
                      onChange={() => setSelectedAltId(alt.exerciseId)}
                    />
                    <span>
                      <strong>{alt.exerciseName}</strong> · usado {alt.count}x
                      {alt.approvedByPersonal ? (
                        <span className="ppi-approved-badge"> · Alternativa já aprovada por você</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <p className="ppf-muted">
              Essa alteração valerá para execuções futuras. Treinos anteriores não serão modificados.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="pp-btn pp-btn--ghost" onClick={handleClose}>Manter na ficha</button>
              <button
                className="pp-btn pp-btn--primary"
                onClick={() => setStep("confirm")}
                disabled={!selectedAlt}
              >
                Substituir na ficha
              </button>
            </div>
          </>
        )}

        {step === "confirm" && selectedAlt && (
          <>
            <p style={{ color: "var(--color-text)" }}>
              Trocar <strong>{insight.originalExerciseName}</strong> por{" "}
              <strong>{selectedAlt.exerciseName}</strong> em todos os dias da ficha ativa onde ele aparece?
            </p>
            <p className="ppf-muted">
              Essa alteração valerá para execuções futuras. Treinos anteriores não serão modificados.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="pp-btn pp-btn--ghost" onClick={() => setStep("choice")} disabled={applying}>
                Cancelar
              </button>
              <button className="pp-btn pp-btn--primary" onClick={confirmApply} disabled={applying}>
                {applying ? "Aplicando..." : "Confirmar substituição"}
              </button>
            </div>
          </>
        )}

        {step === "manual" && manualEdit && (
          <>
            <p style={{ color: "var(--color-text)" }}>
              Este exercício faz parte de uma técnica combinada (Bi-Set) na ficha atual. Para trocá-lo com
              segurança — sem quebrar o par —, abra o editor completo da ficha; a validação do Bi-Set
              acontece automaticamente lá.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="pp-btn pp-btn--ghost" onClick={handleClose}>Fechar</button>
              <button className="pp-btn pp-btn--primary" onClick={openBuilder}>Abrir editor de ficha</button>
            </div>
          </>
        )}

        {step === "error" && (
          <>
            <p role="alert" style={{ color: "var(--color-danger-text)" }}>{errorMessage}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="pp-btn pp-btn--ghost" onClick={handleClose}>Fechar</button>
              <button className="pp-btn pp-btn--primary" onClick={() => setStep("choice")}>Voltar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
