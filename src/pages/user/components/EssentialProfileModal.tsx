import React, { useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { useToast } from "../../../components/Toast";
import { API_URL } from "../../../services/apiBase";
import { authFetch } from "../../../services/apiClient";
import { COLORS } from "../../../styles/colors";

// Mesmas listas do onboarding (ProfileCompletionPage.tsx) — duplicadas de
// propósito para não acoplar o fluxo de cadastro à edição do perfil.
const EXPERIENCE_LEVELS = ["Iniciante", "Intermediário", "Avançado"];
const FITNESS_GOALS = ["Perda de Peso", "Ganho de Massa", "Manutenção", "Flexibilidade"];

type Props = {
  open: boolean;
  onClose: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: "var(--font-semibold)", fontSize: "var(--text-sm)", color: COLORS.text }}>{label}</span>
      {children}
    </label>
  );
}

const controlStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.panelDeep,
  color: COLORS.text,
  outline: "none",
  fontWeight: 600,
};

/**
 * Edição in-place do "Perfil essencial" (objetivo, nível, altura, peso).
 * Um único salvar → PATCH /auth/complete-profile com payload completo, ecoando
 * name/photoUrl/dietaryRestrictions atuais (o backend sobrescreve incondicional-
 * mente esses campos). No-op quando nada mudou, evitando um check-in metabólico
 * espúrio (a rota cria um a cada chamada).
 */
export default function EssentialProfileModal({ open, onClose }: Props) {
  const { user, getUser } = useAuth();
  const toast = useToast();

  const [fitnessGoal, setFitnessGoal] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFitnessGoal(user?.fitnessGoal || "");
    setExperienceLevel(user?.experienceLevel || "");
    setHeightCm(user?.heightCm ? String(user.heightCm) : "");
    setWeightKg(user?.weightKg ? String(user.weightKg) : "");
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const nothingChanged =
    fitnessGoal === (user?.fitnessGoal || "") &&
    experienceLevel === (user?.experienceLevel || "") &&
    heightCm === (user?.heightCm ? String(user.heightCm) : "") &&
    weightKg === (user?.weightKg ? String(user.weightKg) : "");

  async function save() {
    if (nothingChanged) { onClose(); return; }
    if (!user?.name?.trim()) { toast.error("Complete seu nome antes de salvar o perfil."); return; }
    if (!fitnessGoal || !experienceLevel) { toast.error("Escolha objetivo e nível."); return; }
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    if (!Number.isFinite(h) || h <= 0) { toast.error("Informe uma altura válida."); return; }
    if (!Number.isFinite(w) || w < 20 || w > 500) { toast.error("Informe um peso entre 20 e 500 kg."); return; }

    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/auth/complete-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          photoUrl: user.photoUrl ?? null,
          fitnessGoal,
          experienceLevel,
          heightCm: h,
          weightKg: w,
          dietaryRestrictions: user.dietaryRestrictions ?? null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Não foi possível salvar seu perfil.");
      }
      await getUser();
      toast.success("Perfil atualizado.");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "var(--space-4)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="essential-profile-title"
        style={{
          background: "var(--color-surface)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-6)",
          maxWidth: 460,
          width: "100%",
          boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.18))",
        }}
      >
        <p
          id="essential-profile-title"
          style={{ margin: 0, fontWeight: "var(--font-bold)", fontSize: "var(--text-lg)", color: COLORS.text }}
        >
          Perfil essencial
        </p>
        <div style={{ display: "grid", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
          <Field label="Objetivo">
            <select value={fitnessGoal} onChange={(e) => setFitnessGoal(e.target.value)} style={controlStyle}>
              <option value="">Selecionar…</option>
              {FITNESS_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Nível">
            <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} style={controlStyle}>
              <option value="">Selecionar…</option>
              {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Altura (cm)">
              <input
                type="number" inputMode="numeric" value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="175" style={controlStyle}
              />
            </Field>
            <Field label="Peso (kg)">
              <input
                type="number" inputMode="decimal" value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="72" style={controlStyle}
              />
            </Field>
          </div>
        </div>
        <div style={{ marginTop: "var(--space-5)", display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
