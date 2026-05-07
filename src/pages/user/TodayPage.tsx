import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import { getDailyMission } from "./gamification";
import { loadAnswers } from "./onboarding/onboardingStorage";
import {
  pageStaggerVariants,
  sectionRevealVariants,
  subtleHoverScale,
  subtleTapScale,
  useTodayMotionSafe,
} from "./todayPageMotion";
import { getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";
import {
  MetabolicChart,
  MetabolicScoreCard,
  useMetabolism,
  useMetabolismHistory,
} from "../../features/metabolism";
import { estimateCheckinImpact } from "../../features/metabolism/estimateImpact";
import {
  deriveEnergyStatus,
  deriveHistoryMarkers,
  deriveMetabolicForecast,
  deriveQuickAction,
  type QuickActionModel,
} from "../../features/metabolism/metabolismDerivations";
import { useGamificationSummary } from "../../features/gamification/useGamificationSummary";
import { DailyCheckin } from "../../features/dailyCheckin/DailyCheckin";
import { getDailyConditionState, useDailyCondition } from "../../features/dailyCheckin/useDailyCondition";
import { buildDailyWorkoutRecommendation, getWorkoutRoute } from "../../features/training/dailyWorkoutAdapter";
import type { WorkoutGoal } from "../../features/training/generateDailyWorkout";
import { resolveSupportVideoForActivity } from "./trainingSupportVideos";
import "./todayPage.css";

const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: "Peito",
  back: "Costas",
  legs: "Pernas",
  shoulders: "Ombros",
  arms: "Braços",
  core: "Core",
  full_body: "Corpo inteiro",
  cardio: "Cardio",
  mobility: "Mobilidade",
};


const GOAL_LABEL: Record<WorkoutGoal, string> = {
  "reactivate metabolism": "Reativar metabolismo",
  "build momentum": "Ganhar ritmo",
  "raise metabolic output": "Elevar rendimento",
};

const ALWAYS_AVAILABLE: MuscleGroup[] = ["cardio", "mobility"];
const ALL_GROUPS: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core", "cardio", "mobility"];

const SURFACE = {
  page: "var(--color-bg-main)",
  card: "var(--color-surface)",
  border: "var(--color-border)",
  borderStrong: "var(--color-border-strong)",
  text: "var(--color-text)",
  muted: "var(--color-text-muted)",
  mutedSoft: "var(--color-text-subtle)",
  success: "var(--color-success-text)",
  info: "var(--color-accent-hover)",
  warning: "var(--color-warn)",
  shadow: "var(--shadow-lg)",
  heroGlow:
    "radial-gradient(circle at 0% 0%, rgba(34,197,94,0.18), transparent 34%), radial-gradient(circle at 100% 0%, rgba(6,182,212,0.16), transparent 30%)",
} as const;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="today-eyebrow">{children}</div>;
}

function ActionButton({
  children,
  onClick,
  variant = "primary",
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
}) {
  const styles =
    variant === "primary"
      ? {
          background: "linear-gradient(135deg, #22C55E, #06B6D4)",
          color: "#FFFFFF",
          border: "none",
          boxShadow: "0 14px 34px rgba(34,197,94,0.18)",
        }
      : variant === "secondary"
        ? {
            background: SURFACE.card,
            color: SURFACE.text,
            border: `1px solid ${SURFACE.border}`,
            boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
          }
        : {
            background: "rgba(255,255,255,0.62)",
            color: SURFACE.text,
            border: `1px solid ${SURFACE.border}`,
            boxShadow: "none",
          };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
      className={`today-action-button today-action-button-${variant}`}
      style={{ width: fullWidth ? "100%" : "fit-content", ...styles }}
    >
      {children}
    </motion.button>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { id, user } = useAuth();
  const { planName } = useFeatureFlags();
  const isMobile = useIsMobile(720);
  const userId = (id ?? "").trim().toLowerCase();
  const isFreePlan = (planName || "").toLowerCase() === "free";

  const { data: gamification, loading: gamificationLoading, refetch: refetchGamification } = useGamificationSummary();
  const { data: metabolism, loading: metabolismLoading, error: metabolismError, refetch: refetchMetabolism } = useMetabolism();
  const { data: metabolismHistory, loading: historyLoading } = useMetabolismHistory();

  const onboarding = useMemo(() => (userId ? loadAnswers(userId) : null), [userId]);
  const yesterdayMuscleGroups = getYesterdayMuscleGroups();
  const mission = getDailyMission();

  const streak = gamification?.streak ?? 0;
  const todayCheckedIn = gamification?.todayCheckedIn ?? false;

  const [quickGroups, setQuickGroups] = useState<MuscleGroup[]>([]);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [scoreImpactPreview, setScoreImpactPreview] = useState<number | null>(null);
  const [workoutMode, setWorkoutMode] = useState<"home" | "gym">("home");
  const [showCheckin, setShowCheckin] = useState(false);

  const { condition: dailyCondition, setCondition: setDailyCondition, clearCondition: clearDailyCondition } = useDailyCondition();
  const conditionState = getDailyConditionState(dailyCondition);

  const { shouldReduceMotion } = useTodayMotionSafe({ isMobile });

  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date());
  const weekdayCapitalized = weekdayLabel.charAt(0).toUpperCase() + weekdayLabel.slice(1);
  const missionProgress = mission.target > 0 ? Math.min(1, mission.progress / mission.target) : 0;
  const defaultImpact = estimateCheckinImpact(Math.max(1, quickGroups.length || 2), streak);

  const derivedEnergy = useMemo(() => deriveEnergyStatus(metabolism), [metabolism]);

  const adjustedEnergy = useMemo(() => {
    if (!derivedEnergy || !dailyCondition) return derivedEnergy;
    const tone = conditionState.messagingTone;
    if (tone === "push") {
      return {
        ...derivedEnergy,
        energyLabel: derivedEnergy.band === "high" ? "Alto" : "Moderado para alto",
        metabolicState: (derivedEnergy.metabolicState === "Ativo" ? "Pico" : derivedEnergy.metabolicState) as typeof derivedEnergy.metabolicState,
        energy: Math.min(100, derivedEnergy.energy + 10),
        focus: Math.min(100, derivedEnergy.focus + 8),
        fatBurn: Math.min(100, derivedEnergy.fatBurn + 5),
      };
    }
    if (tone === "recovery") {
      return {
        ...derivedEnergy,
        energyLabel: "Recuperação",
        metabolicState: "Aquecendo" as typeof derivedEnergy.metabolicState,
        energy: Math.max(10, derivedEnergy.energy - 12),
        focus: Math.max(10, derivedEnergy.focus - 10),
        fatBurn: Math.max(10, derivedEnergy.fatBurn - 6),
      };
    }
    return derivedEnergy;
  }, [dailyCondition, conditionState.messagingTone, derivedEnergy]);

  const forecast = useMemo(
    () => deriveMetabolicForecast(metabolism, { streak, todayCheckedIn, activityImpact: defaultImpact }),
    [defaultImpact, metabolism, streak, todayCheckedIn]
  );
  const markers = useMemo(
    () => deriveHistoryMarkers(metabolismHistory, { todayCheckedIn }),
    [metabolismHistory, todayCheckedIn]
  );
  const quickAction = useMemo<QuickActionModel>(
    () => deriveQuickAction({ data: metabolism, missionId: mission.id, todayCheckedIn, isFreePlan }),
    [isFreePlan, metabolism, mission.id, todayCheckedIn]
  );

  const adaptiveWorkout = useMemo(
    () => buildDailyWorkoutRecommendation({ condition: dailyCondition, user, onboarding }),
    [dailyCondition, onboarding, user]
  );
  const homeWorkout = adaptiveWorkout.recommendations.find((r) => r.type === "home") ?? adaptiveWorkout.recommendations[0];
  const gymWorkout = adaptiveWorkout.recommendations.find((r) => r.type === "gym") ?? adaptiveWorkout.recommendations[1] ?? adaptiveWorkout.recommendations[0];
  const currentWorkout = workoutMode === "home" ? homeWorkout : gymWorkout;

  const primaryMissionLabel = todayCheckedIn
    ? quickAction.label
    : quickAction.kind === "suggested_training"
      ? "Treino recomendado"
      : quickAction.label;

  const tonedMissionLabel = dailyCondition
    ? conditionState.messagingTone === "recovery"
      ? "Modo recuperação · " + primaryMissionLabel
      : conditionState.messagingTone === "push"
        ? "↑ " + primaryMissionLabel
        : primaryMissionLabel
    : primaryMissionLabel;
  const missionCtaLabel = quickAction.kind === "suggested_training" ? "Abrir plano completo →" : tonedMissionLabel;

  function runQuickAction(action: QuickActionModel) {
    if (action.kind === "checkin") {
      setShowCheckin(true);
      return;
    }
    if (action.route) {
      navigate(action.route);
    }
  }

  function openSupportVideo(activity: string, workoutTitle: string) {
    const support = resolveSupportVideoForActivity(activity, workoutTitle);
    if (!support) return;

    navigate(
      `/app/user/treinos/player/support-video?videoId=${encodeURIComponent(support.video.videoId)}&title=${encodeURIComponent(
        `${activity} · apoio`
      )}&durationMin=${support.video.durationMin}&returnTo=${encodeURIComponent("/app/user/today")}`
    );
  }

  function toggleQuickGroup(group: MuscleGroup) {
    if (yesterdayMuscleGroups.includes(group) && !ALWAYS_AVAILABLE.includes(group)) return;
    setQuickGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  }

  async function handleQuickCheckin() {
    if (!quickGroups.length) {
      setCheckinMessage("Selecione pelo menos um grupo muscular.");
      return;
    }
    const blocked = quickGroups.filter((g) => yesterdayMuscleGroups.includes(g));
    if (blocked.length) {
      setCheckinMessage(`Grupos treinados ontem: ${blocked.map((g) => GROUP_LABEL[g]).join(", ")}. Evite repetir em dias seguidos.`);
      return;
    }

    const impact = estimateCheckinImpact(quickGroups.length, streak);
    setScoreImpactPreview(impact);
    setCheckinMessage(`Projeção: +${impact} no score com esse treino.`);

    try {
      await persistGamificationCheckin({
        source: "workout",
        xp: 20,
        workout: {
          workoutId: `quick-checkin-${Date.now()}`,
          title: `Check-in • ${quickGroups.map((g) => GROUP_LABEL[g]).join(", ")}`,
          muscleGroups: quickGroups,
        },
      });
      setCheckinMessage("Treino registrado. Score será recalculado.");
      setQuickGroups([]);
      setShowCheckin(false);
      refetchGamification();
      refetchMetabolism();
    } catch {
      setCheckinMessage("Erro ao registrar. Tente novamente.");
    } finally {
      setTimeout(() => {
        setScoreImpactPreview(null);
        setCheckinMessage(null);
      }, 4000);
    }
  }

  return (
    <motion.div
      className="today-dashboard"
      variants={pageStaggerVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
    >
      {/* 1. Check-in de estado */}
      <motion.div variants={sectionRevealVariants}>
        <DailyCheckin
          condition={dailyCondition}
          setCondition={setDailyCondition}
          clearCondition={clearDailyCondition}
        />
      </motion.div>

      {/* 2. Âncora metabólica */}
      <motion.div variants={sectionRevealVariants}>
        <MetabolicScoreCard
          data={metabolism}
          loading={metabolismLoading}
          error={metabolismError}
          derivedStatus={adjustedEnergy}
          forecast={forecast}
        />
      </motion.div>

      {/* 3. Histórico metabólico */}
      <motion.div variants={sectionRevealVariants}>
        <MetabolicChart data={metabolismHistory} loading={historyLoading} forecast={forecast} markers={markers} />
      </motion.div>

      {/* 4. Consistência + missão */}
      <motion.div variants={sectionRevealVariants}>
        <div
          className="today-hero"
          style={{ borderColor: SURFACE.border, padding: isMobile ? 18 : 24, boxShadow: SURFACE.shadow }}
        >
          <div aria-hidden className="today-hero-glow" style={{ background: SURFACE.heroGlow }} />

          <div className="today-hero-content">
            <div className="today-badge-row">
              <span className="badge badge-accent">{weekdayCapitalized}</span>
              {todayCheckedIn && <span className="badge badge-success">Dia garantido</span>}
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <SectionEyebrow>Consistência do dia</SectionEyebrow>
                <div className="today-card-title" style={{ fontSize: isMobile ? 22 : 28 }}>
                  Seu ritmo hoje
                </div>
                <div className="today-card-description" style={{ color: SURFACE.muted }}>
                  Missão diária, sequência e próximo passo em um único lugar.
                </div>
              </div>
              {streak > 0 && (
                <div
                  className="today-reward-pill"
                  style={{
                    width: "fit-content",
                    borderColor: streak >= 3 ? "rgba(245,158,11,0.2)" : SURFACE.border,
                    color: streak >= 3 ? SURFACE.warning : SURFACE.text,
                  }}
                >
                  {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
                </div>
              )}
            </div>

            {/* Missão do dia */}
            <motion.div
              whileHover={subtleHoverScale}
              whileTap={subtleTapScale}
              className="today-card today-mission-card"
              style={{ borderColor: mission.completed ? SURFACE.borderStrong : SURFACE.border, padding: isMobile ? 14 : 18 }}
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <SectionEyebrow>Missão de hoje</SectionEyebrow>
                    <div className="today-card-title" style={{ fontSize: isMobile ? 18 : 22 }}>{mission.title}</div>
                    <div className="today-card-description" style={{ color: SURFACE.muted }}>{mission.description}</div>
                  </div>
                  <div className="today-reward-pill" style={{ borderColor: SURFACE.borderStrong, color: SURFACE.success }}>
                    +{mission.rewardXp} XP · +{defaultImpact} score
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: SURFACE.muted, fontWeight: 600 }}>
                      {mission.completed ? "Concluída hoje" : "Progresso"}
                    </span>
                    <span style={{ fontSize: 12, color: SURFACE.text, fontWeight: 700 }}>
                      {mission.progress}/{mission.target}
                    </span>
                  </div>
                  <div className="today-progress-track">
                    <motion.div
                      initial={shouldReduceMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: missionProgress }}
                      transition={{ duration: 0.65, ease: "easeOut", delay: 0.08 }}
                      className="today-progress-fill"
                      style={{ transformOrigin: "left center" }}
                    />
                  </div>
                </div>

                <ActionButton onClick={() => runQuickAction(quickAction)} fullWidth={isMobile}>
                  {missionCtaLabel}
                </ActionButton>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* 5. Treino de hoje — toggle home/gym */}
      <motion.div variants={sectionRevealVariants}>
        <div
          className="today-card"
          style={{ borderColor: SURFACE.border, boxShadow: SURFACE.shadow, padding: isMobile ? 18 : 22 }}
        >
          <div style={{ display: "grid", gap: 18 }}>

            {/* Header + toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 3 }}>
                <SectionEyebrow>Treino de hoje</SectionEyebrow>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: SURFACE.text }}>
                  {currentWorkout?.title ?? "Treino recomendado"}
                </div>
              </div>

              <div style={{
                display: "flex",
                background: SURFACE.page,
                borderRadius: 10,
                padding: 3,
                gap: 2,
                border: `1px solid ${SURFACE.border}`,
                flexShrink: 0,
              }}>
                {(["home", "gym"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setWorkoutMode(mode)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                      background: workoutMode === mode ? SURFACE.card : "transparent",
                      color: workoutMode === mode ? SURFACE.text : SURFACE.muted,
                      boxShadow: workoutMode === mode ? "0 1px 4px rgba(15,23,42,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {mode === "home" ? "Em casa" : "Academia"}
                  </button>
                ))}
              </div>
            </div>

            {/* Detalhes do treino */}
            {currentWorkout && (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: SURFACE.muted,
                    padding: "3px 10px", borderRadius: 999,
                    border: `1px solid ${SURFACE.border}`, background: SURFACE.page,
                  }}>
                    {currentWorkout.duration} min
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: SURFACE.muted,
                    padding: "3px 10px", borderRadius: 999,
                    border: `1px solid ${SURFACE.border}`, background: SURFACE.page,
                  }}>
                    {GOAL_LABEL[currentWorkout.goal]}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: SURFACE.info,
                    padding: "3px 10px", borderRadius: 999,
                    border: "1px solid rgba(8,145,178,0.2)", background: "rgba(8,145,178,0.05)",
                  }}>
                    {currentWorkout.scoreImpact}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {currentWorkout.exercises.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => openSupportVideo(ex, currentWorkout.title)}
                      className="today-tag"
                      style={{
                        borderColor: SURFACE.border,
                        color: SURFACE.info,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        cursor: "pointer",
                        background: "#FFFFFF",
                      }}
                    >
                      {ex}
                      <span style={{ fontSize: 9, opacity: 0.7 }}>▶</span>
                    </button>
                  ))}
                </div>

                {forecast && (
                  <div style={{
                    fontSize: 13, color: SURFACE.muted,
                    padding: "9px 14px",
                    background: "rgba(34,197,94,0.05)",
                    borderRadius: 10,
                    border: "1px solid rgba(34,197,94,0.14)",
                    display: "flex", gap: 6, alignItems: "center",
                  }}>
                    Amanhã com treino:
                    <strong style={{ color: SURFACE.success, fontSize: 15 }}>
                      {forecast.tomorrowWithActivity}
                    </strong>
                    {forecast.withActivityDelta > 0 && (
                      <span style={{ color: SURFACE.success, fontWeight: 700 }}>
                        (+{forecast.withActivityDelta})
                      </span>
                    )}
                  </div>
                )}

                <ActionButton onClick={() => navigate(getWorkoutRoute(workoutMode))} fullWidth={isMobile}>
                  Abrir plano completo →
                </ActionButton>
              </div>
            )}

            {/* Registrar treino (expansível) */}
            <div>
              <button
                type="button"
                onClick={() => setShowCheckin((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: showCheckin ? SURFACE.text : SURFACE.muted,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "color 0.15s ease",
                }}
              >
                <span style={{ fontSize: 10 }}>{showCheckin ? "▲" : "▼"}</span>
                Já treinou? Registre aqui
              </button>

              <AnimatePresence>
                {showCheckin && (
                  <motion.div
                    key="checkin-inline"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } }}
                    exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ paddingTop: 16, display: "grid", gap: 12 }}>
                      <div
                        className="today-group-grid"
                        style={{ gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, minmax(0, 1fr))" }}
                      >
                        {ALL_GROUPS.map((group) => {
                          const disabled = yesterdayMuscleGroups.includes(group) && !ALWAYS_AVAILABLE.includes(group);
                          const active = quickGroups.includes(group);
                          return (
                            <motion.button
                              key={group}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleQuickGroup(group)}
                              whileHover={disabled ? undefined : { scale: 1.015, y: -1 }}
                              whileTap={disabled ? undefined : { scale: 0.985 }}
                              className={`today-group-button${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}`}
                              style={{
                                borderColor: active ? "rgba(34,197,94,0.4)" : SURFACE.border,
                                background: active ? "rgba(34,197,94,0.08)" : disabled ? "#F8FAFC" : SURFACE.card,
                                color: disabled ? SURFACE.mutedSoft : SURFACE.text,
                              }}
                            >
                              <span className="today-group-copy">
                                <span className="today-group-label" style={{ fontWeight: active ? 700 : 500 }}>
                                  {GROUP_LABEL[group]}
                                </span>
                                <span className="today-group-helper" style={{ color: SURFACE.mutedSoft }}>
                                  {disabled ? "Descansando" : "Disponível"}
                                </span>
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>

                      <AnimatePresence>
                        {checkinMessage && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="today-feedback-banner"
                            style={{
                              background: scoreImpactPreview ? "rgba(6,182,212,0.06)" : "#F8FAFC",
                              borderColor: scoreImpactPreview ? "rgba(6,182,212,0.25)" : SURFACE.border,
                              color: scoreImpactPreview ? SURFACE.info : SURFACE.muted,
                              fontWeight: scoreImpactPreview ? 700 : 500,
                            }}
                          >
                            {checkinMessage}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <ActionButton onClick={handleQuickCheckin} fullWidth>
                        Confirmar treino
                      </ActionButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {gamificationLoading && (
        <motion.div variants={sectionRevealVariants} className="today-loading-note" style={{ color: SURFACE.mutedSoft }}>
          Carregando dados…
        </motion.div>
      )}
    </motion.div>
  );
}
