import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { usePhysicalActivityClearance } from "../../auth/usePhysicalActivityClearance";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { persistGamificationCheckin, persistWellbeingCheckin } from "../../services/gamificationApi";
import { WorkoutContextBand } from "./components/WorkoutContextBand";
import { loadAnswers } from "./onboarding/onboardingStorage";
import {
  pageStaggerVariants,
  sectionRevealVariants,

  useTodayMotionSafe,
} from "./todayPageMotion";
import { addWorkoutHistoryEntry, getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";
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
} from "../../features/metabolism/metabolismDerivations";
import { useGamificationSummary } from "../../features/gamification/useGamificationSummary";
import { ProfessionalVoiceCard } from "../../features/professionalVoice";
import { InstallPrompt } from "../../features/pwa/InstallPrompt";
import { IncomingMessageBanner, useLatestUnreadFromProfessional } from "../../features/incomingMessage";
import { DailyCheckin, type DailyCheckinHandle } from "../../features/dailyCheckin/DailyCheckin";
import { useToast } from "../../components/Toast";
import {
  computeNudgeState,
  MetabolicCheckinModal,
  useMetabolicCheckins,
  type MetabolicCheckinInput,
} from "../../features/metabolicCheckin";
import { getDailyConditionState, useDailyCondition } from "../../features/dailyCheckin/useDailyCondition";
import { deriveConditionSignals } from "../../features/dailyCheckin/deriveConditionSignals";
import { buildDailyWorkoutRecommendation, getWorkoutRoute, summarizeWorkoutHistory } from "../../features/training/dailyWorkoutAdapter";
import type { WorkoutGoal } from "../../features/training/generateDailyWorkout";
import { useWorkoutHistory } from "../../features/training/useWorkoutHistory";
import { searchExercises } from "../../services/exercisesApi";
import { useTodayUserState } from "./hooks/useTodayUserState";
import { PersonalWorkoutCard } from "./components/PersonalWorkoutCard";
import { PersonalEmptyState } from "./components/PersonalEmptyState";
import { EmptyMetabolismHero } from "./components/EmptyMetabolismHero";
import { WelcomeCard } from "./components/WelcomeCard";
import { TodayHero } from "./components/TodayHero";
import { resolveTodayPrimary, type TodayCtaAction } from "./lib/resolveTodayPrimary";
import {
  getFirstRunState,
  isFirstRunComplete,
  markCheckinDone,
  markWorkoutDone,
} from "./components/firstRunStorage";
import { NutritionCheckinCard } from "../../features/nutrition/NutritionCheckinCard";
import { NutriVoiceCard } from "../../features/nutrition/NutriVoiceCard";
import { useNutriVoiceNote } from "../../features/nutrition/useNutriVoiceNote";
import { useAdaptiveTraining } from "../../features/training/adaptive/useAdaptiveTraining";
import { AdaptationBanner } from "../../features/training/adaptive/AdaptationBanner";
import { WorkoutStateChip } from "./components/WorkoutStateChip";
import { WeeklyLoopCard, useHasWeeklyLoopInsights } from "../../features/loopVisibility";
import { usePushSubscription } from "../../features/nutrition/usePushSubscription";
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
  locked = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
  locked?: boolean;
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
      style={{ width: fullWidth ? "100%" : "fit-content", ...styles, opacity: locked ? 0.7 : 1 }}
      title={locked ? "Assine o PAR-Q para liberar treinos" : undefined}
    >
      {locked ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          {children}
        </span>
      ) : children}
    </motion.button>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { id, user } = useAuth();
  const toast = useToast();
  const clearance = usePhysicalActivityClearance();
  const parqLocked = !clearance.valid;
  const { hasFeature } = useFeatureFlags();
  const canMessages = hasFeature("messages");
  const isMobile = useIsMobile(720);
  const userId = (id ?? "").trim().toLowerCase();
  const { data: gamification, loading: gamificationLoading, refetch: refetchGamification } = useGamificationSummary();
  const { data: metabolism, loading: metabolismLoading, error: metabolismError, refetch: refetchMetabolism } = useMetabolism();
  const [historyDays, setHistoryDays] = useState<number>(14);
  const { data: metabolismHistory, loading: historyLoading } = useMetabolismHistory(historyDays);
  const { data: workoutHistoryData } = useWorkoutHistory(30);
  const todayState = useTodayUserState();
  const { note: nutriVoiceNote } = useNutriVoiceNote();
  const showPersonalWorkout = todayState.hasActivePersonal && todayState.hasActiveWorkoutPlan;
  const adaptive = useAdaptiveTraining(showPersonalWorkout);
  const showPersonalEmpty = todayState.hasActivePersonal && !todayState.hasActiveWorkoutPlan;
  const showSuggestedWorkout =
    todayState.hasAppAccess && !todayState.hasActiveWorkoutPlan && todayState.trainingMode === "self_guided";
  const showAcademyWorkout = todayState.trainingMode === "academy_led";
  const showProfessionalVoice =
    (todayState.hasActivePersonal || todayState.hasActiveNutri) && todayState.hasProfessionalObservation;
  const {
    records: metabolicCheckins,
    loading: metabolicCheckinsLoading,
    saveCheckin: saveMetabolicCheckin,
  } = useMetabolicCheckins();
  const { condition: dailyCondition, setCondition: setDailyCondition, clearCondition: clearDailyCondition } = useDailyCondition();
  const hasWeeklyLoopInsights = useHasWeeklyLoopInsights(dailyCondition);
  const { conversation: incomingMessage, dismissLocally: dismissIncomingMessage } =
    useLatestUnreadFromProfessional({ enabled: canMessages });
  usePushSubscription();

  const onboarding = useMemo(() => (userId ? loadAnswers(userId) : null), [userId]);
  const yesterdayMuscleGroups = getYesterdayMuscleGroups();

  // When adaptation is active, patch the plan days to show adapted items so the card
  // reflects the values the student should actually execute today.
  const planForCard = useMemo(() => {
    const plan = todayState.activePlan;
    if (!plan || !adaptive.data?.adaptationEnabled || adaptive.data.changes.length === 0) return plan;
    const adaptedDay = adaptive.data.adaptedPlanDay;
    const days = plan.days.map(d =>
      d.index === adaptedDay.index ? { ...d, items: adaptedDay.items as typeof d.items } : d
    );
    return { ...plan, days };
  }, [todayState.activePlan, adaptive.data]);

  const streak = gamification?.streak ?? 0;
  const todayCheckedIn = gamification?.todayCheckedIn ?? false;

  const [quickGroups, setQuickGroups] = useState<MuscleGroup[]>([]);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [scoreImpactPreview, setScoreImpactPreview] = useState<number | null>(null);
  const [workoutMode, setWorkoutMode] = useState<"home" | "gym">(() => {
    if (!userId) return "home";
    const saved = loadAnswers(userId);
    return saved?.trainingPlace === "gym" || saved?.trainingPlace === "both" ? "gym" : "home";
  });
  const checkinRef = useRef<DailyCheckinHandle>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showMetabolicCheckin, setShowMetabolicCheckin] = useState(false);
  const [firstRun, setFirstRun] = useState(() =>
    userId ? getFirstRunState(userId) : { checkinDone: true, profileDone: true, workoutDone: true }
  );

  const conditionState = getDailyConditionState(dailyCondition);

  const { shouldReduceMotion } = useTodayMotionSafe({ isMobile });

  // Quando nenhum grupo selecionado, estima com 2 grupos como referência; quando selecionado, usa o valor real
  const defaultImpact = estimateCheckinImpact(Math.max(1, quickGroups.length > 0 ? quickGroups.length : 2), streak);

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
    () => deriveHistoryMarkers(metabolismHistory, {
      todayCheckedIn,
      condition: dailyCondition,
      workoutDates: workoutHistoryData.map((e) => e.date),
    }),
    [metabolismHistory, todayCheckedIn, dailyCondition, workoutHistoryData]
  );
  const conditionSignals = useMemo(() => deriveConditionSignals(dailyCondition), [dailyCondition]);

  // ── Hero "Seu dia": a ÚNICA ação primária por estado (passo 2 do redesign) ──
  const trainedToday = useMemo(() => {
    const completedAt = gamification?.lastWorkout?.completedAt;
    if (!completedAt) return false;
    const d = new Date(completedAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }, [gamification?.lastWorkout?.completedAt]);

  const heroReadingLine = useMemo(() => {
    const readiness = adaptive.data?.readiness?.level;
    const readinessLabel =
      readiness === "green" ? "Prontidão alta" :
      readiness === "yellow" ? "Prontidão ajustada" :
      readiness === "red" ? "Recuperação" : null;
    const stateLabel = dailyCondition && adjustedEnergy?.metabolicState ? `estado ${adjustedEnergy.metabolicState}` : null;
    return [readinessLabel, stateLabel].filter(Boolean).join(" · ") || null;
  }, [adaptive.data?.readiness?.level, dailyCondition, adjustedEnergy]);

  const heroPrimary = useMemo(
    () => resolveTodayPrimary({
      firstRunComplete: userId ? isFirstRunComplete(userId) : true,
      checkedInToday: dailyCondition != null,
      trainedToday,
      readinessLevel: adaptive.data?.readiness?.level ?? null,
      recoveryByCondition: conditionState.messagingTone === "recovery",
      hasSession: showPersonalWorkout || showAcademyWorkout || showSuggestedWorkout,
      adapted: Boolean(adaptive.data?.adaptationEnabled && (adaptive.data?.changes?.length ?? 0) > 0),
      personalNoPlan: showPersonalEmpty,
      firstName: user?.name?.split(" ")[0] || "",
      personalName: todayState.personal?.name ?? null,
    }),
    [userId, dailyCondition, trainedToday, adaptive.data, conditionState.messagingTone, showPersonalWorkout, showAcademyWorkout, showSuggestedWorkout, showPersonalEmpty, user?.name, todayState.personal?.name]
  );

  const handleHeroAction = useCallback((action: TodayCtaAction) => {
    switch (action) {
      case "open_checkin": {
        const el = document.querySelector("[data-daily-checkin]");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        checkinRef.current?.openSheet();
        break;
      }
      case "scroll_workout":
        document.getElementById("today-workout")?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "go_evolution":
        navigate("/app/user/estado-metabolico");
        break;
      case "go_chat":
        navigate("/app/user/messages");
        break;
    }
  }, [navigate]);

  const criticalSignals = useMemo(() => {
    if (!dailyCondition?.details) return [];
    const d = dailyCondition.details;
    const labels: string[] = [];
    if (d.inPain) labels.push("dor");
    if (!d.sleptWell) labels.push("sono curto");
    if (d.stressed) labels.push("estresse");
    return labels;
  }, [dailyCondition]);
  const adaptiveWorkout = useMemo(
    () => buildDailyWorkoutRecommendation({ condition: dailyCondition, user, onboarding }),
    [dailyCondition, onboarding, user]
  );
  const homeWorkout = adaptiveWorkout.recommendations.find((r) => r.type === "home") ?? adaptiveWorkout.recommendations[0];
  const gymWorkout = adaptiveWorkout.recommendations.find((r) => r.type === "gym") ?? adaptiveWorkout.recommendations[1] ?? adaptiveWorkout.recommendations[0];
  const effectiveWorkoutMode = todayState.hasActiveAcademy ? workoutMode : "home";
  const currentWorkout = effectiveWorkoutMode === "home" ? homeWorkout : gymWorkout;
  const metabolicNudge = useMemo(() => computeNudgeState(metabolicCheckins), [metabolicCheckins]);

  const histSummary = summarizeWorkoutHistory(workoutHistoryData);

  async function openSupportVideo(activity: string, _workoutTitle?: string) {
    try {
      const results = await searchExercises({ q: activity, limit: 1 });
      const exercise = results[0];
      if (exercise?.primaryMediaUrl && exercise.primaryMediaType === "youtube") {
        const videoIdMatch = exercise.primaryMediaUrl.match(/[?&]v=([^&]+)/);
        const videoId = videoIdMatch?.[1] ?? "";
        if (videoId) {
          navigate(
            `/app/user/treinos/player/support-video?videoId=${encodeURIComponent(videoId)}&title=${encodeURIComponent(
              `${exercise.name} · apoio`
            )}&durationMin=2&returnTo=${encodeURIComponent("/app/user/today")}`
          );
          return;
        }
      }
    } catch {
      // silently ignore search errors
    }
  }

  function toggleQuickGroup(group: MuscleGroup) {
    if (yesterdayMuscleGroups.includes(group) && !ALWAYS_AVAILABLE.includes(group)) return;
    setQuickGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  }


  async function handleMetabolicCheckinSave(input: MetabolicCheckinInput) {
    await saveMetabolicCheckin(input);
    refetchMetabolism();
  }

  async function handleQuickCheckin() {
    if (!quickGroups.length) {
      setCheckinMessage("Selecione pelo menos um grupo muscular.");
      return;
    }
    const blocked = quickGroups.filter(
      (g) => yesterdayMuscleGroups.includes(g) && !ALWAYS_AVAILABLE.includes(g)
    );
    if (blocked.length) {
      setCheckinMessage(`Grupos treinados ontem: ${blocked.map((g) => GROUP_LABEL[g]).join(", ")}. Evite repetir em dias seguidos.`);
      return;
    }

    const impact = estimateCheckinImpact(quickGroups.length, streak);
    setScoreImpactPreview(impact);
    setCheckinMessage("Pronto para registrar. Seu metabolismo vai responder a esse estímulo.");

    try {
      const workoutId = `quick-checkin-${Date.now()}`;
      const title = `Check-in • ${quickGroups.map((g) => GROUP_LABEL[g]).join(", ")}`;

      addWorkoutHistoryEntry({
        workoutId,
        title,
        muscleGroups: quickGroups,
        date: new Date().toISOString(),
      });

      await persistGamificationCheckin({
        source: "workout",
        xp: 20,
        workout: {
          workoutId,
          title,
          muscleGroups: quickGroups,
        },
      });
      setCheckinMessage("Registrado. Seu metabolismo já está recalculando.");
      setQuickGroups([]);
      setShowCheckin(false);
      refetchGamification();
      refetchMetabolism();
      if (userId) {
        markWorkoutDone(userId);
        setFirstRun(getFirstRunState(userId));
      }
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
      {/* 0. Faixa de instalar o app (PWA) — Android beforeinstallprompt / dica iOS */}
      <InstallPrompt />

      {/* 0. Banner de mensagem nova (apenas quando há mensagem não lida do profissional) */}
      {incomingMessage && (
        <IncomingMessageBanner
          conversation={incomingMessage}
          onDismiss={dismissIncomingMessage}
        />
      )}

      {/* 0.5 Saudação + engajamento semanal (calibrado pelo dia da semana).
          Acolhe e reconhece num só card; o passo de perfil aparece só no
          primeiro acesso. O card de parabéns separado foi mesclado aqui. */}
      <motion.div variants={sectionRevealVariants}>
        <WelcomeCard
          firstName={user?.name?.split(" ")[0] || ""}
          state={firstRun}
          workoutsThisWeek={histSummary.workoutsThisWeek}
        />
      </motion.div>

      {/* Hero "Seu dia" — só nos estados PÓS check-in (sessão/recuperação/etc).
          Em first_run e checkin_pending o protagonista é o card de Check-in,
          evitando redundância de "faça o check-in". */}
      {heroPrimary.state !== "first_run" && heroPrimary.state !== "checkin_pending" && (
        <motion.div variants={sectionRevealVariants}>
          <TodayHero primary={heroPrimary} readingLine={heroReadingLine} onAction={handleHeroAction} />
        </motion.div>
      )}

      {/* 1. Check-in de estado */}
      <motion.div variants={sectionRevealVariants} data-daily-checkin>
        <DailyCheckin
          ref={checkinRef}
          condition={dailyCondition}
          setCondition={setDailyCondition}
          clearCondition={clearDailyCondition}
          onConditionSaved={async ({ feeling, details: d }) => {
            try {
              const result = await persistWellbeingCheckin({
                feeling,
                sleptWell: d.sleptWell,
                inPain: d.inPain,
                stressed: d.stressed,
                hydrationOk: d.hydrationOk,
                nutritionLevel: d.nutritionLevel,
                mentalLoadLevel: d.mentalLoadLevel,
              });
              if (result?.rewardMicrocopy) {
                toast.success(result.rewardMicrocopy);
              }
              refetchGamification();
              refetchMetabolism();
              if (userId) {
                markCheckinDone(userId);
                setFirstRun(getFirstRunState(userId));
              }
            } catch (e) {
              console.error("[wellbeing] sync failed:", e);
            }
          }}
        />
      </motion.div>

      {/* ESPINHA DO LOOP — check-in (gatilho) → treino adaptado (payoff), coladas.
          O treino do personal vem logo após o check-in; score/gráfico (progresso)
          são combustível e ficam abaixo. Cards de nutri/academia/sugerido se
          auto-escondem para o aluno do personal (condições próprias). */}

      {/* 2 (payoff). Treino do personal — quando há ficha ativa prescrita.
          Âncora do CTA "Começar a sessão" do hero (scroll_workout). */}
      {showPersonalWorkout && todayState.personal && todayState.activePlan && (
        <motion.div id="today-workout" variants={sectionRevealVariants}>
          {/* Header unificado: identidade "Treino de hoje" + estado (chip).
              A prontidão (readiness) agora vive no hero — não repetimos a pill. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <SectionEyebrow>Treino de hoje</SectionEyebrow>
            <WorkoutStateChip state={(adaptive.data?.adaptationEnabled && adaptive.data.changes.length > 0) ? 'adapted' : 'personal_base'} />
          </div>
          {/* Presença do personal — aparece quando o treino foi adaptado */}
          {adaptive.data?.adaptationEnabled && adaptive.data.changes.length > 0 && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(34,197,94,0.07)",
                border: "1px solid rgba(34,197,94,0.18)",
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginBottom: 8,
                lineHeight: 1.5,
              }}
            >
              {(() => {
                // Vínculo causal explícito: o ajuste SÓ existe porque houve check-in hoje
                // (sem check-in → readiness null → este bloco não renderiza). Listar os
                // fatores reportados fecha o loop "eu fiz check-in → meu treino mudou".
                const reasons = (adaptive.data.readiness?.factors ?? [])
                  .filter((f) => f.severity !== "info")
                  .map((f) => f.label);
                const firstName = todayState.personal?.name?.split(" ")[0];
                return (
                  <>
                    Ajustamos seu treino com base no seu check-in de hoje
                    {reasons.length > 0 ? (
                      <>: <strong style={{ fontWeight: 600 }}>{reasons.join(" · ")}</strong>.</>
                    ) : (
                      "."
                    )}
                    {firstName ? ` ${firstName} está de olho na sua evolução.` : ""}
                  </>
                );
              })()}
            </div>
          )}
          {/* Diff banner — só quando há adaptações */}
          {adaptive.data?.adaptationEnabled && adaptive.data.changes.length > 0 && (
            <AdaptationBanner
              changes={adaptive.data.changes}
              recoverySuggestion={adaptive.data.recoverySuggestion}
              exerciseNames={Object.fromEntries(
                (adaptive.data.adaptedPlanDay?.items ?? []).map(i => [i.exerciseId, i.name])
              )}
            />
          )}
          {/* O card mostra a ficha prescrita; o AdaptationBanner acima já
              comunica o diff (original × hoje) quando há ajuste. */}
          <PersonalWorkoutCard
            personal={todayState.personal}
            plan={planForCard ?? todayState.activePlan}
            isMobile={isMobile}
          />
        </motion.div>
      )}

      {/* 2b. Personal vinculado, ainda sem ficha — estado vazio com ação */}
      {showPersonalEmpty && todayState.personal && (
        <motion.div variants={sectionRevealVariants}>
          <PersonalEmptyState
            personal={todayState.personal}
            isMobile={isMobile}
            fallbackWorkout={homeWorkout}
          />
        </motion.div>
      )}

      {/* 3. Voz do profissional — presença, logo após o treino */}
      {showProfessionalVoice && (
        <motion.div variants={sectionRevealVariants}>
          <ProfessionalVoiceCard
            personal={todayState.personal}
            nutri={todayState.nutri}
            criticalSignals={criticalSignals}
          />
        </motion.div>
      )}

      {/* 4. Progresso — âncora metabólica (combustível, não manchete: abaixo do treino) */}
      <motion.div variants={sectionRevealVariants}>
        {!metabolismLoading && !metabolism ? (
          <EmptyMetabolismHero />
        ) : (
          <MetabolicScoreCard
            data={metabolism}
            loading={metabolismLoading}
            error={metabolismError}
            derivedStatus={adjustedEnergy}
            forecast={forecast}
            conditionContext={conditionSignals.length > 0 ? { signals: conditionSignals } : null}
            trendStrip={{ records: metabolicCheckins, loading: metabolicCheckinsLoading }}
            nudge={{ state: metabolicNudge, onOpen: () => setShowMetabolicCheckin(true) }}
          />
        )}
      </motion.div>

      {/* 5. Engajamento + evolução — celebração da consistência colada à prova
          (curva subindo). O card de engajamento emoldura o gráfico: "treinou X
          dias" → "veja seu estado subir". */}
      <motion.div variants={sectionRevealVariants} style={{ display: 'grid', gap: 12 }}>
        <MetabolicChart
          data={metabolismHistory}
          loading={historyLoading}
          forecast={forecast}
          markers={markers}
          days={historyDays}
          onDaysChange={setHistoryDays}
        />
        {hasWeeklyLoopInsights && <WeeklyLoopCard condition={dailyCondition} />}
      </motion.div>

      {/* 6. Plano alimentar — só renderiza para quem tem nutri (silencioso caso contrário) */}
      <motion.div variants={sectionRevealVariants}>
        <NutritionCheckinCard />
      </motion.div>

      {/* 6.1. Voz da nutricionista — nota publicada nas últimas 72h */}
      {nutriVoiceNote && (
        <motion.div variants={sectionRevealVariants}>
          <NutriVoiceCard note={nutriVoiceNote} />
        </motion.div>
      )}

      {/* 5d. Academy-led — aluno de academia sem personal: treino sugerido com viés gym */}
      {showAcademyWorkout && (
        <motion.div id="today-workout" variants={sectionRevealVariants}>
          <div
            className="today-card"
            style={{ borderColor: SURFACE.border, boxShadow: SURFACE.shadow, padding: isMobile ? 18 : 22 }}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 3 }}>
                  <SectionEyebrow>Treino de hoje</SectionEyebrow>
                  <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: SURFACE.text }}>
                    {gymWorkout?.title ?? "Treino na academia"}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: SURFACE.muted,
                  padding: "4px 12px", borderRadius: 999,
                  border: `1px solid ${SURFACE.border}`, background: SURFACE.page,
                }}>
                  Academia
                </span>
              </div>

              {gymWorkout && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: SURFACE.muted,
                      padding: "3px 10px", borderRadius: 999,
                      border: `1px solid ${SURFACE.border}`, background: SURFACE.page,
                    }}>
                      {gymWorkout.duration} min
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {gymWorkout.exercises.slice(0, 5).map((ex) => (
                      <span key={ex} style={{
                        fontSize: 12, color: SURFACE.muted, padding: "3px 10px",
                        borderRadius: 999, border: `1px solid ${SURFACE.border}`, background: SURFACE.page,
                      }}>
                        {ex}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <ActionButton
                variant="primary"
                onClick={() => navigate(parqLocked ? "/app/user/parq?returnTo=%2Fapp%2Fuser%2Fsuggested-training" : "/app/user/suggested-training")}
                fullWidth={isMobile}
                locked={parqLocked}
              >
                Ver o treino inteiro →
              </ActionButton>
            </div>
          </div>
        </motion.div>
      )}

      {/* 5c. Treino sugerido pela IA — self-guided sem ficha do personal */}
      {showSuggestedWorkout && (
      <motion.div id="today-workout" variants={sectionRevealVariants}>
        <div
          className="today-card"
          style={{ borderColor: SURFACE.border, boxShadow: SURFACE.shadow, padding: isMobile ? 18 : 22 }}
        >
          <div style={{ display: "grid", gap: 18 }}>

            <WorkoutContextBand
              workout={{
                isReactivation: currentWorkout?.goal === "reactivate metabolism",
                intensity: adaptiveWorkout.intensity,
                daysWithoutTraining: histSummary.daysWithoutTraining,
                workoutsThisWeek: histSummary.workoutsThisWeek,
              }}
              condition={dailyCondition}
              metabolism={metabolism}
              streak={streak}
            />

            {/* Header + toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <SectionEyebrow>Treino de hoje</SectionEyebrow>
                  <WorkoutStateChip state="suggested" />
                </div>
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: SURFACE.text }}>
                  {currentWorkout?.title ?? "Treino recomendado"}
                </div>
              </div>

              {todayState.hasActiveAcademy ? (
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
              ) : (
                <span style={{
                  fontSize: 12, fontWeight: 600, color: SURFACE.muted,
                  padding: "6px 12px", background: SURFACE.page,
                  borderRadius: 8, border: `1px solid ${SURFACE.border}`,
                }}>
                  Em casa
                </span>
              )}
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
                        background: SURFACE.card,
                      }}
                    >
                      {ex}
                      <span style={{ fontSize: 9, opacity: 0.7 }}>▶</span>
                    </button>
                  ))}
                </div>

                <ActionButton
                  onClick={() => {
                    const dest = getWorkoutRoute(workoutMode);
                    navigate(parqLocked ? `/app/user/parq?returnTo=${encodeURIComponent(dest)}` : dest);
                  }}
                  fullWidth={isMobile}
                  locked={parqLocked}
                >
                  Ver o treino inteiro →
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
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ transition: "transform 0.2s ease", transform: showCheckin ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
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
                        Registrar como feito
                      </ActionButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {gamificationLoading && (
        <motion.div variants={sectionRevealVariants} className="today-loading-note" style={{ color: SURFACE.mutedSoft }}>
          Carregando dados…
        </motion.div>
      )}
      <MetabolicCheckinModal
        open={showMetabolicCheckin}
        onClose={() => setShowMetabolicCheckin(false)}
        onSave={handleMetabolicCheckinSave}
      />
    </motion.div>
  );
}
