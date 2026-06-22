// src/pages/ProfileCompletionPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";
import { API_URL, parseJson } from "../services/apiBase";
import { authFetch } from "../services/apiClient";
import { getAccessToken } from "../services/authTokens";
import { useNeonTheme } from "../theme/corefitNeonTheme";

const EXPERIENCE_LEVELS = ["Iniciante", "Intermediário", "Avançado"];
const FITNESS_GOALS = ["Perda de Peso", "Ganho de Massa", "Manutenção", "Flexibilidade"];

function nextPathByRole(role: Role) {
  switch (role) {
    case "user":
      return "/app/user/today";
    case "personal":
      return "/app/personal";
    case "nutri":
      return "/app/nutri";
    case "admin":
      return "/app/admin";
    default:
      return "/login";
  }
}

export default function ProfileCompletionPage() {
  const nav = useNavigate();
  const auth = useAuth();
  const neon = useNeonTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    photoUrl: "",
    fitnessGoal: "",
    experienceLevel: "",
    heightCm: "",
    weightKg: "",
    waistCm: "",
    dietaryRestrictions: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (
        !formData.name ||
        !formData.fitnessGoal ||
        !formData.experienceLevel ||
        !formData.heightCm ||
        !formData.weightKg
      ) {
        setError("Preencha os campos obrigatórios para continuar.");
        setIsLoading(false);
        return;
      }

      if (!getAccessToken()) {
        setError("Sessão expirada. Faça login novamente.");
        nav("/login", { replace: true });
        return;
      }

      const response = await authFetch(`${API_URL}/auth/complete-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          photoUrl: formData.photoUrl || null,
          fitnessGoal: formData.fitnessGoal,
          experienceLevel: formData.experienceLevel,
          heightCm: parseFloat(formData.heightCm),
          weightKg: parseFloat(formData.weightKg),
          waistCm: formData.waistCm ? parseFloat(formData.waistCm) : null,
          dietaryRestrictions: formData.dietaryRestrictions || null,
        }),
      });

      if (response.status === 401) return;

      if (!response.ok) {
        const data = await parseJson(response);
        throw new Error(data?.error || "Não foi possível salvar seu perfil.");
      }

      // Refresh auth state so profileCompleted flips to true; otherwise
      // ProtectedRoute bounces the user right back to /profile-completion.
      const refreshed = await auth.getUser();
      nav(nextPathByRole((refreshed?.role ?? auth.role) as Role), { replace: true });
    } catch (err: any) {
      setError(err.message || "Algo deu errado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  const inputBase = (id: string): React.CSSProperties => ({
    background: neon.panel,
    color: neon.text,
    border: `1px solid ${focusedField === id ? neon.primary : neon.border}`,
    boxShadow: focusedField === id ? `0 0 0 3px ${neon.primarySoft}` : "none",
    borderRadius: 10,
    padding: "12px 13px",
    outline: "none",
    fontSize: 16, // 16px evita zoom automático no iOS ao focar
    fontFamily: "inherit",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
    opacity: isLoading ? 0.65 : 1,
    width: "100%",
    boxSizing: "border-box",
    appearance: "none",
    WebkitAppearance: "none",
  });

  const labelText: React.CSSProperties = {
    color: neon.text,
    fontSize: 13,
    fontWeight: 500,
    display: "flex",
    alignItems: "baseline",
    gap: 6,
  };

  const optionalTag: React.CSSProperties = {
    color: neon.muted2,
    fontSize: 12,
    fontWeight: 400,
  };

  const helperText: React.CSSProperties = {
    color: neon.muted,
    fontSize: 12,
    lineHeight: 1.5,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: neon.muted,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    margin: "8px 0 4px",
  };

  return (
    <div
      className="profile-completion-page"
      style={{
        minHeight: "100vh",
        background: neon.bg,
        color: neon.text,
        display: "grid",
        placeItems: "start center",
        padding: "32px 16px 48px",
        boxSizing: "border-box",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @media (max-width: 520px) {
          .profile-completion-page { padding: 20px 14px 36px !important; }
          .pc-card { padding: 18px 16px 18px !important; border-radius: 12px !important; }
          .pc-header { margin-bottom: 18px !important; }
          .pc-title { font-size: 22px !important; }
          .pc-subtitle { font-size: 14px !important; }
          .pc-eyebrow { font-size: 10.5px !important; }
        }
        @media (max-width: 360px) {
          .pc-metrics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div className="pc-header" style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            className="pc-eyebrow"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: neon.primary,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Passo final
          </div>
          <h1
            className="pc-title"
            style={{
              fontSize: 26,
              fontWeight: 600,
              margin: 0,
              color: neon.text,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            Vamos personalizar seu acompanhamento
          </h1>
          <p
            className="pc-subtitle"
            style={{
              color: neon.muted,
              marginTop: 10,
              fontSize: 14.5,
              lineHeight: 1.55,
              maxWidth: 420,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Esses dados ajudam o CoreFit a interpretar seus sinais e adaptar
            sua rotina. Você pode atualizar tudo depois.
          </p>
        </div>

        <div
          className="pc-card"
          style={{
            background: neon.panel,
            border: `1px solid ${neon.border}`,
            borderRadius: 14,
            padding: "24px 24px 22px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
            boxSizing: "border-box",
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                background: neon.dangerSoft,
                border: `1px solid ${neon.dangerBorder}`,
                padding: "10px 12px",
                borderRadius: 10,
                marginBottom: 18,
                color: neon.danger,
                fontSize: 13.5,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={sectionTitle}>Sobre você</div>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={labelText}>Nome completo</span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Como você gosta de ser chamado"
                  disabled={isLoading}
                  required
                  style={inputBase("name")}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={sectionTitle}>Seu objetivo</div>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={labelText}>O que você quer alcançar?</span>
                <select
                  value={formData.fitnessGoal}
                  onChange={(e) => setFormData({ ...formData, fitnessGoal: e.target.value })}
                  onFocus={() => setFocusedField("goal")}
                  onBlur={() => setFocusedField(null)}
                  disabled={isLoading}
                  required
                  style={inputBase("goal")}
                >
                  <option value="">Selecione…</option>
                  {FITNESS_GOALS.map((goal) => (
                    <option key={goal} value={goal}>
                      {goal}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={labelText}>Seu nível atual</span>
                <select
                  value={formData.experienceLevel}
                  onChange={(e) =>
                    setFormData({ ...formData, experienceLevel: e.target.value })
                  }
                  onFocus={() => setFocusedField("level")}
                  onBlur={() => setFocusedField(null)}
                  disabled={isLoading}
                  required
                  style={inputBase("level")}
                >
                  <option value="">Selecione…</option>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={sectionTitle}>Composição corporal</div>

              <div
                className="pc-metrics-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={labelText}>Altura (cm)</span>
                  <input
                    type="number"
                    value={formData.heightCm}
                    onChange={(e) =>
                      setFormData({ ...formData, heightCm: e.target.value })
                    }
                    onFocus={() => setFocusedField("height")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="170"
                    min="100"
                    max="250"
                    disabled={isLoading}
                    required
                    style={inputBase("height")}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={labelText}>Peso (kg)</span>
                  <input
                    type="number"
                    value={formData.weightKg}
                    onChange={(e) =>
                      setFormData({ ...formData, weightKg: e.target.value })
                    }
                    onFocus={() => setFocusedField("weight")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="75"
                    min="30"
                    max="300"
                    step="0.1"
                    disabled={isLoading}
                    required
                    style={inputBase("weight")}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={labelText}>
                  Cintura (cm) <span style={optionalTag}>· opcional</span>
                </span>
                <input
                  type="number"
                  value={formData.waistCm}
                  onChange={(e) =>
                    setFormData({ ...formData, waistCm: e.target.value })
                  }
                  onFocus={() => setFocusedField("waist")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="92"
                  min="40"
                  max="250"
                  step="0.1"
                  disabled={isLoading}
                  style={inputBase("waist")}
                />
                <span style={helperText}>
                  Ajuda a refinar a leitura do seu estado metabólico.
                </span>
              </label>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={sectionTitle}>Alimentação</div>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={labelText}>
                  Restrições alimentares <span style={optionalTag}>· opcional</span>
                </span>
                <textarea
                  value={formData.dietaryRestrictions}
                  onChange={(e) =>
                    setFormData({ ...formData, dietaryRestrictions: e.target.value })
                  }
                  onFocus={() => setFocusedField("diet")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Ex: vegetariano, sem glúten, sem lactose…"
                  disabled={isLoading}
                  rows={3}
                  style={{ ...inputBase("diet"), resize: "vertical", minHeight: 80 }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  background: neon.primary,
                  color: neon.ctaText,
                  border: "none",
                  borderRadius: 10,
                  padding: "13px 16px",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                  minHeight: 46,
                  transition: "filter 120ms ease",
                  letterSpacing: "-0.005em",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.currentTarget.style.filter = "brightness(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "none";
                }}
              >
                {isLoading ? "Salvando…" : "Concluir e entrar"}
              </button>

              <div
                style={{
                  color: neon.muted2,
                  fontSize: 12,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                Seus dados são privados. Apenas você e profissionais autorizados
                têm acesso.
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
