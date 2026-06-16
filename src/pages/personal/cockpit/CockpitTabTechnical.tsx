import { useState } from "react";
import StudentTechnicalNotes, { type TechnicalNoteHighlight } from "../StudentTechnicalNotes";
import { AdaptationPolicyPanel } from "./AdaptationPolicyPanel";

type Props = {
  studentId: string;
  highlights: TechnicalNoteHighlight[];
  onSaved: () => void;
};

type SubTab = "notes" | "adaptation";

export function CockpitTabTechnical({ studentId, highlights, onSaved }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("adaptation");

  return (
    <div>
      {/* Sub-navigation */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
        {([["notes", "Notas técnicas"], ["adaptation", "Adaptação automática"]] as [SubTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: subTab === id ? 600 : 400,
              color: subTab === id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: subTab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "notes" ? (
        <StudentTechnicalNotes
          studentId={studentId}
          highlights={highlights}
          onSaved={onSaved}
        />
      ) : (
        <AdaptationPolicyPanel studentId={Number(studentId)} />
      )}
    </div>
  );
}
