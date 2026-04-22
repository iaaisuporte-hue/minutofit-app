import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import { getDailyMission } from "./gamification";
import { loadRecommendation } from "./onboarding/onboardingStorage";
import {
  itemRevealVariants,
  pageStaggerVariants,
  sectionRevealVariants,
  subtleHoverScale,
  subtleTapScale,
  useTodayMotionSafe,
} from "./todayPageMotion";
import { getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";
import {
  MetabolicChart,
  MetabolicInsights,
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
  deriveSmartInsight,
  type QuickActionModel,
} from "../../features/metabolism/metabolismDerivations";
import { useGamificationSummary } from "../../features/gamification/useGamificationSummary";
import { DailyCheckin } from "../../features/dailyCheckin/DailyCheckin";
import { getDailyConditionState, useDailyCondition } from "../../features/dailyCheckin/useDailyCondition";
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

const GROUP_ICON: Record<MuscleGroup, string> = {
  chest: "🫀",
  back: "🧱",
  legs: "🦵",
  shoulders: "🏋️",
  arms: "💪",
  core: "⭕",
  full_body: "⚡",
  cardio: "🏃",
  mobility: "🧘",
};

const ALWAYS_AVAILABLE: MuscleGroup[] = ["cardio", "mobility"];
const ALL_GROUPS: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core", "cardio", "mobility"];

const SURFACE = {
  page: "#F7FAFC",
  card: "#FFFFFF",
  cardSoft: "#FBFDFF",
  border: "#E2E8F0",
  borderStrong: "rgba(34,197,94,0.24)",
  text: "#0F172A",
  muted: "#64748B",
  mutedSoft: "#94A3B8",
  success: "#16A34A",
  info: "#0891B2",
  warning: "#EA580C",
  shadow: "0 10px 32px rgba(15, 23, 42, 0.06)",
  heroGlow:
    "radial-gradient(circle at 0% 0%, rgba(34,197,94,0.18), transparent 34%), radial-gradient(circle at 100% 0%, rgba(6,182,212,0.16), transparent 30%)",
} as const;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="today-eyebrow">{children}</div>;
}

function CompactStat({
  label,
  value,
  helper,
  accent = false,
}: {
  label: string;
  value: string;
  helper: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`today-compact-stat${accent ? " today-compact-stat-accent" : ""}`}
      style={{
        borderColor: accent ? SURFACE.borderStrong : SURFACE.border,
      }}
    >
      <SectionEyebrow>{label}</SectionEyebrow>
      <div className="today-compact-stat-value">{value}</div>
      <div className="today-compact-stat-helper">{helper}</div>
    </div>
  );
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
  const checkinSectionRef = useRef<HTMLDivElement | null>(null);
  const { id, user } = useAuth();
  const { planName } = useFeatureFlags();
  const isMobile = useIsMobile(720);
  const userId = (id ?? "").trim().toLowerCase();
  const isFreePlan = (planName || "").toLowerCase() === "free";

  const { data: gamification, loading: gamificationLoading, refetch: refetchGamification } = useGamificationSummary();
  const { data: metabolism, loading: metabolismLoading, error: metabolismError, refetch: refetchMetabolism } = useMetabolism();
  const { data: metabolismHistory, loading: historyLoading } = useMetabolismHistory();

  const recommendation = userId ? loadRecommendation(userId) : null;
  const yesterdayMuscleGroups = getYesterdayMuscleGroups();
  const mission = getDailyMission();

  const streak = gamification?.streak ?? 0;
  const xp = gamification?.xp ?? 0;
  const level = gamification?.level ?? 1;
  const todayCheckedIn = gamification?.todayCheckedIn ?? false;
  const lastWorkout = gamification?.lastWorkout ?? null;

  const [quickGroups, setQuickGroups] = useState<MuscleGroup[]>([]);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [scoreImpactPreview, setScoreImpactPreview] = useState<number | null>(null);

  const { condition: dailyCondition } = useDailyCondition();
  const conditionState = getDailyConditionState(dailyCondition);

  const { shouldReduceMotion } = useTodayMotionSafe({ isMobile });

  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date());
  const weekdayCapitalized = weekdayLabel.charAt(0).toUpperCase() + weekdayLabel.slice(1);
  const missionProgress = mission.target > 0 ? Math.min(1, mission.progress / mission.target) : 0;
  const defaultImpact = estimateCheckinImpact(Math.max(1, quickGroups.length || 2), streak);

  const derivedEnergy = useMemo(() => deriveEnergyStatus(metabolism), [metabolism]);
  const forecast = useMemo(
    () =>
      deriveMetabolicForecast(metabolism, {
        streak,
        todayCheckedIn,
        activityImpact: defaultImpact,
      }),
    [defaultImpact, metabolism, streak, todayCheckedIn]
  );
  const markers = useMemo(
    () => deriveHistoryMarkers(metabolismHistory, { todayCheckedIn }),
    [metabolismHistory, todayCheckedIn]
  );
  const smartInsight = useMemo(
    () =>
      deriveSmartInsight({
        data: metabolism,
        streak,
        todayCheckedIn,
        mission,
        yesterdayMuscleGroups,
      }),
    [metabolism, mission, streak, todayCheckedIn, yesterdayMuscleGroups]
  );
  const quickAction = useMemo<QuickActionModel>(
    () =>
      deriveQuickAction({
        data: metabolism,
        missionId: mission.id,
        todayCheckedIn,
        isFreePlan,
      }),
    [isFreePlan, metabolism, mission.id, todayCheckedIn]
  );

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

  function scrollToCheckin() {
    checkinSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function runQuickAction(action: QuickActionModel) {
    if (action.kind === "checkin") {
      scrollToCheckin();
      return;
    }

    if (action.route) {
      navigate(action.route);
    }
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
    setCheckinMessage(`Projeção rápida: +${impact} no score com esse treino.`);

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
      setCheckinMessage("Treino registrado. Seu status metabólico será recalculado.");
      setQuickGroups([]);
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
    <motion.div className="today-dashboard" variants={pageStaggerVariants} initial={shouldReduceMotion ? false : "hidden"} animate="show">
      <motion.div variants={sectionRevealVariants}>
        <DailyCheckin />
      </motion.div>

      <motion.div variants={sectionRevealVariants}>
        <div className="today-hero" style={{ borderColor: SURFACE.border, padding: isMobile ? 18 : 24, boxShadow: SURFACE.shadow }}>
          <div aria-hidden className="today-hero-glow" style={{ background: SURFACE.heroGlow }} />

          <div className="today-hero-content">
            <div className="today-badge-row">
              <span className="badge badge-accent">📅 {weekdayCapitalized}</span>
              {todayCheckedIn && <span className="badge badge-success">✓ Dia garantido</span>}
              {derivedEnergy && <span className="badge badge-accent">{derivedEnergy.metabolicState}</span>}
            </div>

            <div className="today-hero-copy">
              <h1 className="today-hero-title" style={{ fontSize: isMobile ? 24 : 30 }}>
                {user?.name ? `${user.name.split(" ")[0]},` : "Hoje,"} seu metabolismo pode render mais com a ação certa.
              </h1>
              <p className="today-hero-description" style={{ color: SURFACE.muted }}>
                Seu painel agora prioriza o que aumenta retorno: missão do dia, previsão para amanhã, impacto do treino e a recomendação mais inteligente neste momento.
              </p>
            </div>

            <div
              className="today-hero-grid"
              style={{ gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.45fr) minmax(260px, 0.9fr)" }}
            >
              <motion.div
                variants={itemRevealVariants}
                whileHover={subtleHoverScale}
                whileTap={subtleTapScale}
                className="today-card today-mission-card"
                style={{
                  borderColor: mission.completed ? SURFACE.borderStrong : SURFACE.border,
                  padding: isMobile ? 18 : 20,
                }}
              >
                <div className="today-card-header">
                  <div className="today-card-copy">
                    <SectionEyebrow>Daily Mission</SectionEyebrow>
                    <div className="today-card-title" style={{ fontSize: isMobile ? 22 : 26 }}>{mission.title}</div>
                    <div className="today-card-description" style={{ color: SURFACE.muted }}>{mission.description}</div>
                  </div>
                  <div className="today-reward-pill" style={{ borderColor: SURFACE.borderStrong, color: SURFACE.success }}>
                    +{mission.rewardXp} XP · +{defaultImpact} score
                  </div>
                </div>

                <div className="today-progress-block">
                  <div className="today-progress-head">
                    <span className="today-progress-label" style={{ color: SURFACE.muted }}>
                      {mission.completed ? "Concluída hoje" : "Progressão da missão"}
                    </span>
                    <span className="today-progress-value">
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

                <div className="today-action-row">
                  <ActionButton onClick={() => runQuickAction(quickAction)} fullWidth={isMobile}>
                    {tonedMissionLabel}
                  </ActionButton>
                  <ActionButton onClick={() => navigate(recommendation?.route || "/app/user/suggested-training")} variant="secondary">
                    Ver plano do dia
                  </ActionButton>
                </div>

                <div className="today-footnote" style={{ color: SURFACE.muted }}>
                  Preview de impacto: se você agir hoje, a projeção tende a levar seu score para{" "}
                  <strong style={{ color: SURFACE.text }}>{forecast?.tomorrowWithActivity ?? "—"}</strong> amanhã.
                </div>
              </motion.div>

              <div className="today-stats-column">
                <CompactStat label="Constância" value={`🔥 ${streak}`} helper="dias seguidos em construção" accent={streak >= 3} />
                <CompactStat label="Nível" value={`⭐ ${level}`} helper={`${xp} XP acumulado`} />
                <CompactStat
                  label="Forecast"
                  value={forecast ? `${forecast.tomorrowWithActivity}/${forecast.tomorrowWithoutActivity}` : "—"}
                  helper="com ação / sem ação amanhã"
                  accent={Boolean(forecast && forecast.withActivityDelta > forecast.withoutActivityDelta)}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={sectionRevealVariants}>
        <MetabolicScoreCard
          data={metabolism}
          loading={metabolismLoading}
          error={metabolismError}
          derivedStatus={derivedEnergy}
          forecast={forecast}
        />
      </motion.div>

      <motion.div
        variants={sectionRevealVariants}
        className="today-secondary-grid"
        style={{ gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(280px, 360px)" }}
      >
        <motion.div
          variants={itemRevealVariants}
          whileHover={subtleHoverScale}
          whileTap={subtleTapScale}
          className="today-card today-panel-card"
          style={{ borderColor: SURFACE.border, boxShadow: SURFACE.shadow }}
        >
          <div className="today-card-copy">
            <SectionEyebrow>Smart Insight</SectionEyebrow>
            <div className="today-panel-title">{smartInsight?.title || "Seu momento metabólico de hoje"}</div>
            <div className="today-card-description" style={{ color: SURFACE.muted }}>
              {smartInsight?.message || "Seu painel vai destacar aqui a próxima melhor leitura baseada no seu comportamento."}
            </div>
          </div>

          <div
            className={`today-quick-action-card${quickAction.kind === "suggested_training" ? " today-quick-action-card-highlight" : ""}`}
            style={{
              borderColor: quickAction.kind === "suggested_training" ? "rgba(6,182,212,0.18)" : SURFACE.border,
            }}
          >
            <div className="today-card-copy">
              <SectionEyebrow>Quick Action</SectionEyebrow>
              <div className="today-quick-action-title">{quickAction.label}</div>
              <div className="today-quick-action-helper" style={{ color: SURFACE.muted }}>{quickAction.helper}</div>
            </div>
            <ActionButton onClick={() => runQuickAction(quickAction)}>{quickAction.label}</ActionButton>
          </div>
        </motion.div>

        <motion.div
          variants={itemRevealVariants}
          whileHover={subtleHoverScale}
          whileTap={subtleTapScale}
          className="today-card today-panel-card"
          style={{ borderColor: SURFACE.border, boxShadow: SURFACE.shadow }}
        >
          <div className="today-card-copy">
            <SectionEyebrow>Forecast</SectionEyebrow>
            <div className="today-panel-title">Seu amanhã metabólico</div>
            <div className="today-forecast-copy" style={{ color: SURFACE.muted }}>
              Projeção comportamental baseada em score, tendência, fatores e impacto esperado do treino de hoje.
            </div>
          </div>

          {forecast ? (
            <div className="today-forecast-grid-wrapper">
              <div className="today-forecast-grid">
                <div className="today-forecast-metric today-forecast-metric-positive" style={{ borderColor: SURFACE.borderStrong }}>
                  <div className="today-forecast-label" style={{ color: SURFACE.mutedSoft }}>Com atividade</div>
                  <div className="today-forecast-value-row">
                    <div className="today-forecast-value">{forecast.tomorrowWithActivity}</div>
                    <div className="today-forecast-delta today-forecast-delta-positive" style={{ color: SURFACE.success }}>
                      {forecast.withActivityDelta >= 0 ? "+" : ""}
                      {forecast.withActivityDelta}
                    </div>
                  </div>
                </div>
                <div className="today-forecast-metric" style={{ borderColor: SURFACE.border }}>
                  <div className="today-forecast-label" style={{ color: SURFACE.mutedSoft }}>Sem atividade</div>
                  <div className="today-forecast-value-row">
                    <div className="today-forecast-value">{forecast.tomorrowWithoutActivity}</div>
                    <div className="today-forecast-delta" style={{ color: forecast.withoutActivityDelta < 0 ? SURFACE.warning : SURFACE.info }}>
                      {forecast.withoutActivityDelta >= 0 ? "+" : ""}
                      {forecast.withoutActivityDelta}
                    </div>
                  </div>
                </div>
              </div>
              <div className="today-footnote" style={{ color: SURFACE.muted }}>
                Leitura interpretativa: agir hoje tende a deixar amanhã em um estado mais responsivo do que manter inatividade.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: SURFACE.muted }}>Forecast indisponível até o score ser carregado.</div>
          )}
        </motion.div>
      </motion.div>

      <motion.div variants={sectionRevealVariants}>
        <MetabolicChart data={metabolismHistory} loading={historyLoading} forecast={forecast} markers={markers} />
      </motion.div>

      <motion.div variants={sectionRevealVariants}>
        <MetabolicInsights recommendations={metabolism?.recommendations ?? []} loading={metabolismLoading} />
      </motion.div>

      <motion.div variants={sectionRevealVariants} ref={checkinSectionRef}>
        <div
          className="today-card today-checkin-card"
          style={{ borderColor: SURFACE.border, boxShadow: SURFACE.shadow, padding: isMobile ? 18 : 20 }}
        >
          <div className="today-card-copy">
            <SectionEyebrow>Impact Preview</SectionEyebrow>
            <div className="today-card-title">Registre o que você fez hoje</div>
            <div className="today-card-description" style={{ color: SURFACE.muted }}>
              Antes de confirmar, o painel já projeta como esse treino tende a mexer no seu score e na energia de amanhã.
            </div>
          </div>

          <div
            className={`today-impact-preview${scoreImpactPreview ? " today-impact-preview-active" : ""}`}
            style={{ borderColor: scoreImpactPreview ? "rgba(6,182,212,0.22)" : SURFACE.borderStrong }}
          >
            <div className="today-impact-label" style={{ color: SURFACE.mutedSoft }}>
              Preview before action
            </div>
            <div className="today-impact-title">
              {quickGroups.length
                ? `Se você confirmar esse treino agora: +${estimateCheckinImpact(quickGroups.length, streak)} no score estimado.`
                : `Um treino curto hoje tende a gerar +${defaultImpact} no score estimado e melhorar seu forecast de amanhã.`}
            </div>
            <div className="today-footnote" style={{ color: SURFACE.muted }}>
              A projeção muda conforme grupos selecionados, streak atual e tendência metabólica.
            </div>
          </div>

          <div className="today-group-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))" }}>
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
                  <span className="today-group-icon">{GROUP_ICON[group]}</span>
                  <span className="today-group-copy">
                    <span className="today-group-label" style={{ fontWeight: active ? 700 : 500 }}>{GROUP_LABEL[group]}</span>
                    <span className="today-group-helper" style={{ color: SURFACE.mutedSoft }}>{disabled ? "Descansando" : "Disponível"}</span>
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

          <div className="today-action-row">
            <ActionButton onClick={handleQuickCheckin} fullWidth={isMobile}>
              Confirmar treino de hoje
            </ActionButton>
            <ActionButton onClick={() => navigate(recommendation?.route || "/app/user/treinos/em-casa")} variant="secondary">
              Abrir treino base
            </ActionButton>
          </div>
        </div>
      </motion.div>

      <motion.div variants={sectionRevealVariants}>
        <div
          className="today-card today-recommended-card"
          style={{ borderColor: SURFACE.border, boxShadow: SURFACE.shadow, padding: isMobile ? 18 : 20 }}
        >
          <div className="today-card-copy">
            <SectionEyebrow>Recommended Action</SectionEyebrow>
            <div className="today-card-title">{recommendation?.title || "Treino recomendado de hoje"}</div>
            <div className="today-card-description" style={{ color: SURFACE.muted }}>
              {recommendation?.subtitle || "Use essa trilha como ação principal para transformar energia em consistência e retorno amanhã."}
            </div>
          </div>

          {lastWorkout ? (
            <div className="today-last-workout" style={{ borderColor: SURFACE.border, color: SURFACE.muted }}>
              Último treino: <span style={{ color: SURFACE.text, fontWeight: 700 }}>{lastWorkout.title}</span>
            </div>
          ) : null}

          <div className="today-action-row">
            <ActionButton onClick={() => navigate(recommendation?.route || "/app/user/suggested-training")}>
              Iniciar treino recomendado
            </ActionButton>
            {!isFreePlan && (
              <>
                <ActionButton onClick={() => navigate("/app/user/onboarding")} variant="secondary">
                  Ajustar rotina
                </ActionButton>
                <ActionButton onClick={() => navigate("/app/user/activities")} variant="ghost">
                  Registrar atividade
                </ActionButton>
              </>
            )}
          </div>

          {!isFreePlan && recommendation?.tags?.length ? (
            <div className="today-tag-row">
              {recommendation.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="today-tag" style={{ borderColor: SURFACE.border, color: SURFACE.muted }}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
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
