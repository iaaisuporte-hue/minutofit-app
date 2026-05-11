import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../auth/AuthContext";
import { fetchBranding, saveBranding, type AcademyBranding } from "../../services/academyApi";

// ── Contrast calculation (WCAG 2.1) ────────────────────────────────────────────

function linearize(val: number): number {
  const v = val / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hex: string, bg = "#FFFFFF"): number {
  const rgbA = hexToRgb(hex);
  const rgbB = hexToRgb(bg);
  if (!rgbA || !rgbB) return 0;
  const lumA = relativeLuminance(...rgbA);
  const lumB = relativeLuminance(...rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker  = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function ContrastBadge({ hex, min, label }: { hex: string; min: number; label: string }) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const ratio = contrastRatio(hex);
  const pass = ratio >= min;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: "var(--text-xs)", fontWeight: 500,
      color: pass ? "var(--color-success)" : "var(--color-danger)",
      marginTop: 4,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: pass ? "var(--color-success)" : "var(--color-danger)",
        flexShrink: 0,
      }} />
      {label}: {ratio.toFixed(2)}:1 {pass ? "✓" : `(mín ${min}:1)`}
    </span>
  );
}

// ── Form shape ─────────────────────────────────────────────────────────────────

interface BrandingForm {
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  welcomeMessage: string;
  logoUrl: string;
  bannerUrl: string;
}

const EMPTY: BrandingForm = {
  displayName: "",
  primaryColor: "#22c55e",
  secondaryColor: "#22c55e",
  accentColor: "#06b6d4",
  welcomeMessage: "",
  logoUrl: "",
  bannerUrl: "",
};

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AcademyBrandingSettingsPage() {
  const { activeAcademyId } = useAuth();

  const [form, setForm]       = useState<BrandingForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!activeAcademyId) { setLoading(false); return; }
    fetchBranding()
      .then((b: AcademyBranding | null) => {
        if (b) {
          setForm({
            displayName:    b.displayName    ?? "",
            primaryColor:   b.primaryColor   ?? EMPTY.primaryColor,
            secondaryColor: b.secondaryColor ?? EMPTY.secondaryColor,
            accentColor:    b.accentColor    ?? EMPTY.accentColor,
            welcomeMessage: b.welcomeMessage ?? "",
            logoUrl:        b.logoUrl        ?? "",
            bannerUrl:      b.bannerUrl      ?? "",
          });
        }
      })
      .catch(() => { /* ignore — use defaults */ })
      .finally(() => setLoading(false));
  }, [activeAcademyId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await saveBranding({
        displayName:    form.displayName    || undefined,
        primaryColor:   form.primaryColor   || undefined,
        secondaryColor: form.secondaryColor || undefined,
        accentColor:    form.accentColor    || undefined,
        welcomeMessage: form.welcomeMessage || undefined,
        logoUrl:        form.logoUrl        || undefined,
        bannerUrl:      form.bannerUrl      || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const setField = useCallback(<K extends keyof BrandingForm>(key: K, value: BrandingForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const previewStyle: React.CSSProperties = preview
    ? ({
        "--color-primary":       form.primaryColor,
        "--color-primary-hover": form.primaryColor,
        "--color-secondary":     form.secondaryColor,
        "--color-accent":        form.accentColor,
      } as React.CSSProperties)
    : {};

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">Academia</div>
          <h1 className="page-title">Identidade Visual</h1>
          <p className="page-subtitle">
            Personalize cores, logo e textos da sua academia. Validação WCAG AA aplicada antes de salvar.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button type="button" className="btn btn-secondary" onClick={() => setPreview((p) => !p)}>
            {preview ? "Ocultar preview" : "Ver preview"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="dash-skeleton-bar" style={{ height: 300, borderRadius: "var(--radius-md)" }} />
      )}

      {!loading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: preview ? "1fr 300px" : "1fr",
          gap: "var(--space-6)",
          alignItems: "start",
        }}>
          <form onSubmit={handleSave} noValidate>

            {error && (
              <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>{error}</div>
            )}
            {success && (
              <div style={{
                padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-md)",
                background: "var(--color-primary-soft)", color: "var(--color-primary)",
                marginBottom: "var(--space-4)", fontSize: "var(--text-sm)", fontWeight: 500,
              }}>
                Branding salvo com sucesso.
              </div>
            )}

            {/* ── Identidade ── */}
            <div className="card" style={{ marginBottom: "var(--space-5)" }}>
              <div className="card-header">
                <h2 className="card-title">Identidade</h2>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="br-name">Nome de exibição</label>
                  <input
                    id="br-name"
                    className="input"
                    value={form.displayName}
                    onChange={(e) => setField("displayName", e.target.value)}
                    maxLength={100}
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
                    onChange={(e) => setField("welcomeMessage", e.target.value)}
                    maxLength={200}
                    placeholder="Exibida na tela de login dos alunos"
                    disabled={saving}
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>
            </div>

            {/* ── Imagens ── */}
            <div className="card" style={{ marginBottom: "var(--space-5)" }}>
              <div className="card-header">
                <h2 className="card-title">Imagens</h2>
                <p className="card-subtitle" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  URLs devem apontar para o CDN ou S3 do MinutoFit (HTTPS).
                </p>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="br-logo">URL do logo</label>
                  <input
                    id="br-logo"
                    className="input"
                    type="url"
                    value={form.logoUrl}
                    onChange={(e) => setField("logoUrl", e.target.value)}
                    placeholder="https://cdn.minutofit.com.br/logos/academia.png"
                    disabled={saving}
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="br-banner">URL do banner de login</label>
                  <input
                    id="br-banner"
                    className="input"
                    type="url"
                    value={form.bannerUrl}
                    onChange={(e) => setField("bannerUrl", e.target.value)}
                    placeholder="https://cdn.minutofit.com.br/banners/academia.jpg"
                    disabled={saving}
                  />
                  <span className="field-hint">Exibido acima do formulário de login (recomendado: 1200×400px).</span>
                </div>
              </div>
            </div>

            {/* ── Cores ── */}
            <div className="card" style={{ marginBottom: "var(--space-5)" }}>
              <div className="card-header">
                <h2 className="card-title">Cores</h2>
                <p className="card-subtitle" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  O backend valida WCAG AA antes de salvar. O indicador abaixo é uma pré-verificação no cliente.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-5)" }}>
                <div>
                  <ColorField
                    id="br-primary"
                    label="Cor primária"
                    hint="Botões e destaques. Contraste ≥ 4.5:1 vs fundo branco."
                    value={form.primaryColor}
                    onChange={(v) => setField("primaryColor", v)}
                    disabled={saving}
                  />
                  <ContrastBadge hex={form.primaryColor} min={4.5} label="Contraste" />
                </div>

                <div>
                  <ColorField
                    id="br-secondary"
                    label="Cor secundária"
                    hint="Elementos de apoio. Contraste ≥ 4.5:1."
                    value={form.secondaryColor}
                    onChange={(v) => setField("secondaryColor", v)}
                    disabled={saving}
                  />
                  <ContrastBadge hex={form.secondaryColor} min={4.5} label="Contraste" />
                </div>

                <div>
                  <ColorField
                    id="br-accent"
                    label="Cor de destaque"
                    hint="Acentos e links. Contraste ≥ 3:1."
                    value={form.accentColor}
                    onChange={(v) => setField("accentColor", v)}
                    disabled={saving}
                  />
                  <ContrastBadge hex={form.accentColor} min={3.0} label="Contraste" />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                {saving ? "Salvando…" : "Salvar branding"}
              </button>
            </div>
          </form>

          {/* ── Preview ── */}
          {preview && (
            <div style={{ ...previewStyle }}>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title" style={{ fontSize: "var(--text-sm)" }}>Preview</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {form.bannerUrl && (
                    <img
                      src={form.bannerUrl}
                      alt="Banner preview"
                      referrerPolicy="no-referrer"
                      style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Logo preview"
                      referrerPolicy="no-referrer"
                      style={{ height: 40, objectFit: "contain" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div style={{
                      padding: "var(--space-3)", background: "var(--color-primary)",
                      borderRadius: "var(--radius-md)", color: "#fff",
                      fontSize: "var(--text-sm)", fontWeight: 700,
                    }}>
                      {form.displayName || "MinutoFit Academia"}
                    </div>
                  )}
                  {form.welcomeMessage && (
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", margin: 0 }}>
                      {form.welcomeMessage}
                    </p>
                  )}
                  <button className="btn btn-primary" style={{ pointerEvents: "none" }}>
                    Entrar
                  </button>
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    {[
                      { c: form.primaryColor, l: "Primária" },
                      { c: form.secondaryColor, l: "Secundária" },
                      { c: form.accentColor, l: "Destaque" },
                    ].map(({ c, l }) => (
                      <div key={l} style={{ textAlign: "center" }}>
                        <span style={{
                          display: "block", width: 28, height: 28, borderRadius: "var(--radius-sm)",
                          background: c, border: "1px solid var(--color-border)",
                        }} title={c} />
                        <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{l}</span>
                      </div>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
          style={{
            width: 36, height: 36, padding: 2,
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
            cursor: "pointer", background: "transparent", flexShrink: 0,
          }}
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
