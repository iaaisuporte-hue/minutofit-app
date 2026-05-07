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
import { COLORS } from "../../styles/colors";

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  caption,
  children,
}: {
  eyebrow: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              background: COLORS.primarySoft,
              color: COLORS.highlight,
              padding: "7px 12px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.1,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
          <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{caption}</div>
        </div>
        <div style={{ display: "grid", gap: 16 }}>{children}</div>
      </div>
    </Card>
  );
}

const DEFAULT_ANSWERS: OnboardingAnswers = {
  trainingPlace: "home",
  timePerDay: "20-30",
  injuries: ["none"],
  surgeryRecent: "no",
  frequentPain: "no",
  daysPerWeek: 3,
  bestTime: "variable",
  intensityPref: "progressive",
  equipmentPref: "both",
  wantsCloseFollow: "no",
};

const TRACKABLE_FIELDS = [
  "trainingPlace",
  "timePerDay",
  "injuries",
  "surgeryRecent",
  "frequentPain",
  "daysPerWeek",
  "bestTime",
  "intensityPref",
  "equipmentPref",
  "wantsCloseFollow",
] as const;

type TrackableField = (typeof TRACKABLE_FIELDS)[number];

function buildTouchedSet(answers: OnboardingAnswers) {
  const touched = new Set<TrackableField>();
  if (answers.trainingPlace) touched.add("trainingPlace");
  if (answers.timePerDay) touched.add("timePerDay");
  if (answers.injuries.length > 0) touched.add("injuries");
  if (answers.surgeryRecent) touched.add("surgeryRecent");
  if (answers.frequentPain) touched.add("frequentPain");
  if (answers.daysPerWeek) touched.add("daysPerWeek");
  if (answers.bestTime) touched.add("bestTime");
  if (answers.intensityPref) touched.add("intensityPref");
  if (answers.equipmentPref) touched.add("equipmentPref");
  if (answers.wantsCloseFollow) touched.add("wantsCloseFollow");
  return touched;
}

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
        <div style={{ fontWeight: 700 }}>{label}</div>
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
        border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
        background: active ? COLORS.primarySoft : "#FAFAFA",
        color: COLORS.text,
        cursor: "pointer",
        fontWeight: 600,
        boxShadow: active ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
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
  const { id, user } = useAuth();

  const userId = (id ?? "").trim().toLowerCase();

  const savedAnswers = useMemo(() => (userId ? loadAnswers(userId) : null), [userId]);
  const initial = useMemo(() => savedAnswers ?? DEFAULT_ANSWERS, [savedAnswers]);

  const [a, setA] = useState<OnboardingAnswers>(initial);
  const [touched, setTouched] = useState<Set<TrackableField>>(() =>
    savedAnswers ? buildTouchedSet(savedAnswers) : new Set<TrackableField>()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends TrackableField>(key: K, value: OnboardingAnswers[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
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

  const completionScore = useMemo(() => {
    return Math.round((touched.size / TRACKABLE_FIELDS.length) * 100);
  }, [touched]);

  return (
    <div style={{ display: "grid", gap: 14, color: COLORS.text }}>
      <Card
        style={{
          background: COLORS.panelDeep,
          borderColor: COLORS.borderStrong,
          borderRadius: 24,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              background: COLORS.highlightSoft,
              color: COLORS.highlight,
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Personalização inicial
          </div>
          <div style={{ fontWeight: 700, fontSize: 26, lineHeight: 1.1 }}>Ajuste sua rotina ideal de treino</div>
          <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.55, maxWidth: 760 }}>
            Esta etapa deve ser rápida. Ela existe para adaptar seus treinos ao seu contexto real de rotina, disponibilidade e conforto, sem repetir dados que você já preencheu no perfil.
          </div>

          <div
            style={{
              marginTop: 6,
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              background: "#FAFAFA",
              padding: 14,
              color: COLORS.muted,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <b style={{ color: COLORS.text }}>Já usamos do seu perfil:</b> objetivo {user?.fitnessGoal || "não informado"} e
            experiência {user?.experienceLevel || "não informada"}. Aqui você ajusta apenas preferências e contexto do treino.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 14,
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: COLORS.mutedSoft }}>
                <span>Progresso desta etapa</span>
                <span>{completionScore}%</span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "#F9FAFB",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${completionScore}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: COLORS.primary,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                border: `1px solid ${COLORS.border}`,
                background: "#FAFAFA",
                color: COLORS.text,
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Aproximadamente 2 min
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => nav("/app/user/today")}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: "transparent",
                color: COLORS.text,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ← Voltar
            </button>

            <button
              onClick={onSave}
              disabled={saving}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: COLORS.primary,
                color: "#FFFFFF",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
                boxShadow: "0 10px 24px rgba(0,0,0,.35)",
              }}
            >
              {saving ? "Salvando..." : "Concluir onboarding"}
            </button>
          </div>

          {error ? (
            <div
              style={{
                marginTop: 8,
                background: COLORS.highlightSoft,
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: 12,
                padding: 10,
                color: COLORS.text,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      </Card>

      <Section
        eyebrow="Rotina"
        title="Contexto de treino"
        caption="Essas escolhas ajudam a montar algo que cabe de verdade no seu dia e no ambiente em que você consegue manter constância."
      >
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

          <SelectRow label="Melhor horário">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.bestTime === "morning"} onClick={() => setField("bestTime", "morning")}>
                Manhã
              </Pill>
              <Pill active={a.bestTime === "afternoon"} onClick={() => setField("bestTime", "afternoon")}>
                Tarde
              </Pill>
              <Pill active={a.bestTime === "night"} onClick={() => setField("bestTime", "night")}>
                Noite
              </Pill>
              <Pill active={a.bestTime === "variable"} onClick={() => setField("bestTime", "variable")}>
                Variável
              </Pill>
            </div>
          </SelectRow>
      </Section>

      <Section
        eyebrow="Preferências"
        title="Como você prefere treinar"
        caption="Aqui a ideia é entender seu estilo: intensidade, equipamentos e o tipo de acompanhamento que faz mais sentido para você."
      >
          <SelectRow label="Equipamentos preferidos">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.equipmentPref === "weights"} onClick={() => setField("equipmentPref", "weights")}>
                Com peso
              </Pill>
              <Pill active={a.equipmentPref === "no_weights"} onClick={() => setField("equipmentPref", "no_weights")}>
                Sem peso
              </Pill>
              <Pill active={a.equipmentPref === "both"} onClick={() => setField("equipmentPref", "both")}>
                Tanto faz
              </Pill>
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

          <SelectRow label="Quer acompanhamento mais próximo?">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.wantsCloseFollow === "yes"} onClick={() => setField("wantsCloseFollow", "yes")}>
                Sim
              </Pill>
              <Pill active={a.wantsCloseFollow === "no"} onClick={() => setField("wantsCloseFollow", "no")}>
                Não
              </Pill>
            </div>
          </SelectRow>
      </Section>

      <Section
        eyebrow="Segurança"
        title="Cuidados para ajustar melhor o plano"
        caption="Essas respostas não substituem orientação médica, mas ajudam o app a evitar sugestões agressivas quando há sinais de maior cautela."
      >
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

          <SelectRow label="Cirurgia recente">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.surgeryRecent === "yes"} onClick={() => setField("surgeryRecent", "yes")}>
                Sim
              </Pill>
              <Pill active={a.surgeryRecent === "no"} onClick={() => setField("surgeryRecent", "no")}>
                Não
              </Pill>
            </div>
          </SelectRow>

          <SelectRow label="Dor frequente ao treinar">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill active={a.frequentPain === "no"} onClick={() => setField("frequentPain", "no")}>
                Não
              </Pill>
              <Pill active={a.frequentPain === "sometimes"} onClick={() => setField("frequentPain", "sometimes")}>
                Às vezes
              </Pill>
              <Pill active={a.frequentPain === "often"} onClick={() => setField("frequentPain", "often")}>
                Com frequência
              </Pill>
            </div>
          </SelectRow>
      </Section>

      <Card style={{ borderColor: COLORS.borderStrong }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Tudo pronto para gerar sua base inicial</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
              Você poderá revisar essas escolhas depois. O importante agora é dar ao app contexto suficiente para sugerir treinos mais coerentes com sua rotina.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: COLORS.primary,
                color: "#FFFFFF",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
                boxShadow: "0 10px 24px rgba(0,0,0,.35)",
              }}
            >
              {saving ? "Salvando..." : "Concluir onboarding"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
