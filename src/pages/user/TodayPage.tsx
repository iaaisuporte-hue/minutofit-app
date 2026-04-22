import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import { getDailyMission, getLevel, getStreak, getXp, hasTodayCheckin, registerDailyCheckin } from "./gamification";
import { loadRecommendation } from "./onboarding/onboardingStorage";
import {
  itemRevealVariants,
  pageStaggerVariants,
  sectionRevealVariants,
  subtleHoverScale,
  subtleTapScale,
  useTodayMotionSafe,
} from "./todayPageMotion";
import { addWorkoutHistoryEntry, getCurrentWeekdayLabel, getLastWorkoutEntry, getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";
import { MetabolicChart, MetabolicInsights, MetabolicScoreCard, useMetabolism, useMetabolismHistory } from "../../features/metabolism";
import "./todayPage.css";

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const baseStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
    padding: 20,
    ...style,
  };
  return <div style={baseStyle}>{children}</div>;
}


export default function TodayPage() {
  const navigate = useNavigate();
  const { id, user } = useAuth();
  const { planName } = useFeatureFlags();
  const isMobile = useIsMobile(720);
  const userId = (id ?? "").trim().toLowerCase();
  const isFreePlan = (planName || "").toLowerCase() === "free";

  const streak = useMemo(() => getStreak(), []);
  const lastWorkout = useMemo(() => getLastWorkoutEntry(), []);
  const yesterdayMuscleGroups = useMemo(() => getYesterdayMuscleGroups(), []);
  const recommendation = useMemo(() => (userId ? loadRecommendation(userId) : null), [userId]);
  const weekdayLabel = useMemo(() => getCurrentWeekdayLabel(), []);
  const todayCheckedIn = useMemo(() => hasTodayCheckin(), []);
  const xp = useMemo(() => getXp(), []);
  const level = useMemo(() => getLevel(), []);
  const mission = useMemo(() => getDailyMission(), []);
  const [quickGroups, setQuickGroups] = useState<MuscleGroup[]>([]);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);

  const { data: metabolism, loading: metabolismLoading, error: metabolismError } = useMetabolism();
  const { data: metabolismHistory, loading: historyLoading } = useMetabolismHistory();

  const recommendationTags = recommendation?.tags?.slice(0, 3) || [];
  const groupLabelMap: Record<MuscleGroup, string> = {
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
  const groupIconMap: Record<MuscleGroup, string> = {
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
  const alwaysAvailableGroups: MuscleGroup[] = ["cardio", "mobility"];
  const muscleGroupLabel = lastWorkout?.muscleGroups?.map((group) => groupLabelMap[group]).join(", ") || null;

  const missionProgress = mission.target > 0 ? Math.min(1, mission.progress / mission.target) : 0;

  const { shouldReduceMotion, shouldUseTilt } = useTodayMotionSafe({ isMobile });
  void shouldUseTilt;

  function toggleQuickGroup(group: MuscleGroup) {
    if (yesterdayMuscleGroups.includes(group) && !alwaysAvailableGroups.includes(group)) return;
    setQuickGroups((current) => (current.includes(group) ? current.filter((item) => item !== group) : [...current, group]));
  }

  async function handleQuickCheckin() {
    if (!quickGroups.length) {
      setQuickMessage("Selecione pelo menos um grupo muscular para marcar o treino de hoje.");
      return;
    }

    const blocked = quickGroups.filter((group) => yesterdayMuscleGroups.includes(group));
    if (blocked.length) {
      setQuickMessage(
        `Esses grupos foram treinados ontem: ${blocked.map((group) => groupLabelMap[group]).join(", ")}. A regra de não repetir vale apenas em dias seguidos.`
      );
      return;
    }

    addWorkoutHistoryEntry({
      workoutId: `quick-checkin-${Date.now()}`,
      title: `Check-in rápido • ${quickGroups.map((group) => groupLabelMap[group]).join(", ")}`,
      muscleGroups: quickGroups,
      date: new Date().toISOString(),
    });

    const result = registerDailyCheckin("workout", 20);
    setQuickMessage(
      result.alreadyCheckedIn
        ? "Treino do dia marcado. O check-in de hoje já estava garantido."
        : "Treino do dia marcado. +20 XP e sequência atualizada."
    );
    try {
      await persistGamificationCheckin({
        source: "workout",
        xp: 20,
        workout: {
          workoutId: `quick-checkin-${Date.now()}`,
          title: `Check-in rápido • ${quickGroups.map((group) => groupLabelMap[group]).join(", ")}`,
          muscleGroups: quickGroups,
        },
      });
    } catch (error) {
      console.error("Failed to persist quick workout check-in:", error);
    }
    setQuickGroups([]);
    window.location.reload();
  }

  return (
    <motion.div
      style={{ display: "grid", gap: 16, color: "#1F2937", minWidth: 0, width: "100%" }}
      variants={pageStaggerVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
    >
      {/* ─── Header greeting ─────────────────────────────────── */}
      <motion.div variants={sectionRevealVariants}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="badge badge-accent">📅 {weekdayLabel}</span>
          {todayCheckedIn && <span className="badge badge-success">✓ Dia garantido</span>}
        </div>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "#1F2937", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {user?.name ? `Olá, ${user.name.split(" ")[0]}.` : "Olá."}{" "}
          <span style={{ color: "#6B7280", fontWeight: 400 }}>Hora de pontuar o dia.</span>
        </h1>
        <p style={{ color: "#6B7280", fontSize: 14, margin: "8px 0 0", lineHeight: 1.5, maxWidth: 560 }}>
          {recommendation?.subtitle || "Menos decisão, mais execução: inicie o treino e mantenha sua sequência."}
        </p>
      </motion.div>

      {/* ─── MetaCore Score (backend-driven) ────────────────── */}
      <motion.div variants={sectionRevealVariants}>
        <MetabolicScoreCard data={metabolism} loading={metabolismLoading} error={metabolismError} />
      </motion.div>
      <motion.div variants={sectionRevealVariants}>
        <MetabolicChart data={metabolismHistory} loading={historyLoading} />
      </motion.div>
      <motion.div variants={sectionRevealVariants}>
        <MetabolicInsights recommendations={metabolism?.recommendations ?? []} loading={metabolismLoading} />
      </motion.div>

      {/* ─── Stats row ───────────────────────────────────────── */}
      <motion.div variants={sectionRevealVariants} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {[
          {
            label: "Constância",
            value: `🔥 ${streak}`,
            sub: "dias seguidos",
            accent: streak >= 3,
            accentColor: "var(--color-primary)",
          },
          {
            label: "Nível",
            value: `⭐ ${level}`,
            sub: `${xp} XP`,
            accent: false,
            accentColor: "var(--color-accent)",
          },
          {
            label: "Check-in",
            value: todayCheckedIn ? "✓ Feito" : "⏳ Pendente",
            sub: todayCheckedIn ? "Sequência protegida" : "Marque após o treino",
            accent: todayCheckedIn,
            accentColor: "var(--color-primary)",
          },
        ].map((stat) => (
          <motion.div key={stat.label} variants={itemRevealVariants} whileHover={subtleHoverScale} whileTap={subtleTapScale}>
            <div style={{
              background: stat.accent ? "rgba(34,197,94,0.05)" : "#FFFFFF",
              border: `1px solid ${stat.accent ? "rgba(34,197,94,0.22)" : "#E5E7EB"}`,
              borderRadius: 14,
              padding: "14px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              height: "100%",
            }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.accent ? stat.accentColor : "#1F2937", lineHeight: 1 }}>{stat.value}</div>
              <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 5 }}>{stat.sub}</div>
            </div>
          </motion.div>
        ))}

        <motion.div variants={itemRevealVariants} whileHover={subtleHoverScale} whileTap={subtleTapScale}>
          <div style={{
            background: mission.completed ? "rgba(34,197,94,0.05)" : "#FFFFFF",
            border: `1px solid ${mission.completed ? "rgba(34,197,94,0.22)" : "#E5E7EB"}`,
            borderRadius: 14,
            padding: "14px 16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Missão</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1F2937", lineHeight: 1.3, marginBottom: 8 }}>{mission.title}</div>
            <div style={{ height: 4, borderRadius: 999, background: "#F3F4F6", overflow: "hidden" }}>
              <motion.div
                initial={shouldReduceMotion ? false : { scaleX: 0 }}
                animate={{ scaleX: missionProgress }}
                transition={{ duration: 0.65, ease: "easeOut", delay: 0.1 }}
                style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #22C55E, #06B6D4)", transformOrigin: "left center" }}
              />
            </div>
            <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 5 }}>
              {mission.progress}/{mission.target} · +{mission.rewardXp} XP
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ─── Main CTA card ───────────────────────────────────── */}
      <motion.div variants={sectionRevealVariants}>
        <Card style={{ padding: 24 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1F2937", margin: 0, letterSpacing: "-0.01em" }}>
                Treino de hoje
              </h2>
              <p style={{ color: "#6B7280", fontSize: 14, margin: "6px 0 0", lineHeight: 1.5 }}>
                {recommendation?.title || "Treino base do dia"}
              </p>
            </div>

            {muscleGroupLabel && (
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
                Ontem: <span style={{ color: "#1F2937", fontWeight: 600 }}>{muscleGroupLabel}</span>. Vale variar hoje.
              </div>
            )}

            {recommendationTags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {recommendationTags.map((tag) => (
                  <span key={tag} style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid #E5E7EB",
                    background: "#F9FAFB",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#6B7280",
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <motion.button
                type="button"
                onClick={() => navigate("/app/user/treinos/em-casa")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-gradient"
                style={{ padding: "12px 22px", fontSize: 15 }}
              >
                ▶ Iniciar treino agora
              </motion.button>

              {!isFreePlan && (
                <>
                  <motion.button
                    type="button"
                    onClick={() => navigate("/app/user/onboarding")}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    style={{
                      padding: "11px 16px",
                      borderRadius: 12,
                      border: "1px solid #E5E7EB",
                      background: "#FFFFFF",
                      color: "#6B7280",
                      cursor: "pointer",
                      fontWeight: 500,
                      fontSize: 14,
                      transition: "border-color 0.15s ease, background 0.15s ease",
                    }}
                  >
                    Ajustar rotina
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => navigate("/app/user/activities")}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="btn btn-accent-outline"
                    style={{ padding: "11px 16px", fontSize: 14 }}
                  >
                    Registrar atividade
                  </motion.button>
                </>
              )}
            </div>

            {lastWorkout && (
              <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14 }}>
                <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 10px" }}>
                  Último treino: <span style={{ color: "#1F2937", fontWeight: 600 }}>{lastWorkout.title}</span>
                </p>
                <motion.button
                  type="button"
                  onClick={() => navigate(`/app/user/treinos/player/${lastWorkout.workoutId}`)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    color: "#6B7280",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: 13,
                    transition: "border-color 0.15s ease",
                  }}
                >
                  Repetir último treino
                </motion.button>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* ─── Two-column section ──────────────────────────────── */}
      <motion.div
        variants={sectionRevealVariants}
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : isFreePlan ? "1fr" : "minmax(0, 1.1fr) minmax(0, 0.9fr)",
          gap: 14,
          minWidth: 0,
        }}
      >
        {/* Suggested training (non-free) */}
        {!isFreePlan && (
          <motion.div variants={itemRevealVariants} whileInView="show" initial={shouldReduceMotion ? false : "hidden"} viewport={{ once: true, amount: 0.2 }}>
            <Card>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1F2937", margin: 0 }}>Treino sugerido para hoje</h3>
                  <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0", lineHeight: 1.5 }}>
                    {recommendation?.subtitle || "Uma sugestão para manter consistência e reduzir o esforço de decidir."}
                  </p>
                </div>
                <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>{recommendation?.title || "Treino base do dia"}</div>
                  <div style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5 }}>
                    {recommendation?.subtitle || "Comece com um treino curto e mantenha o hábito."}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <motion.button
                      type="button"
                      onClick={() => navigate("/app/user/treinos/em-casa")}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: "#22C55E", color: "#FFFFFF", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "background 0.15s ease" }}
                    >
                      Começar agora
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => navigate("/app/user/treinos")}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#FFFFFF", color: "#6B7280", cursor: "pointer", fontWeight: 500, fontSize: 13, transition: "border-color 0.15s ease" }}
                    >
                      Ver catálogo
                    </motion.button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Check-in + free plan focus */}
        <motion.div variants={itemRevealVariants} style={{ display: "grid", gap: 14, minWidth: 0 }}>
          {isFreePlan && (
            <Card style={{ background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.2)" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>Foco do dia</div>
                <div style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5 }}>
                  No plano Free, priorize constância: marque seu treino diário no check-in rápido e mantenha sua sequência.
                </div>
              </div>
            </Card>
          )}

          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", margin: 0 }}>Check-in rápido</h3>
                <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0", lineHeight: 1.5 }}>
                  Marque os grupos musculares treinados hoje.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {(["chest", "back", "legs", "shoulders", "arms", "core", "cardio", "mobility"] as MuscleGroup[]).map((group) => {
                  const disabled = yesterdayMuscleGroups.includes(group) && !alwaysAvailableGroups.includes(group);
                  const active = quickGroups.includes(group);
                  return (
                    <motion.button
                      key={group}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleQuickGroup(group)}
                      whileHover={disabled ? undefined : { scale: 1.02 }}
                      whileTap={disabled ? undefined : { scale: 0.98 }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${active ? "rgba(34,197,94,0.4)" : "#E5E7EB"}`,
                        background: active ? "rgba(34,197,94,0.06)" : disabled ? "#FAFAFA" : "#FFFFFF",
                        color: disabled ? "#9CA3AF" : "#1F2937",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.5 : 1,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        textAlign: "left",
                        transition: "border-color 0.15s ease, background 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{groupIconMap[group]}</span>
                      <span style={{ display: "grid", gap: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{groupLabelMap[group]}</span>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                          {disabled ? "Descansando" : "Disponível"}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {quickMessage && (
                <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", color: "#6B7280", fontSize: 13, lineHeight: 1.5 }}>
                  {quickMessage}
                </div>
              )}

              <motion.button
                type="button"
                onClick={handleQuickCheckin}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: "11px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "#22C55E",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  width: isMobile ? "100%" : "fit-content",
                  transition: "background 0.15s ease, transform 0.15s ease",
                }}
              >
                Marcar treino de hoje
              </motion.button>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
