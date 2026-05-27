import { useEffect, useState } from "react";
import { COLORS } from "../../styles/colors";
import {
  getMyNetworkProfile,
  saveMyNetworkProfile,
  publishMyNetworkProfile,
  unpublishMyNetworkProfile,
  type NetworkProfile,
  type Modality,
  type AvailabilityStatus,
} from "../../services/professionalNetworkApi";

const MODALITY_LABELS: Record<Modality, string> = {
  in_person: "Presencial",
  online: "Online",
  hybrid: "Híbrido",
};

const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: "Disponível para novos pacientes",
  limited: "Vagas limitadas",
  unavailable: "Sem vagas no momento",
};

function missingFields(draft: Partial<FormDraft>): string[] {
  return [
    !draft.credentialCode?.trim() ? "Código de registro (CRM/CRN/CREF)" : null,
    !draft.displayName?.trim() ? "Nome de exibição" : null,
    !draft.bio?.trim() ? "Bio" : null,
    !(draft.specialties ?? []).filter(Boolean).length ? "Especialidades" : null,
    !draft.modality ? "Modalidade de atendimento" : null,
  ].filter(Boolean) as string[];
}

interface FormDraft {
  credentialCode: string;
  displayName: string;
  bio: string;
  specialties: string[];
  metabolicFocus: string;
  modality: Modality | "";
  city: string;
  stateUf: string;
  availabilityStatus: AvailabilityStatus;
}

function profileToForm(p: NetworkProfile): FormDraft {
  return {
    credentialCode: p.credentialCode ?? "",
    displayName: p.displayName ?? "",
    bio: p.bio ?? "",
    specialties: p.specialties.length ? p.specialties : [""],
    metabolicFocus: p.metabolicFocus ?? "",
    modality: p.modality ?? "",
    city: p.city ?? "",
    stateUf: p.stateUf ?? "",
    availabilityStatus: p.availabilityStatus ?? "available",
  };
}

export default function NetworkProfilePage() {
  const [profile, setProfile] = useState<NetworkProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<FormDraft>({
    credentialCode: "",
    displayName: "",
    bio: "",
    specialties: [""],
    metabolicFocus: "",
    modality: "",
    city: "",
    stateUf: "",
    availabilityStatus: "available",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishErrorDetails, setPublishErrorDetails] = useState<string[]>([]);

  useEffect(() => {
    getMyNetworkProfile()
      .then((p) => {
        if (p) {
          setProfile(p);
          setDraft(profileToForm(p));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function setField<K extends keyof FormDraft>(key: K, value: FormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
    setSaveError(null);
  }

  function updateSpecialty(idx: number, value: string) {
    setDraft((prev) => {
      const sp = [...prev.specialties];
      sp[idx] = value;
      return { ...prev, specialties: sp };
    });
    setSaveSuccess(false);
  }

  function addSpecialty() {
    if (draft.specialties.length >= 5) return;
    setDraft((prev) => ({ ...prev, specialties: [...prev.specialties, ""] }));
  }

  function removeSpecialty(idx: number) {
    if (draft.specialties.length <= 1) return;
    setDraft((prev) => ({ ...prev, specialties: prev.specialties.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const saved = await saveMyNetworkProfile({
        credentialCode: draft.credentialCode.trim(),
        displayName: draft.displayName.trim(),
        bio: draft.bio.trim() || null,
        specialties: draft.specialties.map((s) => s.trim()).filter(Boolean),
        metabolicFocus: draft.metabolicFocus.trim() || null,
        modality: draft.modality || null,
        city: draft.city.trim() || null,
        stateUf: draft.stateUf.trim().toUpperCase().slice(0, 2) || null,
        availabilityStatus: draft.availabilityStatus,
      });
      setProfile(saved);
      setSaveSuccess(true);
    } catch {
      setSaveError("Não foi possível salvar. Verifique os campos e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (publishing) return;
    setPublishError(null);
    setPublishErrorDetails([]);
    const missing = missingFields(draft);
    if (missing.length) {
      setPublishError("Preencha os campos obrigatórios antes de publicar:");
      setPublishErrorDetails(missing);
      return;
    }
    // Save first to persist latest edits
    setPublishing(true);
    try {
      await saveMyNetworkProfile({
        credentialCode: draft.credentialCode.trim(),
        displayName: draft.displayName.trim(),
        bio: draft.bio.trim() || null,
        specialties: draft.specialties.map((s) => s.trim()).filter(Boolean),
        metabolicFocus: draft.metabolicFocus.trim() || null,
        modality: draft.modality || null,
        city: draft.city.trim() || null,
        stateUf: draft.stateUf.trim().toUpperCase().slice(0, 2) || null,
        availabilityStatus: draft.availabilityStatus,
      });
      const published = await publishMyNetworkProfile();
      setProfile(published);
      setDraft(profileToForm(published));
    } catch (err: unknown) {
      const e = err as { message?: string; details?: unknown };
      const details = Array.isArray(e.details) ? (e.details as string[]) : [];
      if (e.message === "incomplete_profile" && details.length) {
        setPublishError("Preencha os campos obrigatórios antes de publicar:");
        setPublishErrorDetails(details);
      } else {
        setPublishError("Não foi possível publicar o perfil. Tente novamente.");
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (publishing) return;
    setPublishError(null);
    setPublishing(true);
    try {
      const updated = await unpublishMyNetworkProfile();
      setProfile(updated);
    } catch {
      setPublishError("Não foi possível despublicar. Tente novamente.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>
      </div>
    );
  }

  const isPublished = profile?.publicationStatus === "approved";

  return (
    <div style={{ padding: "24px 0", maxWidth: 640 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: "-0.02em" }}>
          Meu perfil na rede
        </h1>
        <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
          Seu perfil publicado aparece para alunos que buscam profissionais de acompanhamento.
        </p>
      </div>

      {/* Status banner */}
      <div
        className="card cardPad"
        style={{
          marginBottom: 20,
          background: isPublished ? "rgba(34,197,94,.08)" : "var(--color-surface-raised)",
          border: `1.5px solid ${isPublished ? "var(--color-success,#22C55E)" : "var(--color-border)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: isPublished ? "var(--color-success,#22C55E)" : COLORS.muted,
              marginBottom: 2,
            }}
          >
            {isPublished ? "Publicado" : "Rascunho"}
          </div>
          <div style={{ fontSize: 13, color: COLORS.text }}>
            {isPublished
              ? "Você aparece na busca de profissionais da rede."
              : "Perfil não visível para alunos ainda. Publique quando estiver pronto."}
          </div>
        </div>
        {isPublished ? (
          <button
            type="button"
            onClick={() => void handleUnpublish()}
            disabled={publishing}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1.5px solid var(--color-danger,#ef4444)",
              background: "none",
              color: "var(--color-danger,#ef4444)",
              fontWeight: 600,
              fontSize: 13,
              cursor: publishing ? "not-allowed" : "pointer",
              opacity: publishing ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {publishing ? "Aguarde..." : "Despublicar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishing}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: COLORS.primary,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: publishing ? "not-allowed" : "pointer",
              opacity: publishing ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {publishing ? "Publicando..." : "Publicar perfil"}
          </button>
        )}
      </div>

      {publishError && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(239,68,68,.08)",
            border: "1px solid var(--color-danger,#ef4444)",
            fontSize: 13,
            color: "var(--color-danger,#ef4444)",
          }}
        >
          {publishError}
          {publishErrorDetails.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {publishErrorDetails.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Form */}
      <div className="card cardPad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Credential code */}
        <div className="field">
          <label className="label" htmlFor="credentialCode">
            Código de registro <span style={{ color: COLORS.danger }}>*</span>
            <span style={{ color: COLORS.muted, fontWeight: 400, marginLeft: 4, fontSize: 11 }}>(CRM, CRN, CREF…)</span>
          </label>
          <input
            id="credentialCode"
            className="input"
            value={draft.credentialCode}
            onChange={(e) => setField("credentialCode", e.target.value)}
            placeholder="Ex: CREF 012345-G/SP"
            maxLength={32}
          />
        </div>

        {/* Display name */}
        <div className="field">
          <label className="label" htmlFor="displayName">
            Nome de exibição <span style={{ color: COLORS.danger }}>*</span>
          </label>
          <input
            id="displayName"
            className="input"
            value={draft.displayName}
            onChange={(e) => setField("displayName", e.target.value)}
            placeholder="Como você quer ser chamado(a) pelos alunos"
            maxLength={120}
          />
        </div>

        {/* Bio */}
        <div className="field">
          <label className="label" htmlFor="bio">
            Bio <span style={{ color: COLORS.danger }}>*</span>
            <span style={{ color: COLORS.muted, fontWeight: 400, marginLeft: 4, fontSize: 11 }}>(máx. 280 chars)</span>
          </label>
          <textarea
            id="bio"
            className="input"
            rows={3}
            maxLength={280}
            value={draft.bio}
            onChange={(e) => setField("bio", e.target.value)}
            placeholder="Apresentação curta: quem você é, como trabalha, o que diferencia seu acompanhamento"
            style={{ resize: "vertical" }}
          />
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2, textAlign: "right" }}>
            {draft.bio.length}/280
          </div>
        </div>

        {/* Specialties */}
        <div className="field">
          <label className="label">
            Especialidades <span style={{ color: COLORS.danger }}>*</span>
            <span style={{ color: COLORS.muted, fontWeight: 400, marginLeft: 4, fontSize: 11 }}>(máx. 5)</span>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {draft.specialties.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <input
                  className="input"
                  value={s}
                  onChange={(e) => updateSpecialty(i, e.target.value)}
                  placeholder={`Especialidade ${i + 1}`}
                  maxLength={60}
                  style={{ flex: 1 }}
                />
                {draft.specialties.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSpecialty(i)}
                    style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", fontSize: 18, padding: "0 4px" }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {draft.specialties.length < 5 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 6 }}
              onClick={addSpecialty}
            >
              + Adicionar especialidade
            </button>
          )}
        </div>

        {/* Modality */}
        <div className="field">
          <label className="label" htmlFor="modality">
            Modalidade de atendimento <span style={{ color: COLORS.danger }}>*</span>
          </label>
          <select
            id="modality"
            className="input"
            value={draft.modality}
            onChange={(e) => setField("modality", e.target.value as Modality | "")}
          >
            <option value="">Selecione</option>
            {(Object.entries(MODALITY_LABELS) as [Modality, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* City / State */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <div className="field">
            <label className="label" htmlFor="city">Cidade</label>
            <input
              id="city"
              className="input"
              value={draft.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="Ex: Belo Horizonte"
              maxLength={120}
            />
          </div>
          <div className="field" style={{ width: 64 }}>
            <label className="label" htmlFor="stateUf">UF</label>
            <input
              id="stateUf"
              className="input"
              value={draft.stateUf}
              onChange={(e) => setField("stateUf", e.target.value.toUpperCase().slice(0, 2))}
              placeholder="MG"
              maxLength={2}
            />
          </div>
        </div>

        {/* Metabolic focus */}
        <div className="field">
          <label className="label" htmlFor="metabolicFocus">
            Foco de acompanhamento metabólico
            <span style={{ color: COLORS.muted, fontWeight: 400, marginLeft: 4, fontSize: 11 }}>(opcional, máx. 200)</span>
          </label>
          <input
            id="metabolicFocus"
            className="input"
            value={draft.metabolicFocus}
            onChange={(e) => setField("metabolicFocus", e.target.value.slice(0, 200))}
            placeholder="Ex: Perda de peso com preservação muscular, qualidade do sono"
          />
        </div>

        {/* Availability */}
        <div className="field">
          <label className="label" htmlFor="availabilityStatus">Disponibilidade</label>
          <select
            id="availabilityStatus"
            className="input"
            value={draft.availabilityStatus}
            onChange={(e) => setField("availabilityStatus", e.target.value as AvailabilityStatus)}
          >
            {(Object.entries(AVAILABILITY_LABELS) as [AvailabilityStatus, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {saveError && (
          <div style={{ fontSize: 12, color: COLORS.danger }}>{saveError}</div>
        )}
        {saveSuccess && (
          <div style={{ fontSize: 12, color: "var(--color-success,#22C55E)" }}>
            Alterações salvas com sucesso.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn btn-primary"
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
          {!isPublished && (
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                border: `1.5px solid ${COLORS.primary}`,
                background: "none",
                color: COLORS.primary,
                fontWeight: 600,
                fontSize: 13,
                cursor: publishing ? "not-allowed" : "pointer",
                opacity: publishing ? 0.6 : 1,
              }}
            >
              {publishing ? "Publicando..." : "Salvar e publicar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
