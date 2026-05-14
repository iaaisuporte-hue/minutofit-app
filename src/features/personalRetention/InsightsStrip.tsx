import { Sparkles } from "lucide-react";
import type { RetentionInsight } from "../../services/personalDashboardApi";

type Props = {
  insights: RetentionInsight[];
  onStudentClick?: (studentId: string) => void;
};

export function InsightsStrip({ insights, onStudentClick }: Props) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="pp-insights-strip">
      {insights.map((insight, i) => (
        <div key={i} className="pp-insight-chip">
          <Sparkles size={13} className="pp-insight-chip-icon" />
          <span>{insight.body}</span>
          {insight.studentId && onStudentClick && (
            <button
              className="pp-insight-chip-link"
              onClick={() => onStudentClick(insight.studentId!)}
            >
              Ver aluno
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
