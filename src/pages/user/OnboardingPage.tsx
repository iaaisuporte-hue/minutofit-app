// src/pages/user/OnboardingPage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  buildRecommendation,
  loadAnswers,
  saveAnswers,
  saveRecommendation,
  setOnboardingDone,
  type OnboardingAnswers,
} from "./onboarding/onboardingStorage";

const COLORS = {
  bg: "#0F0F0F",
  panel: "#171717",
  border: "rgba(255,255,255,.10)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.70)",
  orange: "#FF6A00",
  orangeSoft: "rgba(255,106,0,.16)",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        background: COLORS.panel,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

const DEFAULT_ANSWERS: OnboardingAnswers = {
  ageRange: "18-25",
  gender: "na",
  goal: "saude",
  experience: "never",
  trainingPlace: "home",
  timePerDay: "20-30",
  injuries: ["none"],
  surgeryRecent: "no",
  conditions: ["none"],
  frequentPain: "no",
  clearedByDoctor: "yes",
  daysPerWeek: 3,
  bestTime: "variable",
  intensityPref: "progressive",
  equipmentPref: "both",
  wantsCloseFollow: "no",
};

function SelectRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 1000 }}>{label}</div>
        {value ? <div style={{ color: COLORS.muted, fontSize: 12 }}>{value}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: active ? "1px solid rgba(255,106,0,.45)" : `1px solid ${COLORS.border}`,
        background: active ? "rgba(255,106,0,.18)" : "transparent",
        color: COLORS.text,
        cursor: "pointer",
        fontWeight: 900,
      }}
    >
      {children}
    </button>
  );
}

function ToggleList<T extends string>({
  options,
  selected,
  onChange,
  allowNoneKey,
}: {
  options: Array<{ key: T; label: string }>;
  selected: T[];
  onChange: (next: T[]) => void;
  allowNoneKey?: T; // se existir um "none", ao selecionar ele limpa os demais
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const isActive = selected.includes(opt.key);
        return (
          <Pill
            key={opt.key}
            active={isActive}
            onClick={() => {
              if (allowNoneKey && opt.key === allowNoneKey) {
                onChange([allowNoneKey]);
                return;
              }

              const next = isActive ? selected.filter((s) => s !== opt.key) : [...selected, opt.key];

              if (allowNoneKey && next.includes(allowNoneKey) && next.length > 1) {
                onChange(next.filter((x) => x !== allowNoneKey));
              } else {
                onChange(next.length ? next : allowNoneKey ? [allowNoneKey] : []);
              }
            }}
          >
            {opt.label}
          </Pill>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const nav = useNavigate();
  const { id } = useAuth();

  const userId = (id ?? "").trim().toLowerCase();

  const initial = useMemo(() => {
    const loaded = userId ? loadAnswers(userId) : null;
    return loaded ?? DEFAULT_ANSWERS;
  }, [userId]);

  const [a, setA] = useState<OnboardingAnswers>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
  }

  function onSave() {
    setError(null);

    if (!userId) {
      setError("Não foi possível identificar o usuário logado. Faça login novamente.");
      return;
    }

    setSaving(true);
    try {
      saveAnswers(a, userId);
      const reco = buildRecommendation(a);
      saveRecommendation(reco, userId);
      setOnboardingDone(userId);

      // ✅ volta para o Today (banner some automaticamente ao checar isOnboardingDone(userId))
      nav("/app/user/today", { replace: true });
    } catch {
      setError("Falha ao salvar o onboarding. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14, color: COLORS.text }}>
      <Card>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Onboarding</div>
          <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.35 }}>
            Responda rápido para personalizarmos melhor seus treinos e recomendações.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => nav("/app/user/today")}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "transparent",
                color: COLORS.text,
                cursor: "pointer",
                fontWeight: 1000,
              }}
            >
              ← Voltar
            </button>

            <button
              onClick={onSave}
              disabled={saving}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,106,0,.35)",
                background: COLORS.orange,
                color: COLORS.bg,
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 1000,
                boxShadow: "0 10px 24px rgba(0,0,0,.35)",
              }}
            >
              {saving ? "Salvando..." : "✅ Concluir onboarding"}
            </button>
          </div>

          {error ? (
            <div
              style={{
                marginTop: 8,
                background: COLORS.orangeSoft,
                border: "1px solid rgba(255,106,0,.35)",
                borderRadius: 12,
                padding: 10,
                color: COLORS.text,
                fontWeight: 800,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: 14 }}>
          <SelectRow label="Faixa etária">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(["13-17", "18-25", "26-35", "36-45", "46-55", "56+"] as const).map((v) => (
                <Pill key={v} active={a.ageRange === v} onClick={() => setField("ageRange", v)}>
                  {v}
                </Pill>
              ))}
            </div>
          </SelectRow>

          <SelectRow label="Gênero">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.gender === "female"} onClick={() => setField("gender", "female")}>
                Feminino
              </Pill>
              <Pill active={a.gender === "male"} onClick={() => setField("gender", "male")}>
                Masculino
              </Pill>
              <Pill active={a.gender === "na"} onClick={() => setField("gender", "na")}>
                Prefiro não informar
              </Pill>
            </div>
          </SelectRow>

          <SelectRow label="Objetivo">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(
                [
                  ["emagrecimento", "Emagrecimento"],
                  ["hipertrofia", "Hipertrofia"],
                  ["condicionamento", "Condicionamento"],
                  ["resistencia", "Resistência"],
                  ["mobilidade", "Mobilidade"],
                  ["saude", "Saúde"],
                ] as const
              ).map(([key, label]) => (
                <Pill key={key} active={a.goal === key} onClick={() => setField("goal", key)}>
                  {label}
                </Pill>
              ))}
            </div>
          </SelectRow>

          <SelectRow label="Experiência">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(
                [
                  ["never", "Nunca treinei"],
                  ["stopped", "Voltei agora"],
                  ["1-2", "1–2x/sem"],
                  ["3-4", "3–4x/sem"],
                  ["5+", "5x+/sem"],
                ] as const
              ).map(([key, label]) => (
                <Pill key={key} active={a.experience === key} onClick={() => setField("experience", key)}>
                  {label}
                </Pill>
              ))}
            </div>
          </SelectRow>

          <SelectRow label="Onde você treina?">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.trainingPlace === "home"} onClick={() => setField("trainingPlace", "home")}>
                Em casa
              </Pill>
              <Pill active={a.trainingPlace === "gym"} onClick={() => setField("trainingPlace", "gym")}>
                Academia
              </Pill>
              <Pill active={a.trainingPlace === "both"} onClick={() => setField("trainingPlace", "both")}>
                Ambos
              </Pill>
            </div>
          </SelectRow>

          <SelectRow label="Tempo por dia">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(["10-15", "20-30", "30-45", "60+"] as const).map((v) => (
                <Pill key={v} active={a.timePerDay === v} onClick={() => setField("timePerDay", v)}>
                  {v.replace("-", "–")} min
                </Pill>
              ))}
            </div>
          </SelectRow>

          <SelectRow label="Dias por semana">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {([2, 3, 4, 5, 6] as const).map((v) => (
                <Pill key={v} active={a.daysPerWeek === v} onClick={() => setField("daysPerWeek", v)}>
                  {v}x
                </Pill>
              ))}
            </div>
          </SelectRow>

          <SelectRow label="Intensidade preferida">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.intensityPref === "progressive"} onClick={() => setField("intensityPref", "progressive")}>
                Progressiva
              </Pill>
              <Pill active={a.intensityPref === "intense"} onClick={() => setField("intensityPref", "intense")}>
                Intensa
              </Pill>
              <Pill active={a.intensityPref === "any"} onClick={() => setField("intensityPref", "any")}>
                Tanto faz
              </Pill>
            </div>
          </SelectRow>

          <SelectRow label="Lesões (selecione todas que se aplicam)">
            <ToggleList
              allowNoneKey="none"
              options={[
                { key: "none", label: "Nenhuma" },
                { key: "joelho", label: "Joelho" },
                { key: "ombro", label: "Ombro" },
                { key: "lombar", label: "Lombar" },
                { key: "tornozelo", label: "Tornozelo" },
                { key: "outra", label: "Outra" },
              ]}
              selected={a.injuries}
              onChange={(next) => setField("injuries", next as OnboardingAnswers["injuries"])}
            />
          </SelectRow>

          <SelectRow label="Condições (selecione todas que se aplicam)">
            <ToggleList
              allowNoneKey="none"
              options={[
                { key: "none", label: "Nenhuma" },
                { key: "pressao", label: "Pressão" },
                { key: "cardiaco", label: "Cardíaco" },
                { key: "diabetes", label: "Diabetes" },
                { key: "respiratorio", label: "Respiratório" },
              ]}
              selected={a.conditions}
              onChange={(next) => setField("conditions", next as OnboardingAnswers["conditions"])}
            />
          </SelectRow>

          <SelectRow label="Liberação médica">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.clearedByDoctor === "yes"} onClick={() => setField("clearedByDoctor", "yes")}>
                Sim
              </Pill>
              <Pill active={a.clearedByDoctor === "no"} onClick={() => setField("clearedByDoctor", "no")}>
                Não
              </Pill>
              <Pill active={a.clearedByDoctor === "unsure"} onClick={() => setField("clearedByDoctor", "unsure")}>
                Não sei
              </Pill>
            </div>
          </SelectRow>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,106,0,.35)",
                background: COLORS.orange,
                color: COLORS.bg,
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 1000,
                boxShadow: "0 10px 24px rgba(0,0,0,.35)",
              }}
            >
              {saving ? "Salvando..." : "✅ Concluir onboarding"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}