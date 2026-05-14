import { useState, useEffect } from "react";
import {
  MessageSquare,
  Dumbbell,
  CheckSquare,
  StickyNote,
  CalendarClock,
  RotateCcw,
  Star,
  Zap,
  Activity,
} from "lucide-react";
import { listRelationshipTimeline, type TimelineItem } from "../../services/personalRetentionApi";

type Props = {
  studentId: string;
};

const KIND_ICON: Record<string, React.ReactNode> = {
  message: <MessageSquare size={15} />,
  workout: <Dumbbell size={15} />,
  checkin: <CheckSquare size={15} />,
  note: <StickyNote size={15} />,
  action: <Activity size={15} />,
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  follow_up_marked: <CalendarClock size={15} />,
  gradual_return_offered: <RotateCcw size={15} />,
  bonus_offered: <Star size={15} />,
  light_workout_offered: <Dumbbell size={15} />,
  message_sent: <MessageSquare size={15} />,
  quick_nudge: <Zap size={15} />,
  observation: <StickyNote size={15} />,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function getIcon(item: TimelineItem): React.ReactNode {
  if (item.kind === "action") {
    const t = (item.meta as any)?.actionType as string | undefined;
    return ACTION_ICON[t ?? ""] ?? <Activity size={15} />;
  }
  return KIND_ICON[item.kind] ?? <Activity size={15} />;
}

export function RelationshipTimeline({ studentId }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listRelationshipTimeline(studentId)
      .then((data) => { if (!cancelled) { setItems(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setItems([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
        Carregando histórico...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
        Sem registros de relacionamento nos últimos 90 dias.
      </div>
    );
  }

  return (
    <div className="pp-timeline">
      {items.map((item) => (
        <div key={`${item.kind}-${item.id}`} className="pp-timeline-item">
          <div className="pp-timeline-icon">{getIcon(item)}</div>
          <div className="pp-timeline-body">
            <p className="pp-timeline-title">{item.title}</p>
            {item.summary && (
              <p className="pp-timeline-summary">{item.summary}</p>
            )}
          </div>
          <span className="pp-timeline-date">{formatDate(item.occurredAt)}</span>
        </div>
      ))}
    </div>
  );
}
