import { MessageSquare, CalendarClock, ChevronRight } from "lucide-react";
import type { PersonalDashboardStudent } from "../../services/personalDashboardApi";

type Props = {
  students: PersonalDashboardStudent[];
  onMessage: (student: PersonalDashboardStudent) => void;
  onFollowUp: (student: PersonalDashboardStudent) => void;
  onOpenProfile: (student: PersonalDashboardStudent) => void;
};

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function riskLabel(risk: string): string {
  if (risk === "critico") return "Crítico";
  if (risk === "alerta") return "Alerta";
  return "OK";
}

export function AtRiskCard({ students, onMessage, onFollowUp, onOpenProfile }: Props) {
  if (students.length === 0) return null;

  return (
    <div className="pp-risk-card">
      <div className="pp-risk-card-header">
        <h3 className="pp-risk-card-title">
          Alunos em risco · {students.length}
        </h3>
        <span
          className="pp-risk-chip pp-risk-chip-critico"
          style={{ fontSize: "11px" }}
        >
          Prioridade
        </span>
      </div>

      {students.map((s) => {
        const dias = daysSince(s.lastWorkoutISO);
        const diasLabel = dias >= 999 ? "nunca" : dias === 1 ? "1 dia" : `${dias} dias`;
        const chipClass =
          s.risk === "critico"
            ? "pp-risk-chip pp-risk-chip-critico"
            : s.risk === "alerta"
            ? "pp-risk-chip pp-risk-chip-alerta"
            : "pp-risk-chip pp-risk-chip-ok";

        return (
          <div key={s.id} className="pp-risk-row">
            <button
              className="pp-risk-row-name"
              onClick={() => onOpenProfile(s)}
              title="Abrir perfil"
            >
              {s.name}
            </button>

            <div className="pp-risk-row-meta">
              <span className="pp-risk-row-stat">Sem treino há {diasLabel}</span>
              <span className={chipClass}>
                <span className="pp-risk-chip-score">{s.riskScore ?? "--"}</span>
                {riskLabel(s.risk)}
              </span>
              <span className="pp-risk-row-stat">{s.workouts7d}×/sem</span>
            </div>

            <div className="pp-risk-actions">
              <button
                className="pp-risk-action-btn"
                onClick={() => onMessage(s)}
                title="Enviar mensagem"
              >
                <MessageSquare size={14} />
              </button>
              <button
                className="pp-risk-action-btn"
                onClick={() => onFollowUp(s)}
                title="Marcar acompanhamento"
              >
                <CalendarClock size={14} />
              </button>
              <button
                className="pp-risk-action-btn"
                onClick={() => onOpenProfile(s)}
                title="Ver perfil"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
