import { useEffect, useState } from "react";
import { COLORS } from "../../../styles/colors";
import { EmptyState } from "../../../components/EmptyState";
import { fetchObservations, createObservation, type NutritionObservation, NutriApiError } from "../../../services/nutriApi";
import { ConsentRevokedNotice } from "./shared";

export function ObservationsTab({ patientId }: { patientId: number }) {
  const [obs, setObs] = useState<NutritionObservation[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [consentRevoked, setConsentRevoked] = useState(false);
  const LIMIT = 5;

  useEffect(() => {
    fetchObservations(patientId, LIMIT, offset)
      .then(({ rows, total: t }) => {
        setConsentRevoked(false);
        setObs((prev) => (offset === 0 ? rows : [...prev, ...rows]));
        setTotal(t);
      })
      .catch((err) => {
        if (err instanceof NutriApiError && err.consentRevoked) setConsentRevoked(true);
      });
  }, [patientId, offset]);

  if (consentRevoked) return <ConsentRevokedNotice />;

  async function handleSave() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createObservation(patientId, draft.trim());
      setDraft("");
      setOffset(0);
      const refreshed = await fetchObservations(patientId, LIMIT, 0);
      setObs(refreshed.rows);
      setTotal(refreshed.total);
    } catch {
      setSaveError("Não foi possível salvar a observação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Input */}
      <div className="card cardPad" style={{ marginBottom: "var(--space-5)" }}>
        <textarea
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Adicionar observação clínica..."
          aria-label="Nova observação clínica"
          rows={3}
          style={{ resize: "vertical" }}
        />
        {saveError && <div className="alert alert-danger" style={{ marginTop: "var(--space-2)" }}>{saveError}</div>}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={saving || !draft.trim()}
          style={{ marginTop: "var(--space-3)" }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* List */}
      {obs.length === 0 ? (
        <EmptyState title="Nenhuma observação registrada" description="Registre observações clínicas conforme acompanha o paciente." />
      ) : (
        <div className="stack" style={{ gap: "var(--space-2)" }}>
          {obs.map((o) => (
            <div key={o.id} className="card cardPad">
              <div className="muted" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>
                {new Date(o.created_at).toLocaleString("pt-BR")}
              </div>
              <div style={{ fontSize: "var(--text-base)", color: COLORS.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {o.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {obs.length < total && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setOffset((prev) => prev + LIMIT)}
          style={{ marginTop: "var(--space-4)" }}
        >
          Ver mais {total - obs.length} observações
        </button>
      )}
    </div>
  );
}
