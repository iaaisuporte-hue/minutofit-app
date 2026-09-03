import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getExerciseInsightDrillDown,
  type ExerciseInsightDetail,
  type ExerciseExecution,
} from "../../../services/personalInsightsApi";
import { formatShortDate } from "./cockpitUtils";

/**
 * Drill-down de um exercício (Sprint P2B): as mesmas <= 5 ocorrências usadas
 * no cálculo de recorrência, para o Personal auditar "por que este insight
 * apareceu" antes de decidir revisar a ficha.
 *
 * Não existe hoje, em nenhum lugar do cockpit do personal, um componente de
 * "detalhe de sessão" reutilizável (só o tooltip do chip em
 * `StudentExecutionCard.tsx`) — por isso a lista abaixo é own-grown, mas
 * deliberadamente enxuta (data, categoria, séries feitas/prescritas, motivo),
 * sem inventar navegação para uma tela de sessão que não existe.
 */

const CATEGORY_LABEL: Record<ExerciseExecution["category"], string> = {
  EXECUTADO_CONFORME_PRESCRITO: "Conforme prescrição",
  SUBSTITUIDO: "Adaptado",
  PARCIAL: "Parcial",
  NAO_EXECUTADO: "Não executado",
};

export function ExerciseInsightDrilldownModal({
  studentId,
  exerciseId,
  exerciseName,
  onClose,
}: {
  studentId: string;
  exerciseId: string;
  exerciseName: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ExerciseInsightDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrored(false);
    getExerciseInsightDrillDown(studentId, exerciseId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setDetail(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setErrored(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [studentId, exerciseId]);

  return (
    <div className="pp-quick-msg-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-quick-msg-modal" role="dialog" aria-modal="true" aria-label={`Histórico de ${exerciseName}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="pp-quick-msg-title">Histórico — {exerciseName}</h3>
          <button onClick={onClose} className="pp-icon-btn" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        {loading ? <p className="ppf-muted">Carregando...</p> : null}

        {!loading && (errored || !detail) ? (
          <p className="ppf-muted">Não foi possível carregar o histórico deste exercício agora.</p>
        ) : null}

        {!loading && detail ? (
          detail.occurrences.length === 0 ? (
            <p className="ppf-muted">Sem ocorrências recentes para mostrar.</p>
          ) : (
            <ul className="ppi-occurrence-list">
              {detail.occurrences.map((occ) => (
                <li key={occ.sessionId} className="ppi-occurrence">
                  <div className="ppi-occurrence-head">
                    <span>{formatShortDate(occ.performedAt)}</span>
                    <span className="ppi-occurrence-category">{CATEGORY_LABEL[occ.category]}</span>
                  </div>
                  <div className="ppf-muted">
                    {occ.doneSets}/{occ.prescribedSets} séries
                    {occ.category === "SUBSTITUIDO" && occ.substitutedToExerciseName
                      ? ` · trocado por ${occ.substitutedToExerciseName}`
                      : ""}
                    {occ.substitutionReason ? ` · motivo: ${occ.substitutionReason}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
