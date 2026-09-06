import { useEffect, useState } from "react";
import { COLORS } from "../../../styles/colors";
import { SkeletonPanelCard } from "../../../components/feedback/Skeleton";
import { EmptyState } from "../../../components/EmptyState";
import { publishVoiceNote, listVoiceNotes, type VoiceNote, NutriApiError } from "../../../services/nutriApi";
import { ConsentRevokedNotice, formatDateShort } from "./shared";

export function VozTab({ patientId }: { patientId: number }) {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [consentRevoked, setConsentRevoked] = useState(false);
  const MAX = 240;

  const reload = () => {
    setLoading(true);
    listVoiceNotes(patientId)
      .then((n) => { setConsentRevoked(false); setNotes(n); })
      .catch((err) => {
        if (err instanceof NutriApiError && err.consentRevoked) setConsentRevoked(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [patientId]);

  async function handlePublish() {
    const text = draft.trim().slice(0, MAX);
    if (!text || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await publishVoiceNote(patientId, text);
      setDraft("");
      reload();
    } catch {
      setSaveError("Não foi possível publicar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (consentRevoked) return <ConsentRevokedNotice />;

  return (
    <div>
      {/* Composer */}
      <div className="card cardPad" style={{ marginBottom: "var(--space-5)" }}>
        <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Nova nota para o paciente
        </div>
        <textarea
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
          placeholder="Escreva uma orientação ou observação visível ao paciente... (máx. 240 caracteres)"
          aria-label="Nova nota de voz para o paciente"
          rows={3}
          style={{ resize: "vertical" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-2)", gap: "var(--space-2)" }}>
          <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
            {draft.length}/{MAX}
          </span>
          {saveError && <span style={{ fontSize: "var(--text-xs)", color: COLORS.dangerText }}>{saveError}</span>}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handlePublish()}
            disabled={saving || draft.trim().length === 0}
          >
            {saving ? "Publicando..." : "Publicar para paciente"}
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
        Notas publicadas
      </div>
      {loading ? (
        <SkeletonPanelCard />
      ) : notes.length === 0 ? (
        <EmptyState title="Nenhuma nota publicada" description="Publique uma nota para que o paciente a veja no acompanhamento." />
      ) : (
        <div className="stack" style={{ gap: "var(--space-2)" }}>
          {notes.map((n) => (
            <div key={n.id} className="card cardPad stack" style={{ gap: "var(--space-1)" }}>
              <p style={{ margin: 0, fontSize: "var(--text-base)", color: COLORS.text, lineHeight: 1.5 }}>
                "{n.body}"
              </p>
              <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "var(--text-xs)", color: COLORS.muted }}>
                <span>{formatDateShort(n.publishedAt)}</span>
                {n.readAt ? (
                  <span style={{ color: COLORS.successText }}>Lida em {formatDateShort(n.readAt)}</span>
                ) : (
                  <span>Não lida</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
