import { MessageSquare, CalendarClock, ChevronRight } from "lucide-react";
import type { PersonalDashboardStudent } from "../../services/personalDashboardApi";

type Props = {
  students: PersonalDashboardStudent[];
  onMessage: (student: PersonalDashboardStudent) => void;
  onFollowUp: (student: PersonalDashboardStudent) => void;
  onOpenProfile: (student: PersonalDashboardStudent) => void;
};

/** `null` = nunca treinou. Sem sentinela: 999 já vazou para a UI antes. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * O rótulo vem do MESMO número mostrado no chip.
 *
 * Antes o texto vinha de `s.risk` (campo legado, com carência de onboarding) e
 * o número de `s.riskScore` (sem carência): o aluno recém-cadastrado aparecia
 * como "100 OK" dentro do card "Alunos em risco". Uma fonte só elimina a
 * contradição.
 */
function riskLabelFromScore(score: number | null): string {
  if (score === null) return "Sem dados";
  if (score >= 75) return "Crítico";
  if (score >= 55) return "Alerta";
  return "OK";
}

function riskChipClass(score: number | null): string {
  if (score === null) return "pp-risk-chip pp-risk-chip-ok";
  if (score >= 75) return "pp-risk-chip pp-risk-chip-critico";
  if (score >= 55) return "pp-risk-chip pp-risk-chip-alerta";
  return "pp-risk-chip pp-risk-chip-ok";
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
        const chipClass = riskChipClass(s.riskScore);

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
              <span className="pp-risk-row-stat">
                {dias === null
                  ? "Ainda não treinou"
                  : `Sem treino há ${dias === 1 ? "1 dia" : `${dias} dias`}`}
              </span>
              <span className={chipClass}>
                <span className="pp-risk-chip-score">{s.riskScore ?? "--"}</span>
                {riskLabelFromScore(s.riskScore)}
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
