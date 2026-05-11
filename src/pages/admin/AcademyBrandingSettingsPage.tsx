import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { authFetch } from "../../services/apiClient";
import { API_URL, parseJson } from "../../services/apiBase";
import type { AcademyBranding } from "../../services/authApi";

interface BrandingForm {
  displayName: string;
  primaryColor: string;
  primaryHover: string;
  accentColor: string;
  welcomeMessage: string;
}

const EMPTY: BrandingForm = {
  displayName: "",
  primaryColor: "#22c55e",
  primaryHover: "#16a34a",
  accentColor: "#f59e0b",
  welcomeMessage: "",
};

export default function AcademyBrandingSettingsPage() {
  const { activeAcademyId } = useAuth();

  const [form, setForm]       = useState<BrandingForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!activeAcademyId) {
      setLoading(false);
      return;
    }
    loadBranding();
  }, [activeAcademyId]);

  async function loadBranding() {
    setLoading(true);
    try {
      const res  = await authFetch(`${API_URL}/academy/branding`);
      if (res.ok) {
        const data = await parseJson(res);
        const b: AcademyBranding = data?.data?.branding ?? {};
        setForm({
          displayName:    b.displayName    ?? "",
          primaryColor:   b.primaryColor   ?? EMPTY.primaryColor,
          primaryHover:   b.primaryHover   ?? EMPTY.primaryHover,
          accentColor:    b.accentColor    ?? EMPTY.accentColor,
          welcomeMessage: b.welcomeMessage ?? "",
        });
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res  = await authFetch(`${API_URL}/academy/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar branding.");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const previewStyle: React.CSSProperties = preview ? {
    "--color-primary":       form.primaryColor,
    "--color-primary-hover": form.primaryHover,
    "--color-accent":        form.accentColor,
  } as React.CSSProperties : {};

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">Academia</div>
          <h1 className="page-title">Identidade Visual</h1>
          <p className="page-subtitle">
            Personalize cores e textos da sua academia. As mudanças são aplicadas para todos os usuários.
          </p>
        </div>
      </div>

      {loading && (
        <div className="dash-skeleton-bar" style={{ height: 200, borderRadius: "var(--radius-md)" }} />
      )}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-6)", alignItems: "start" }}>
          <form onSubmit={handleSave} noValidate>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Configurações</h2>
              </div>

              {error && (
                <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-md)", background: "var(--color-primary-soft)", color: "var(--color-primary)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  Branding salvo com sucesso.
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="br-name">Nome de exibição</label>
                <input
                  id="br-name"
                  className="input"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  maxLength={60}
                  placeholder="Nome da academia para os alunos"
                  disabled={saving}
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="br-welcome">Mensagem de boas-vindas</label>
                <textarea
                  id="br-welcome"
                  className="input"
                  rows={2}
                  value={form.welcomeMessage}
                  onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
                  maxLength={200}
                  placeholder="Exibida no app do aluno ao entrar"
                  disabled={saving}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
                <ColorField
                  id="br-primary"
                  label="Cor primária"
                  hint="Botões e destaques. Contraste ≥ 4.5:1."
                  value={form.primaryColor}
                  onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))}
                  disabled={saving}
                />
                <ColorField
                  id="br-hover"
                  label="Cor hover"
                  hint="Estado hover/foco da cor primária."
                  value={form.primaryHover}
                  onChange={(v) => setForm((f) => ({ ...f, primaryHover: v }))}
                  disabled={saving}
                />
                <ColorField
                  id="br-accent"
                  label="Cor de destaque"
                  hint="Acentos secundários. Contraste ≥ 3:1."
                  value={form.accentColor}
                  onChange={(v) => setForm((f) => ({ ...f, accentColor: v }))}
                  disabled={saving}
                />
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-6)" }}>
                <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                  {saving ? "Salvando…" : "Salvar branding"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPreview((p) => !p)}
                >
                  {preview ? "Ocultar preview" : "Ver preview"}
                </button>
              </div>
            </div>
          </form>

          {/* Preview */}
          {preview && (
            <div style={{ ...previewStyle, minWidth: 280 }}>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title" style={{ fontSize: "var(--text-sm)" }}>Preview</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <div style={{
                    padding: "var(--space-4)",
                    background: "var(--color-primary)",
                    borderRadius: "var(--radius-md)",
                    color: "#fff",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                  }}>
                    {form.displayName || "Nome da academia"}
                  </div>
                  {form.welcomeMessage && (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                      {form.welcomeMessage}
                    </p>
                  )}
                  <button className="btn btn-primary" style={{ pointerEvents: "none" }}>
                    Botão primário
                  </button>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    {[form.primaryColor, form.primaryHover, form.accentColor].map((c, i) => (
                      <span
                        key={i}
                        style={{
                          width: 28, height: 28, borderRadius: "var(--radius-sm)",
                          background: c, border: "1px solid var(--color-border)",
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ColorField({
  id, label, hint, value, onChange, disabled,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ width: 36, height: 36, padding: 2, border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "transparent" }}
        />
        <input
          type="text"
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          placeholder="#000000"
          disabled={disabled}
          style={{ fontFamily: "monospace", fontSize: "var(--text-sm)" }}
        />
      </div>
      <span className="field-hint">{hint}</span>
    </div>
  );
}
