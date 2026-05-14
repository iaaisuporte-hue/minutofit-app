import { useState } from "react";
import { X } from "lucide-react";
import { createRelationshipAction, type ActionType } from "../../services/personalRetentionApi";

type Props = {
  studentId: string;
  studentName: string;
  actionType?: ActionType;
  title?: string;
  onClose: () => void;
  onSaved?: () => void;
};

export function ObservationModal({
  studentId,
  studentName,
  actionType = "observation",
  title = "Registrar observação",
  onClose,
  onSaved,
}: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const text = note.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      await createRelationshipAction(studentId, {
        actionType,
        payloadJson: { note: text },
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro ao salvar");
      setSaving(false);
    }
  }

  return (
    <div className="pp-quick-msg-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-obs-modal">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="pp-obs-title">{title} — {studentName}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={17} />
          </button>
        </div>

        <textarea
          className="pp-obs-textarea"
          placeholder="Descreva sua observação..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />

        {error && <p style={{ color: "var(--color-danger)", fontSize: 12, margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !note.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
