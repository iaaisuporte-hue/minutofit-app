import { RelationshipTimeline } from "../../../features/personalRetention/RelationshipTimeline";
import { QuickActionsMenu } from "../../../features/personalRetention/QuickActionsMenu";

type Props = {
  studentId: string;
  studentName: string;
};

export function CockpitTabRelationship({ studentId, studentName }: Props) {
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
          Histórico de relacionamento
        </span>
        <QuickActionsMenu
          studentId={studentId}
          studentName={studentName}
          onActionDone={() => {}}
        />
      </div>
      <RelationshipTimeline studentId={studentId} />
    </div>
  );
}
