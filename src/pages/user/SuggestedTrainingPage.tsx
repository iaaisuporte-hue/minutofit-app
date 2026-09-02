import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { loadAnswers } from "./onboarding/onboardingStorage";
import { type MuscleGroup, getYesterdayMuscleGroups } from "./workoutHistory";

import { persistGamificationCheckin } from "../../services/gamificationApi";
import { createWorkoutSession } from "../../services/workoutSessionApi";
import { addWorkoutHistoryEntry } from "./workoutHistory";
import { COLORS } from "../../styles/colors";
import { buildMetabolicRecommendation } from "../../features/training/metabolicRecommendationEngine";
import { ExerciseDemoModal } from "./components/ExerciseDemoModal";
import {
  type DailySignals,
  type ReadinessLevel,
  type SelectableStrengthGroup,
  defaultSignals,
} from "../../features/training/metabolicRecommendationTypes";

const groupLabelMap: Partial<Record<MuscleGroup, string>> = {
  chest: "peito",
  back: "costas",
  legs: "pernas",
  shoulders: "ombros",
  arms: "braços",
  core: "core",
  cardio: "cardio",
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "lime" }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        color: tone === "lime" ? COLORS.lime : COLORS.mutedSoft,
      }}
    >
      {children}
    </div>
  );
}

function ChoicePill({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        // 44px: escolher onde vai treinar decide o treino inteiro do dia, e o
        // chip media 38px (SPEC §8).
        minHeight: 44,
        padding: "9px 12px",
        borderRadius: 12,
        border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
        background: active ? COLORS.primarySoft : "#FAFAFA",
        color: disabled ? COLORS.mutedSoft : COLORS.text,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        fontSize: 13,
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      {children}
    </button>
  );
}

function getLevelVisual(level: ReadinessLevel) {
  if (level === "green") {
    return { label: "Prontidão alta", background: "rgba(123,153,25,.12)", border: COLORS.borderStrong, color: COLORS.lime };
  }
  if (level === "yellow") {
    return { label: "Prontidão ajustada", background: COLORS.yellowSoft, border: COLORS.yellowBorder, color: "#B45309" };
  }
  return { label: "Alerta metabólico", background: COLORS.redSoft, border: COLORS.redBorder, color: "#B91C1C" };
}

const CONTEXT_OPTIONS: Array<{ value: DailySignals["preferredContext"]; label: string }> = [
  { value: "home", label: "Em casa" },
  { value: "gym", label: "Academia" },
  { value: "outdoor", label: "Outdoor" },
];

export default function SuggestedTrainingPage() {
  const isMobile = useIsMobile(720);
  const { user, id } = useAuth();
  const userId = (id ?? "").trim().toLowerCase();
  const onboarding = useMemo(() => (userId ? loadAnswers(userId) : null), [userId]);
  const yesterdayGroups = useMemo(() => getYesterdayMuscleGroups(), []);

  const [selectedGroups, setSelectedGroups] = useState<SelectableStrengthGroup[]>([]);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [groupMessage, setGroupMessage] = useState<string | null>(null);
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null);
  const [demoName, setDemoName] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [signals, setSignals] = useState<DailySignals>(() => ({
    ...defaultSignals,
    timeAvailable: onboarding?.timePerDay || defaultSignals.timeAvailable,
    preferredContext:
      onboarding?.trainingPlace === "gym" ? "gym" : onboarding?.trainingPlace === "both" ? "outdoor" : "home",
  }));

  const recommendation = useMemo(
    () =>
      buildMetabolicRecommendation(signals, yesterdayGroups, selectedGroups, {
        fitnessGoal: user?.fitnessGoal,
        experienceLevel: user?.experienceLevel,
        onboardingTrainingPlace: onboarding?.trainingPlace,
        onboardingDaysPerWeek: onboarding?.daysPerWeek,
      }),
    [onboarding?.daysPerWeek, onboarding?.trainingPlace, selectedGroups, signals, user?.experienceLevel, user?.fitnessGoal, yesterdayGroups]
  );

  const readinessVisual = getLevelVisual(recommendation.level);
  const maxSelectableGroups = signals.timeAvailable === "60+" ? 3 : signals.timeAvailable === "30-45" ? 2 : 1;
  const plan = recommendation.workoutPlan;
  const totalExercises = plan ? plan.blocks.reduce((sum, block) => sum + block.exercises.length, 0) : 0;
  const allExercisesCompleted = totalExercises > 0 && completedExercises.length === totalExercises;

  function setContext(value: DailySignals["preferredContext"]) {
    setSignals((current) => ({ ...current, preferredContext: value }));
    setCompletedExercises([]);
  }

  function toggleSymptom(symptom: Exclude<DailySignals["symptoms"][number], "none">) {
    setSignals((current) => {
      const currentSymptoms = current.symptoms.filter((item) => item !== "none");
      const exists = currentSymptoms.includes(symptom);
      const nextSymptoms = exists ? currentSymptoms.filter((item) => item !== symptom) : [...currentSymptoms, symptom];
      return { ...current, symptoms: nextSymptoms.length ? nextSymptoms : ["none"] };
    });
  }

  function toggleGroup(group: SelectableStrengthGroup) {
    if (yesterdayGroups.includes(group)) return;
    setSelectedGroups((current) => {
      if (current.includes(group)) {
        setGroupMessage(null);
        return current.filter((item) => item !== group);
      }
      if (current.length >= maxSelectableGroups) {
        setGroupMessage(
          maxSelectableGroups === 1
            ? "Com esse tempo disponível, escolha apenas 1 grupo muscular."
            : `Com ${signals.timeAvailable} minutos, a IA aceita até ${maxSelectableGroups} grupos musculares.`
        );
        return current;
      }
      setGroupMessage(null);
      return [...current, group];
    });
  }

  function toggleExerciseComplete(exerciseKey: string) {
    setCompletedExercises((current) => {
      if (current.includes(exerciseKey)) return current.filter((item) => item !== exerciseKey);
      // O XP por exercício era invenção do cliente (5 por check, direto no
      // localStorage) — exatamente o que a Onda C0 (Spec 034) eliminou. O
      // check continua marcando progresso visual; a moeda é do servidor.
      return [...current, exerciseKey];
    });
  }

  async function handleCompleteTraining() {
    if (!plan) return;
    const workoutId = `ai-plan-${Date.now()}`;
    const workoutTitle = `IA do dia • ${plan.focus}`;
    const workoutGroups: MuscleGroup[] = selectedGroups.length
      ? [...selectedGroups]
      : plan.focus.toLowerCase().includes("cardio")
        ? ["cardio"]
        : ["core"];

    addWorkoutHistoryEntry({ workoutId, title: workoutTitle, muscleGroups: workoutGroups, date: new Date().toISOString() });
    setTrainingMessage("Sessão registrada. Sua leitura de amanhã já considera o esforço de hoje.");
    void createWorkoutSession({ source: "suggested", status: "completed", title: workoutTitle });

    try {
      await persistGamificationCheckin({
        source: "workout",
        workout: { workoutId, title: workoutTitle, muscleGroups: workoutGroups },
      });
    } catch (error) {
      console.error("Failed to persist AI workout completion:", error);
    }
  }

  const fieldLabel = { color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1.1 };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", width: "100%", display: "grid", gap: 16 }}>
      {/* Header compacto */}
      <div style={{ display: "grid", gap: 6 }}>
        <Eyebrow tone="lime">Treino que entende seu dia</Eyebrow>
        <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: COLORS.text, lineHeight: 1.2 }}>
          Seu treino de hoje
        </div>
        <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.6, maxWidth: 680 }}>
          O S2Core lê seus sinais do dia e decide se hoje vale acelerar, manter, recuperar ou pausar — depois monta a sessão.
        </div>
      </div>

      {/* Prontidão + contexto */}
      <Card style={{ borderColor: readinessVisual.border, display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <span
            style={{
              justifySelf: "start",
              display: "inline-flex",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              background: readinessVisual.background,
              color: readinessVisual.color,
              border: `1px solid ${readinessVisual.border}`,
            }}
          >
            {readinessVisual.label}
          </span>
          <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: COLORS.text, lineHeight: 1.25 }}>
            {recommendation.title}
          </div>
          <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 720 }}>{recommendation.summary}</div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <span style={fieldLabel}>Onde você vai treinar</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {CONTEXT_OPTIONS.map((opt) => (
              <ChoicePill key={opt.value} active={signals.preferredContext === opt.value} onClick={() => setContext(opt.value)}>
                {opt.label}
              </ChoicePill>
            ))}
          </div>
        </div>
      </Card>

      {trainingMessage ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${COLORS.borderStrong}`,
            background: "rgba(123,153,25,.10)",
            color: COLORS.text,
            fontWeight: 600,
          }}
        >
          {trainingMessage}
        </div>
      ) : null}

      {/* Plano do dia OU dia de recuperação */}
      {plan ? (
        <Card style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <Eyebrow tone="lime">Plano de hoje</Eyebrow>
            <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: COLORS.text, lineHeight: 1.2 }}>{plan.focus}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {[
              { label: "Duração", value: plan.duration },
              { label: "Intensidade", value: plan.intensity },
              { label: "Blocos", value: String(plan.blocks.length) },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{ padding: 14, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "var(--color-surface-raised)", display: "grid", gap: 6 }}
              >
                <span style={fieldLabel}>{stat.label}</span>
                <span style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Blocos */}
          <div style={{ display: "grid", gap: 12 }}>
            {plan.blocks.map((block, blockIndex) => (
              <div key={block.title} style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      minWidth: 26,
                      height: 26,
                      borderRadius: 999,
                      background: COLORS.primarySoft,
                      color: COLORS.lime,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {blockIndex + 1}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{block.title}</span>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {block.exercises.map((exercise, exerciseIndex) => {
                    const exerciseKey = `${blockIndex}-${exerciseIndex}-${exercise}`;
                    const checked = completedExercises.includes(exerciseKey);
                    return (
                      <div
                        key={exerciseKey}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: `1px solid ${checked ? COLORS.borderStrong : COLORS.border}`,
                          background: checked ? "rgba(123,153,25,.10)" : "#FAFAFA",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExerciseComplete(exerciseKey)}
                          aria-label={checked ? "Desmarcar" : "Marcar como feito"}
                          // O círculo continua com 26px (é um marcador ao lado do
                          // nome do exercício), mas a área de toque vai a 44 pela
                          // classe — 26×26 é o menor alvo do app (SPEC §8).
                          className="hit-target-44"
                          style={{
                            minWidth: 26,
                            height: 26,
                            marginTop: 1,
                            borderRadius: 999,
                            border: `1px solid ${checked ? COLORS.borderStrong : COLORS.border}`,
                            background: checked ? COLORS.lime : "#FFFFFF",
                            color: checked ? "#0A130D" : COLORS.muted,
                            display: "grid",
                            placeItems: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          {checked ? "✓" : "+"}
                        </button>
                        <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 0 }}>
                          <span style={{ color: COLORS.text, lineHeight: 1.5, fontSize: 14 }}>{exercise}</span>
                          <button
                            type="button"
                            onClick={() => setDemoName(exercise)}
                            style={{
                              justifySelf: "start",
                              padding: "6px 10px",
                              borderRadius: 10,
                              border: `1px solid ${COLORS.border}`,
                              background: "var(--color-surface)",
                              color: COLORS.text,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Ver demonstração
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {plan.closingNote ? (
            <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.panelSoft, color: COLORS.muted, fontSize: 13, lineHeight: 1.6 }}>
              {plan.closingNote}
            </div>
          ) : null}

          {/* Progresso + registrar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto",
              gap: 12,
              alignItems: "center",
              padding: 16,
              borderRadius: 16,
              border: `1px solid ${COLORS.borderStrong}`,
              background: "rgba(123,153,25,.08)",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>
                {completedExercises.length}/{totalExercises} exercícios marcados
              </span>
              <span style={{ color: COLORS.muted, fontSize: 13 }}>Marque conforme você executa — isso atualiza sua leitura de amanhã.</span>
            </div>
            <button
              type="button"
              onClick={handleCompleteTraining}
              disabled={!allExercisesCompleted}
              style={{
                padding: "13px 18px",
                borderRadius: 14,
                border: `1px solid ${allExercisesCompleted ? COLORS.borderStrong : COLORS.border}`,
                background: allExercisesCompleted ? COLORS.lime : "#F1F5F9",
                color: allExercisesCompleted ? "#0A130D" : COLORS.mutedSoft,
                fontWeight: 700,
                cursor: allExercisesCompleted ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              Registrar treino
            </button>
          </div>
        </Card>
      ) : (
        <Card style={{ display: "grid", gap: 8 }}>
          <Eyebrow tone="lime">Hoje é dia de recuperar</Eyebrow>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Sem treino prescrito para hoje</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
            Seus sinais pedem recuperação. Forçar agora atrapalha o resultado — priorize sono, hidratação e movimento leve.
          </div>
        </Card>
      )}

      {/* Por que + Ação (lado a lado no desktop) */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        {recommendation.rationale.length ? (
          <Card style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Por que a IA chegou nisso</div>
            <div style={{ display: "grid", gap: 8 }}>
              {recommendation.rationale.map((item) => (
                <div key={item} style={{ padding: 12, borderRadius: 12, background: COLORS.panelSoft, border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                  {item}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {recommendation.actions.length ? (
          <Card style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Ação recomendada</div>
            <div style={{ display: "grid", gap: 10 }}>
              {recommendation.actions.map((item) => (
                <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: COLORS.primarySoft, color: COLORS.lime, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {/* Alertas */}
      {recommendation.warnings.length ? (
        <Card style={{ borderColor: COLORS.redBorder, background: COLORS.redSoft, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#B91C1C" }}>Alertas do dia</div>
          <div style={{ display: "grid", gap: 8 }}>
            {recommendation.warnings.map((warning) => (
              <div key={warning} style={{ padding: 12, borderRadius: 12, border: `1px solid ${COLORS.redBorder}`, background: "var(--color-surface)", color: "#7F1D1D", fontSize: 13, lineHeight: 1.5 }}>
                {warning}
              </div>
            ))}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.5 }}>
            Este módulo interpreta sinais do dia, mas não substitui avaliação médica.
          </div>
        </Card>
      ) : null}

      {/* Ajustar meu dia — refinamento, progressivo */}
      <Card style={{ display: "grid", gap: showAdjust ? 18 : 0 }}>
        <button
          type="button"
          onClick={() => setShowAdjust((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Ajustar meu dia</span>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Refine os sinais e a IA recalcula o treino na hora.</span>
          </div>
          <span style={{ color: COLORS.muted, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{showAdjust ? "Fechar ▲" : "Abrir ▼"}</span>
        </button>

        {showAdjust ? (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <span style={fieldLabel}>Como você acordou?</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["great", "Muito bem"], ["ok", "Normal"], ["tired", "Cansado"]].map(([value, label]) => (
                  <ChoicePill key={value} active={signals.wokeUpFeeling === value} onClick={() => setSignals((c) => ({ ...c, wokeUpFeeling: value as DailySignals["wokeUpFeeling"] }))}>
                    {label}
                  </ChoicePill>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <span style={fieldLabel}>Sono</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["good", "Bom"], ["regular", "Regular"], ["poor", "Ruim"]].map(([value, label]) => (
                    <ChoicePill key={value} active={signals.sleepQuality === value} onClick={() => setSignals((c) => ({ ...c, sleepQuality: value as DailySignals["sleepQuality"] }))}>
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <span style={fieldLabel}>Estresse</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["low", "Baixo"], ["medium", "Médio"], ["high", "Alto"]].map(([value, label]) => (
                    <ChoicePill key={value} active={signals.stressLevel === value} onClick={() => setSignals((c) => ({ ...c, stressLevel: value as DailySignals["stressLevel"] }))}>
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <span style={fieldLabel}>Dor muscular</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["low", "Baixa"], ["medium", "Média"], ["high", "Alta"]].map(([value, label]) => (
                    <ChoicePill key={value} active={signals.sorenessLevel === value} onClick={() => setSignals((c) => ({ ...c, sorenessLevel: value as DailySignals["sorenessLevel"] }))}>
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <span style={fieldLabel}>Tempo disponível</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["10-15", "10–15"], ["20-30", "20–30"], ["30-45", "30–45"], ["60+", "60+"]].map(([value, label]) => (
                    <ChoicePill key={value} active={signals.timeAvailable === value} onClick={() => setSignals((c) => ({ ...c, timeAvailable: value as DailySignals["timeAvailable"] }))}>
                      {label} min
                    </ChoicePill>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <span style={fieldLabel}>Glicose</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["normal", "Normal"], ["elevated", "Alta"], ["critical", "Muito alta"]].map(([value, label]) => (
                    <ChoicePill key={value} active={signals.glucoseStatus === value} onClick={() => setSignals((c) => ({ ...c, glucoseStatus: value as DailySignals["glucoseStatus"] }))}>
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <span style={fieldLabel}>Pressão</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["normal", "Normal"], ["elevated", "Elevada"], ["critical", "Crítica"]].map(([value, label]) => (
                    <ChoicePill key={value} active={signals.bloodPressureStatus === value} onClick={() => setSignals((c) => ({ ...c, bloodPressureStatus: value as DailySignals["bloodPressureStatus"] }))}>
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <span style={fieldLabel}>Sintomas</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["headache", "Dor de cabeça"], ["dizziness", "Tontura"], ["nausea", "Enjoo"], ["palpitations", "Palpitação"]].map(([value, label]) => (
                    <ChoicePill key={value} active={signals.symptoms.includes(value as Exclude<DailySignals["symptoms"][number], "none">)} onClick={() => toggleSymptom(value as Exclude<DailySignals["symptoms"][number], "none">)}>
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <span style={fieldLabel}>Grupos para priorizar hoje</span>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {(["chest", "back", "legs", "shoulders", "arms", "core"] as SelectableStrengthGroup[]).map((group) => {
                  const disabled = yesterdayGroups.includes(group);
                  const active = selectedGroups.includes(group);
                  return (
                    <ChoicePill key={group} active={active} disabled={disabled} onClick={() => toggleGroup(group)}>
                      <span style={{ textTransform: "capitalize" }}>{groupLabelMap[group]}</span>
                    </ChoicePill>
                  );
                })}
              </div>
              <span style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.6 }}>
                Sem escolha, a IA decide o foco. Grupos treinados ontem ficam indisponíveis para respeitar a recuperação.
              </span>
              {groupMessage ? <span style={{ color: "#B45309", fontSize: 12, lineHeight: 1.6 }}>{groupMessage}</span> : null}
            </div>
          </div>
        ) : null}
      </Card>

      {demoName ? <ExerciseDemoModal key={demoName} name={demoName} onClose={() => setDemoName(null)} /> : null}
    </div>
  );
}
