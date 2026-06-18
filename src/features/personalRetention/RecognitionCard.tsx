import { MessageSquare, ChevronRight, Award } from "lucide-react";
import type { RecognitionMilestone } from "../../services/personalDashboardApi";

type Props = {
  milestones: RecognitionMilestone[];
  onCongratulate: (milestone: RecognitionMilestone) => void;
  onOpenProfile: (studentId: string, studentName: string) => void;
};

export function RecognitionCard({ milestones, onCongratulate, onOpenProfile }: Props) {
  if (milestones.length === 0) return null;

  return (
    <div className="pp-recognition-card">
      <div className="pp-risk-card-header">
        <h3 className="pp-risk-card-title">
          Merece reconhecimento · {milestones.length}
        </h3>
        <span
          className="pp-recognition-chip"
          style={{ fontSize: "11px" }}
        >
          Parabenize
        </span>
      </div>

      {milestones.map((m) => (
        <div key={`${m.studentId}:${m.milestoneKey}`} className="pp-risk-row">
          <button
            className="pp-risk-row-name"
            onClick={() => onOpenProfile(m.studentId, m.studentName)}
            title="Abrir perfil"
          >
            {m.studentName}
          </button>

          <div className="pp-risk-row-meta">
            <span className="pp-risk-row-stat">{m.milestoneDetail}</span>
            <span className="pp-recognition-chip">
              <Award size={11} style={{ flexShrink: 0 }} />
              {m.milestoneLabel}
            </span>
          </div>

          <div className="pp-risk-actions">
            <button
              className="pp-risk-action-btn"
              onClick={() => onCongratulate(m)}
              title="Parabenizar"
            >
              <MessageSquare size={14} />
            </button>
            <button
              className="pp-risk-action-btn"
              onClick={() => onOpenProfile(m.studentId, m.studentName)}
              title="Ver perfil"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
