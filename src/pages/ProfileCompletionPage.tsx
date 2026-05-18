// src/pages/ProfileCompletionPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";
import { API_URL, parseJson } from "../services/apiBase";
import { authFetch } from "../services/apiClient";
import { getAccessToken } from "../services/authTokens";
import { useNeonTheme } from "../theme/minutofitNeonTheme";

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
      // Validate required fields
      if (
        !formData.name ||
        !formData.fitnessGoal ||
        !formData.experienceLevel ||
        !formData.heightCm ||
        !formData.weightKg
      ) {
        setError("Por favor, preencha todos os campos obrigatórios");
        setIsLoading(false);
        return;
      }

      if (!getAccessToken()) {
        setError("Token not found. Please login again.");
        nav("/login", { replace: true });
        return;
      }

      const response = await authFetch(`${API_URL}/auth/complete-profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
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

      if (response.status === 401) {
        return;
      }

      if (!response.ok) {
        const data = await parseJson(response);
        throw new Error(data?.error || "Failed to complete profile");
      }

      // Redirect to appropriate dashboard based on role
      nav(nextPathByRole(auth.role as Role), { replace: true });
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: neon.bg,
        color: neon.text,
        display: "grid",
        placeItems: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "min(600px, 100%)",
          minWidth: 0,
          background: neon.panel,
          border: `1px solid ${neon.border}`,
          borderRadius: 16,
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 600 }}>Complete seu Perfil</div>
          <div style={{ color: neon.muted, marginTop: 8 }}>
            Precisamos de algumas informações para personalizar sua experiência
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: neon.dangerSoft,
              border: `1px solid ${neon.dangerBorder}`,
              padding: 12,
              borderRadius: 12,
              marginBottom: 16,
              color: neon.text,
            }}
          >
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {/* Name */}
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: neon.muted, fontSize: 13, fontWeight: 600 }}>
              Nome Completo *
            </span>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="João Silva"
              disabled={isLoading}
              style={{
                background: "#101010",
                color: neon.text,
                border: `1px solid ${neon.border}`,
                borderRadius: 12,
                padding: "12px 12px",
                outline: "none",
                opacity: isLoading ? 0.7 : 1,
              }}
            />
          </label>

          {/* Fitness Goal */}
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: neon.muted, fontSize: 13, fontWeight: 600 }}>
              Seu Objetivo *
            </span>
            <select
              value={formData.fitnessGoal}
              onChange={(e) => setFormData({ ...formData, fitnessGoal: e.target.value })}
              disabled={isLoading}
              style={{
                background: "#101010",
                color: neon.text,
                border: `1px solid ${neon.border}`,
                borderRadius: 12,
                padding: "12px 12px",
                outline: "none",
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              <option value="">Selecione um objetivo</option>
              {FITNESS_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </label>

          {/* Experience Level */}
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: neon.muted, fontSize: 13, fontWeight: 600 }}>
              Nível de Experiência *
            </span>
            <select
              value={formData.experienceLevel}
              onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
              disabled={isLoading}
              style={{
                background: "#101010",
                color: neon.text,
                border: `1px solid ${neon.border}`,
                borderRadius: 12,
                padding: "12px 12px",
                outline: "none",
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              <option value="">Selecione um nível</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          {/* Height & Weight */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: neon.muted, fontSize: 13, fontWeight: 600 }}>
                Altura (cm) *
              </span>
              <input
                type="number"
                value={formData.heightCm}
                onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                placeholder="170"
                min="100"
                max="250"
                disabled={isLoading}
                style={{
                  background: "#101010",
                  color: neon.text,
                  border: `1px solid ${neon.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                  opacity: isLoading ? 0.7 : 1,
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: neon.muted, fontSize: 13, fontWeight: 600 }}>
                Peso (kg) *
              </span>
              <input
                type="number"
                value={formData.weightKg}
                onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                placeholder="75"
                min="30"
                max="300"
                disabled={isLoading}
                style={{
                  background: "#101010",
                  color: neon.text,
                  border: `1px solid ${neon.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                  opacity: isLoading ? 0.7 : 1,
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: neon.muted, fontSize: 13, fontWeight: 600 }}>
                Circunferência da cintura (cm)
              </span>
              <input
                type="number"
                value={formData.waistCm}
                onChange={(e) => setFormData({ ...formData, waistCm: e.target.value })}
                placeholder="92"
                min="40"
                max="250"
                step="0.1"
                disabled={isLoading}
                style={{
                  background: "#101010",
                  color: neon.text,
                  border: `1px solid ${neon.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                  opacity: isLoading ? 0.7 : 1,
                }}
              />
              <span style={{ color: neon.muted, fontSize: 12, lineHeight: 1.45 }}>
                Ajuda a entender seu estado metabólico — pode pular.
              </span>
            </label>
          </div>

          {/* Dietary Restrictions */}
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: neon.muted, fontSize: 13, fontWeight: 600 }}>
              Restrições Dietéticas
            </span>
            <textarea
              value={formData.dietaryRestrictions}
              onChange={(e) => setFormData({ ...formData, dietaryRestrictions: e.target.value })}
              placeholder="Ex: Vegetariano, Sem glúten, Sem lactose..."
              disabled={isLoading}
              rows={3}
              style={{
                background: "#101010",
                color: neon.text,
                border: `1px solid ${neon.border}`,
                borderRadius: 12,
                padding: "12px 12px",
                outline: "none",
                fontFamily: "inherit",
                opacity: isLoading ? 0.7 : 1,
              }}
            />
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 12,
              background: neon.ctaGradient,
              color: neon.ctaText,
              border: `1px solid ${neon.accentBorder}`,
              borderRadius: 12,
              padding: "14px 16px",
              fontWeight: 600,
              fontSize: 16,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              minHeight: 44,
            }}
          >
            {isLoading ? "Salvando..." : "Completar Perfil e Continuar"}
          </button>

          <div style={{ color: neon.muted, fontSize: 12, textAlign: "center" }}>
            * Campos obrigatórios
          </div>
        </form>
      </div>
    </div>
  );
}
