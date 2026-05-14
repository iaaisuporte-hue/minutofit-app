import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { loadAnswers } from "./onboarding/onboardingStorage";
import { getYesterdayMuscleGroups } from "./workoutHistory";
import { addXp, registerDailyCheckin } from "./gamification";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import { addWorkoutHistoryEntry } from "./workoutHistory";
import { COLORS } from "../../styles/colors";
import { useDailyCondition } from "../../features/dailyCheckin/useDailyCondition";
import { buildDailyWorkoutRecommendation, getWorkoutRoute } from "../../features/training/dailyWorkoutAdapter";
import { resolveSupportVideoForActivity } from "./trainingSupportVideos";
import { buildMetabolicRecommendation } from "../../features/training/metabolicRecommendationEngine";
import {
  type DailySignals,
  type ReadinessLevel,
  type SelectableStrengthGroup,
  defaultSignals,
} from "../../features/training/metabolicRecommendationTypes";

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

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {eyebrow ? (
        <div
          style={{
            display: "inline-flex",
            width: "fit-content",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            background: COLORS.highlightSoft,
            color: COLORS.lime,
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text }}>{title}</div>
      {subtitle ? <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 780 }}>{subtitle}</div> : null}
    </div>
  );
}

function ChoicePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
        background: active ? COLORS.primarySoft : "#FAFAFA",
        color: COLORS.text,
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function getLevelVisual(level: ReadinessLevel) {
  if (level === "green") {
    return {
      label: "Prontidão alta",
      background: "rgba(34,197,94,.14)",
      border: COLORS.borderStrong,
      color: COLORS.lime,
    };
  }
  if (level === "yellow") {
    return {
      label: "Prontidão ajustada",
      background: COLORS.yellowSoft,
      border: COLORS.yellowBorder,
      color: "#FFD36C",
    };
  }
  return {
    label: "Alerta metabólico",
    background: COLORS.redSoft,
    border: COLORS.redBorder,
    color: "#FF9C9C",
  };
}


export default function SuggestedTrainingPage() {
  const navigate = useNavigate();
  const { user, id } = useAuth();
  const { condition } = useDailyCondition();
  const userId = (id ?? "").trim().toLowerCase();
  const onboarding = useMemo(() => (userId ? loadAnswers(userId) : null), [userId]);
  const yesterdayGroups = useMemo(() => getYesterdayMuscleGroups(), []);
  const [selectedGroups, setSelectedGroups] = useState<SelectableStrengthGroup[]>([]);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [exerciseXpEarned, setExerciseXpEarned] = useState(0);
  const [groupMessage, setGroupMessage] = useState<string | null>(null);
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null);
  const [showWorkoutWidget, setShowWorkoutWidget] = useState(false);
  const [signals, setSignals] = useState<DailySignals>(() => ({
    ...defaultSignals,
    timeAvailable: onboarding?.timePerDay || defaultSignals.timeAvailable,
    preferredContext:
      onboarding?.trainingPlace === "gym"
        ? "gym"
        : onboarding?.trainingPlace === "both"
          ? "outdoor"
          : "home",
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
  const adaptiveWorkout = useMemo(
    () =>
      buildDailyWorkoutRecommendation({
        condition,
        user,
        onboarding,
      }),
    [condition, onboarding, user]
  );
  const primaryAdaptiveWorkout =
    adaptiveWorkout.recommendations.find((item) => item.type === adaptiveWorkout.primaryRecommendationType) ??
    adaptiveWorkout.recommendations[0];
  const alternativeAdaptiveWorkout =
    adaptiveWorkout.recommendations.find((item) => item.type !== adaptiveWorkout.primaryRecommendationType) ??
    adaptiveWorkout.recommendations[1];

  const readinessVisual = getLevelVisual(recommendation.level);
  const maxSelectableGroups =
    signals.timeAvailable === "60+" ? 3 : signals.timeAvailable === "30-45" ? 2 : 1;
  const totalExercises = recommendation.workoutPlan
    ? recommendation.workoutPlan.blocks.reduce((sum, block) => sum + block.exercises.length, 0)
    : 0;
  const allExercisesCompleted = totalExercises > 0 && completedExercises.length === totalExercises;

  function openSupportVideo(activity: string, workoutFocus?: string) {
    const support = resolveSupportVideoForActivity(activity, workoutFocus);
    if (!support) return;

    navigate(
      `/app/user/treinos/player/support-video?videoId=${encodeURIComponent(support.video.videoId)}&title=${encodeURIComponent(
        `${activity} · apoio`
      )}&durationMin=${support.video.durationMin}&returnTo=${encodeURIComponent("/app/user/suggested-training")}`
    );
  }

  function toggleSymptom(symptom: Exclude<DailySignals["symptoms"][number], "none">) {
    setSignals((current) => {
      const currentSymptoms = current.symptoms.filter((item) => item !== "none");
      const exists = currentSymptoms.includes(symptom);
      const nextSymptoms = exists
        ? currentSymptoms.filter((item) => item !== symptom)
        : [...currentSymptoms, symptom];

      return {
        ...current,
        symptoms: nextSymptoms.length ? nextSymptoms : ["none"],
      };
    });
  }

  function toggleGroup(group: SelectableStrengthGroup) {
    if (yesterdayGroups.includes(group)) {
      return;
    }

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
      if (current.includes(exerciseKey)) {
        return current.filter((item) => item !== exerciseKey);
      }

      addXp(5);
      setExerciseXpEarned((value) => value + 5);
      return [...current, exerciseKey];
    });
  }

  async function handleCompleteTraining() {
    if (!recommendation.workoutPlan) {
      return;
    }

    const workoutId = `ai-plan-${Date.now()}`;
    const workoutTitle = `IA do dia • ${recommendation.workoutPlan.focus}`;
    const workoutGroups: MuscleGroup[] = selectedGroups.length
      ? [...selectedGroups]
      : recommendation.workoutPlan.focus.toLowerCase().includes("cardio")
        ? ["cardio"]
        : ["core"];

    addWorkoutHistoryEntry({
      workoutId,
      title: workoutTitle,
      muscleGroups: workoutGroups,
      date: new Date().toISOString(),
    });

    const checkin = registerDailyCheckin("workout", 0);
    setTrainingMessage(
      checkin.alreadyCheckedIn
        ? `Treino concluído. ${exerciseXpEarned} XP vieram dos exercícios marcados; o check-in de hoje já estava garantido.`
        : `Treino concluído. ${exerciseXpEarned} XP vieram dos exercícios marcados e a sequência do dia foi atualizada.`
    );

    try {
      await persistGamificationCheckin({
        source: "workout",
        xp: exerciseXpEarned,
        workout: {
          workoutId,
          title: workoutTitle,
          muscleGroups: workoutGroups,
        },
      });
    } catch (error) {
      console.error("Failed to persist AI workout completion:", error);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {trainingMessage ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${COLORS.borderStrong}`,
            background: "rgba(34,197,94,.12)",
            color: COLORS.text,
            fontWeight: 600,
          }}
        >
          {trainingMessage}
        </div>
      ) : null}
      <Card style={{ background: COLORS.panelDeep, borderColor: COLORS.borderStrong }}>
        <SectionTitle
          eyebrow="Metabolismo como Serviço"
          title="Seu treino de hoje começa com leitura do estado do corpo."
          subtitle="O plano Black transforma sinais do dia em decisão. Aqui a IA não só escolhe um treino: ela decide se hoje vale acelerar, reduzir, recuperar ou pausar com segurança."
        />
      </Card>

      <Card
        style={{
          borderColor: COLORS.borderStrong,
          background: "linear-gradient(135deg, rgba(34,197,94,.10), rgba(6,182,212,.08), rgba(255,255,255,.98))",
          boxShadow: "0 18px 40px rgba(6,182,212,.08)",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                background: "rgba(34,197,94,.12)",
                color: COLORS.lime,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.1,
              }}
            >
              Recomendação adaptativa de hoje
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, lineHeight: 1.15 }}>
              {primaryAdaptiveWorkout.title}
            </div>
            <div style={{ color: COLORS.muted, lineHeight: 1.7, maxWidth: 760 }}>
              {adaptiveWorkout.message}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, .8fr)", gap: 14 }}>
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "#FFFFFF",
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "inline-flex",
                    borderRadius: 999,
                    padding: "6px 10px",
                    background: "rgba(34,197,94,.12)",
                    color: COLORS.lime,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Recomendado · {primaryAdaptiveWorkout.type === "home" ? "Treino em casa" : "Treino na academia"}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.lime }}>
                  {primaryAdaptiveWorkout.scoreImpact} score
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "#F9FAFB" }}>
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.1 }}>Duração</div>
                  <div style={{ marginTop: 6, color: COLORS.text, fontSize: 18, fontWeight: 700 }}>{primaryAdaptiveWorkout.duration} min</div>
                </div>
                <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "#F9FAFB" }}>
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.1 }}>Objetivo</div>
                  <div style={{ marginTop: 6, color: COLORS.text, fontSize: 18, fontWeight: 700 }}>{primaryAdaptiveWorkout.goal}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "#F9FAFB" }}>
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.1 }}>Intensidade</div>
                  <div style={{ marginTop: 6, color: COLORS.text, fontSize: 18, fontWeight: 700 }}>{adaptiveWorkout.intensity}</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {primaryAdaptiveWorkout.exercises.map((exercise) => (
                  <div
                    key={exercise}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: `1px solid ${COLORS.border}`,
                      background: "#FAFAFA",
                      color: COLORS.muted,
                    }}
                    >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        marginTop: 7,
                        borderRadius: 999,
                        background: "#22C55E",
                        flex: "0 0 auto",
                      }}
                    />
                    <div style={{ display: "grid", gap: 8, width: "100%" }}>
                      <div>{exercise}</div>
                      <button
                        type="button"
                        onClick={() => openSupportVideo(exercise, primaryAdaptiveWorkout.title)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: `1px solid ${COLORS.borderStrong}`,
                          background: "rgba(34,197,94,.08)",
                          color: COLORS.text,
                          fontWeight: 700,
                          width: "fit-content",
                          cursor: "pointer",
                        }}
                      >
                        Ver vídeo de apoio no app
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => navigate(getWorkoutRoute(primaryAdaptiveWorkout.type))}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.borderStrong}`,
                    background: "#22C55E",
                    color: "#0A130D",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {primaryAdaptiveWorkout.type === "home" ? `Iniciar treino em casa de ${primaryAdaptiveWorkout.duration} min` : "Ir para sessão na academia"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(getWorkoutRoute(alternativeAdaptiveWorkout.type))}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: "#FAFAFA",
                    color: COLORS.text,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {alternativeAdaptiveWorkout.type === "home" ? "Usar alternativa em casa" : "Usar alternativa na academia"}
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 18,
                border: `1px solid ${COLORS.border}`,
                background: "#FFFFFF",
                display: "grid",
                gap: 14,
                alignContent: "start",
              }}
            >
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Opção alternativa
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{alternativeAdaptiveWorkout.title}</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                  {alternativeAdaptiveWorkout.duration} min · {alternativeAdaptiveWorkout.goal} · {alternativeAdaptiveWorkout.scoreImpact}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {alternativeAdaptiveWorkout.exercises.slice(0, 5).map((exercise) => (
                  <div
                    key={exercise}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${COLORS.border}`,
                      background: "#FAFAFA",
                      color: COLORS.muted,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {exercise}
                  </div>
                ))}
              </div>

              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.6 }}>
                Esta camada rápida existe para reduzir fricção: você escolhe entre casa e academia sem precisar passar pelo fluxo completo primeiro.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, .95fr)", gap: 16 }}>
        <Card>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>Estado de hoje</div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                Como você acordou?
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  ["great", "Acordei muito bem"],
                  ["ok", "Acordei normal"],
                  ["tired", "Acordei cansado"],
                ].map(([value, label]) => (
                  <ChoicePill
                    key={value}
                    active={signals.wokeUpFeeling === value}
                    onClick={() => setSignals((current) => ({ ...current, wokeUpFeeling: value as DailySignals["wokeUpFeeling"] }))}
                  >
                    {label}
                  </ChoicePill>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Sono
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    ["good", "Bom"],
                    ["regular", "Regular"],
                    ["poor", "Ruim"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.sleepQuality === value}
                      onClick={() => setSignals((current) => ({ ...current, sleepQuality: value as DailySignals["sleepQuality"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Estresse
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    ["low", "Baixo"],
                    ["medium", "Médio"],
                    ["high", "Alto"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.stressLevel === value}
                      onClick={() => setSignals((current) => ({ ...current, stressLevel: value as DailySignals["stressLevel"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Dor muscular
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    ["low", "Baixa"],
                    ["medium", "Média"],
                    ["high", "Alta"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.sorenessLevel === value}
                      onClick={() => setSignals((current) => ({ ...current, sorenessLevel: value as DailySignals["sorenessLevel"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Tempo disponível
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    ["10-15", "10–15"],
                    ["20-30", "20–30"],
                    ["30-45", "30–45"],
                    ["60+", "60+"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.timeAvailable === value}
                      onClick={() => setSignals((current) => ({ ...current, timeAvailable: value as DailySignals["timeAvailable"] }))}
                    >
                      {label} min
                    </ChoicePill>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Glicose
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["normal", "Normal"],
                    ["elevated", "Alta"],
                    ["critical", "Muito alta"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.glucoseStatus === value}
                      onClick={() => setSignals((current) => ({ ...current, glucoseStatus: value as DailySignals["glucoseStatus"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Pressão
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["normal", "Normal"],
                    ["elevated", "Elevada"],
                    ["critical", "Crítica"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.bloodPressureStatus === value}
                      onClick={() =>
                        setSignals((current) => ({ ...current, bloodPressureStatus: value as DailySignals["bloodPressureStatus"] }))
                      }
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Contexto
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["home", "Em casa"],
                    ["gym", "Academia"],
                    ["outdoor", "Outdoor"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.preferredContext === value}
                      onClick={() => setSignals((current) => ({ ...current, preferredContext: value as DailySignals["preferredContext"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                Grupos musculares que você quer priorizar hoje
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {(["chest", "back", "legs", "shoulders", "arms", "core"] as SelectableStrengthGroup[]).map((group) => {
                  const disabled = yesterdayGroups.includes(group);
                  const active = selectedGroups.includes(group);

                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => toggleGroup(group)}
                      disabled={disabled}
                      style={{
                        padding: "12px 10px",
                        borderRadius: 14,
                        border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${disabled ? "#F9FAFB" : COLORS.border}`,
                        background: active
                          ? COLORS.primarySoft
                          : disabled
                            ? "#FAFAFA"
                            : "#FAFAFA",
                        color: disabled ? COLORS.mutedSoft : COLORS.text,
                        cursor: disabled ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        textTransform: "capitalize",
                        opacity: disabled ? 0.65 : 1,
                      }}
                    >
                      {groupLabelMap[group]}
                    </button>
                  );
                })}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.6 }}>
                Se você não escolher nada, a IA decide o foco automaticamente. Grupos treinados ontem ficam indisponíveis hoje para respeitar recuperação.
              </div>
              {groupMessage ? (
                <div style={{ color: "#FFD36C", fontSize: 12, lineHeight: 1.6 }}>{groupMessage}</div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                Sintomas de hoje
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["headache", "Dor de cabeça"],
                  ["dizziness", "Tontura"],
                  ["nausea", "Enjoo"],
                  ["palpitations", "Palpitação"],
                ].map(([value, label]) => (
                  <ChoicePill
                    key={value}
                    active={signals.symptoms.includes(value as any)}
                    onClick={() => toggleSymptom(value as Exclude<DailySignals["symptoms"][number], "none">)}
                  >
                    {label}
                  </ChoicePill>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card style={{ background: COLORS.panelDeep, borderColor: readinessVisual.border }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: readinessVisual.background,
                  color: readinessVisual.color,
                  border: `1px solid ${readinessVisual.border}`,
                }}
              >
                {readinessVisual.label}
              </div>

              <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.text }}>{recommendation.title}</div>
              <div style={{ color: COLORS.muted, lineHeight: 1.7 }}>{recommendation.summary}</div>
            </div>
          </Card>

          {recommendation.workoutPlan ? (
            <Card
              style={{
                borderColor: COLORS.borderStrong,
                background: "linear-gradient(180deg, rgba(18,28,21,.98), rgba(12,16,14,.98))",
                boxShadow: "0 24px 60px rgba(0,0,0,.52)",
              }}
            >
              <div style={{ display: "grid", gap: 16 }}>
                <div
                  style={{
                    display: "grid",
                    gap: 16,
                    padding: 18,
                    borderRadius: 22,
                    border: `1px solid ${COLORS.borderStrong}`,
                    background: "linear-gradient(135deg, rgba(15,61,46,.92), rgba(14,22,18,.98))",
                  }}
                >
                  <div style={{ display: "grid", gap: 8 }}>
                    <div
                      style={{
                        display: "inline-flex",
                        width: "fit-content",
                        borderRadius: 999,
                        background: "rgba(34,197,94,.14)",
                        color: COLORS.lime,
                        padding: "8px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 1.1,
                      }}
                    >
                      Plano de hoje
                    </div>
                    <div style={{ fontSize: 14, color: COLORS.mutedSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                      Treino prescrito pela IA
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1.15 }}>
                      {recommendation.workoutPlan.focus}
                    </div>
                    <div style={{ color: COLORS.muted, lineHeight: 1.7, maxWidth: 760 }}>
                      Em vez de apontar para catálogo, a IA já entrega uma sessão pronta para hoje, coerente com seus sinais, contexto e tempo disponível.
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${COLORS.border}`,
                        background: "#F9FAFB",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                        Duracao
                      </div>
                      <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.duration}</div>
                    </div>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${COLORS.border}`,
                        background: "#F9FAFB",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                        Intensidade
                      </div>
                      <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.intensity}</div>
                    </div>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${COLORS.border}`,
                        background: "#F9FAFB",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                        Blocos
                      </div>
                      <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.blocks.length}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setShowWorkoutWidget(true)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        border: `1px solid ${COLORS.borderStrong}`,
                        background: "#22C55E",
                        color: "#0A130D",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Abrir treino de hoje
                    </button>
                    <div
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        border: `1px solid ${COLORS.border}`,
                        background: "#FAFAFA",
                        color: COLORS.muted,
                        fontWeight: 600,
                      }}
                    >
                      {completedExercises.length}/{totalExercises} exercícios marcados
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Por que a IA chegou nisso</div>
              <div style={{ display: "grid", gap: 10 }}>
                {recommendation.rationale.map((item) => (
                  <div
                    key={item}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: COLORS.panelSoft,
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.muted,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Ação recomendada</div>
              <div style={{ display: "grid", gap: 10 }}>
                {recommendation.actions.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: COLORS.muted }}>
                    <div
                      style={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: 999,
                        background: COLORS.primarySoft,
                        color: COLORS.lime,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 600,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </div>
                    <div style={{ lineHeight: 1.6 }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {recommendation.warnings.length ? (
            <Card style={{ borderColor: COLORS.redBorder, background: "linear-gradient(180deg, rgba(42,20,20,.92), rgba(18,14,14,.96))" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Alertas do dia</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {recommendation.warnings.map((warning) => (
                    <div
                      key={warning}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${COLORS.redBorder}`,
                        background: COLORS.redSoft,
                        color: "#FFD6D6",
                        lineHeight: 1.6,
                      }}
                    >
                      {warning}
                    </div>
                  ))}
                </div>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.6 }}>
                  Este módulo ajuda a interpretar sinais do dia, mas não substitui avaliação médica ou acompanhamento clínico.
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {showWorkoutWidget && recommendation.workoutPlan ? (
        <div
          onClick={() => setShowWorkoutWidget(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 1200,
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(980px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              borderRadius: 24,
              border: `1px solid ${COLORS.borderStrong}`,
              background: "linear-gradient(180deg, rgba(18,28,21,.98), rgba(10,14,12,.99))",
              boxShadow: "0 32px 80px rgba(0,0,0,.6)",
              padding: 20,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    borderRadius: 999,
                    background: "rgba(34,197,94,.14)",
                    color: COLORS.lime,
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1.1,
                  }}
                >
                  Widget do treino
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text }}>{recommendation.workoutPlan.focus}</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                  Treino do dia aberto em foco total para você seguir a sessão, marcar exercícios e concluir sem sair da tela.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowWorkoutWidget(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: `1px solid ${COLORS.border}`,
                  background: "#FAFAFA",
                  color: COLORS.text,
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: `1px solid ${COLORS.border}`,
                  background: "#F9FAFB",
                }}
              >
                <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>Duracao</div>
                <div style={{ marginTop: 8, color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.duration}</div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: `1px solid ${COLORS.border}`,
                  background: "#F9FAFB",
                }}
              >
                <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>Intensidade</div>
                <div style={{ marginTop: 8, color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.intensity}</div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: `1px solid ${COLORS.border}`,
                  background: "#F9FAFB",
                }}
              >
                <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>Blocos</div>
                <div style={{ marginTop: 8, color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.blocks.length}</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {recommendation.workoutPlan.blocks.map((block, blockIndex) => (
                <div
                  key={block.title}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    border: `1px solid ${COLORS.border}`,
                    background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        minWidth: 30,
                        height: 30,
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
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{block.title}</div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {block.exercises.map((exercise, exerciseIndex) => {
                      const exerciseKey = `${blockIndex}-${exerciseIndex}-${exercise}`;
                      const checked = completedExercises.includes(exerciseKey);

                      return (
                        <button
                          key={exerciseKey}
                          type="button"
                          onClick={() => toggleExerciseComplete(exerciseKey)}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            color: COLORS.muted,
                            borderRadius: 14,
                            border: `1px solid ${checked ? COLORS.borderStrong : COLORS.border}`,
                            background: checked
                              ? "linear-gradient(135deg, rgba(34,197,94,.18), rgba(16,28,20,.88))"
                              : "#FAFAFA",
                            padding: "12px 14px",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div
                            style={{
                              minWidth: 24,
                              height: 24,
                              borderRadius: 999,
                              background: checked ? "rgba(10,19,13,.72)" : COLORS.primarySoft,
                              color: COLORS.lime,
                              display: "grid",
                              placeItems: "center",
                              fontSize: 11,
                              fontWeight: 600,
                              marginTop: 1,
                            }}
                          >
                            {checked ? "✓" : "+"}
                          </div>
                          <div style={{ lineHeight: 1.6 }}>
                            {exercise}
                            <div style={{ fontSize: 11, color: checked ? COLORS.text : COLORS.mutedSoft, marginTop: 4 }}>
                              {checked ? "Exercício concluído • +5 XP" : "Marcar como concluído • +5 XP"}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openSupportVideo(exercise, recommendation.workoutPlan?.focus);
                              }}
                              style={{
                                marginTop: 8,
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: `1px solid ${COLORS.borderStrong}`,
                                background: "rgba(34,197,94,.08)",
                                color: COLORS.text,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Ver vídeo de apoio
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: "#FAFAFA",
                color: COLORS.muted,
                lineHeight: 1.6,
              }}
            >
              {recommendation.workoutPlan.closingNote}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: 16,
                borderRadius: 18,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "linear-gradient(135deg, rgba(15,61,46,.64), rgba(15,22,18,.92))",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>
                  Progresso da sessão: {completedExercises.length}/{totalExercises} exercícios
                </div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  XP acumulado nesta sessão: {exerciseXpEarned}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCompleteTraining}
                disabled={!allExercisesCompleted}
                style={{
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: `1px solid ${allExercisesCompleted ? COLORS.borderStrong : COLORS.border}`,
                  background: allExercisesCompleted
                    ? "#22C55E"
                    : "#F9FAFB",
                  color: allExercisesCompleted ? "#0A130D" : COLORS.muted,
                  fontWeight: 700,
                  cursor: allExercisesCompleted ? "pointer" : "not-allowed",
                }}
              >
                Concluir treino do dia
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
