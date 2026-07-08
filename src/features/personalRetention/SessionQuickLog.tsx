import { useState } from "react";
import { Check, X } from "lucide-react";
import {
  createSession,
  SESSION_TAGS,
  type SessionStatus,
} from "../../services/personalSessionApi";

interface Props {
  studentId: string;
  studentName: string;
  onSaved?: (status: SessionStatus) => void;
}

type Phase = "idle" | "tags" | "saving" | "done";

export function SessionQuickLog({ studentId, studentName, onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [savedStatus, setSavedStatus] = useState<SessionStatus | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleStatus(status: SessionStatus) {
    if (status === "absent") {
      await save(status, [], "");
      return;
    }
    setSavedStatus(status);
    setPhase("tags");
  }

  async function save(status: SessionStatus, tags: string[], noteText: string) {
    setPhase("saving");
    setError(null);
    try {
      await createSession(studentId, { status, tags, note: noteText || undefined });
      setSavedStatus(status);
      setPhase("done");
      onSaved?.(status);
    } catch (e: any) {
      setError(e.message || "Erro ao registrar");
      setPhase(savedStatus ? "tags" : "idle");
    }
  }

  function toggleTag(key: string) {
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }

  function reset() {
    setPhase("idle");
    setSavedStatus(null);
    setSelectedTags([]);
    setNote("");
    setError(null);
  }

  if (phase === "done") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: savedStatus === "absent" ? "var(--color-danger, #dc2626)" : "var(--color-success, #5E7412)",
          fontWeight: 600,
        }}
      >
        <Check size={13} />
        {savedStatus === "absent" ? "Falta registrada" : "Sessão registrada"}
        <button
          type="button"
          onClick={reset}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, opacity: 0.5, marginLeft: 2 }}
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  if (phase === "tags" && savedStatus) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600 }}>
          Observações opcionais — {studentName}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {SESSION_TAGS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => toggleTag(t.key)}
              style={{
                fontSize: 11,
                padding: "3px 9px",
                borderRadius: 999,
                border: `1px solid ${selectedTags.includes(t.key) ? "var(--color-primary, #5E7412)" : "var(--color-border)"}`,
                background: selectedTags.includes(t.key) ? "rgba(123,153,25,0.08)" : "transparent",
                color: selectedTags.includes(t.key) ? "var(--color-primary, #5E7412)" : "var(--color-text-muted)",
                cursor: "pointer",
                fontWeight: selectedTags.includes(t.key) ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Observação rápida (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          style={{
            fontSize: 12,
            padding: "5px 9px",
            borderRadius: 7,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            outline: "none",
          }}
        />
        {error && (
          <div style={{ fontSize: 11, color: "var(--color-danger, #dc2626)" }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="pp-btn pp-btn--primary pp-btn--sm"
            onClick={() => save(savedStatus, selectedTags, note)}
          >
            Salvar
          </button>
          <button type="button" className="pp-btn pp-btn--ghost pp-btn--sm" onClick={reset}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {error && (
        <span style={{ fontSize: 11, color: "var(--color-danger, #dc2626)", marginRight: 4 }}>
          {error}
        </span>
      )}
      <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginRight: 2 }}>
        Sessão:
      </span>
      <button
        type="button"
        disabled={phase === "saving"}
        onClick={() => handleStatus("present")}
        style={{
          fontSize: 11,
          padding: "3px 10px",
          borderRadius: 999,
          border: "1px solid rgba(123,153,25,0.4)",
          background: "rgba(123,153,25,0.06)",
          color: "var(--color-success, #5E7412)",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Veio
      </button>
      <button
        type="button"
        disabled={phase === "saving"}
        onClick={() => handleStatus("absent")}
        style={{
          fontSize: 11,
          padding: "3px 10px",
          borderRadius: 999,
          border: "1px solid rgba(220,38,38,0.3)",
          background: "rgba(220,38,38,0.05)",
          color: "var(--color-danger, #dc2626)",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Faltou
      </button>
    </div>
  );
}
