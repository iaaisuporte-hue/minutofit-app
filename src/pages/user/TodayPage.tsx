import React, { useState } from "react";
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
import { useGamificationSummary } from "../../features/gamification/useGamificationSummary";
import "./todayPage.css";

const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: "Peito", back: "Costas", legs: "Pernas", shoulders: "Ombros",
  arms: "Braços", core: "Core", full_body: "Corpo inteiro", cardio: "Cardio", mobility: "Mobilidade",
};
const GROUP_ICON: Record<MuscleGroup, string> = {
  chest: "🫀", back: "🧱", legs: "🦵", shoulders: "🏋️",
  arms: "💪", core: "⭕", full_body: "⚡", cardio: "🏃", mobility: "🧘",
};
const ALWAYS_AVAILABLE: MuscleGroup[] = ["cardio", "mobility"];
const ALL_GROUPS: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core", "cardio", "mobility"];

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

  const { shouldReduceMotion } = useTodayMotionSafe({ isMobile });

  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date());
  const weekdayCapitalized = weekdayLabel.charAt(0).toUpperCase() + weekdayLabel.slice(1);

  const missionProgress = mission.target > 0 ? Math.min(1, mission.progress / mission.target) : 0;

  function toggleQuickGroup(group: MuscleGroup) {
    if (yesterdayMuscleGroups.includes(group) && !ALWAYS_AVAILABLE.includes(group)) return;
    setQuickGroups((prev) => prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]);
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
    setCheckinMessage(`Score em recálculo... +${impact} pontos potenciais`);

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
      setCheckinMessage("Treino registrado. Score sendo atualizado.");
      setQuickGroups([]);
      refetchGamification();
      refetchMetabolism();
    } catch {
      setCheckinMessage("Erro ao registrar. Tente novamente.");
    } finally {
      setTimeout(() => { setScoreImpactPreview(null); setCheckinMessage(null); }, 4000);
    }
  }

  return (
    <motion.div
      style={{ display: "grid", gap: 16, color: "#1F2937", minWidth: 0, width: "100%" }}
      variants={pageStaggerVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
    >
      {/* ─── Header ──────────────────────────────────────────── */}
      <motion.div variants={sectionRevealVariants}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="badge badge-accent">📅 {weekdayCapitalized}</span>
          {todayCheckedIn && <span className="badge badge-success">✓ Dia garantido</span>}
        </div>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "#1F2937", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {user?.name ? `Olá, ${user.name.split(" ")[0]}.` : "Olá."}{" "}
          <span style={{ color: "#6B7280", fontWeight: 400 }}>Seu metabolismo hoje.</span>
        </h1>
        <p style={{ color: "#6B7280", fontSize: 14, margin: "8px 0 0", lineHeight: 1.5, maxWidth: 560 }}>
          Cada treino e check-in alimenta o seu MetaCore Score — o índice do seu metabolismo em atividade.
        </p>
      </motion.div>

      {/* ─── HERO: MetaCore Score + fatores ──────────────────── */}
      <motion.div variants={sectionRevealVariants}>
        <MetabolicScoreCard data={metabolism} loading={metabolismLoading} error={metabolismError} />
      </motion.div>

      {/* ─── Histórico 14 dias ───────────────────────────────── */}
      <motion.div variants={sectionRevealVariants}>
        <MetabolicChart data={metabolismHistory} loading={historyLoading} />
      </motion.div>

      {/* ─── Como subir o score (recomendações com CTA) ──────── */}
      <motion.div variants={sectionRevealVariants}>
        <MetabolicInsights recommendations={metabolism?.recommendations ?? []} loading={metabolismLoading} />
      </motion.div>

      {/* ─── Check-in rápido ─────────────────────────────────── */}
      <motion.div variants={sectionRevealVariants}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", margin: 0 }}>Registre o que fez hoje</h3>
            <p style={{ color: "#6B7280", fontSize: 13, margin: "4px 0 0", lineHeight: 1.5 }}>
              Marcar treino atualiza seu score metabólico.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
            {ALL_GROUPS.map((group) => {
              const disabled = yesterdayMuscleGroups.includes(group) && !ALWAYS_AVAILABLE.includes(group);
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
                    padding: "10px 12px", borderRadius: 10,
                    border: `1px solid ${active ? "rgba(34,197,94,0.4)" : "#E5E7EB"}`,
                    background: active ? "rgba(34,197,94,0.06)" : disabled ? "#FAFAFA" : "#FFFFFF",
                    color: disabled ? "#9CA3AF" : "#1F2937",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    fontWeight: 500,
                    display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                    transition: "border-color 0.15s ease, background 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{GROUP_ICON[group]}</span>
                  <span style={{ display: "grid", gap: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{GROUP_LABEL[group]}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{disabled ? "Descansando" : "Disponível"}</span>
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
                style={{
                  marginBottom: 12, padding: "10px 14px", borderRadius: 10,
                  background: scoreImpactPreview ? "rgba(6,182,212,0.06)" : "#F9FAFB",
                  border: `1px solid ${scoreImpactPreview ? "rgba(6,182,212,0.25)" : "#E5E7EB"}`,
                  fontSize: 13, color: scoreImpactPreview ? "#0891b2" : "#6B7280", fontWeight: scoreImpactPreview ? 600 : 400,
                }}
              >
                {checkinMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={handleQuickCheckin}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: "11px 16px", borderRadius: 12, border: "none",
              background: "#22C55E", color: "#FFFFFF", cursor: "pointer",
              fontWeight: 600, fontSize: 14,
              width: isMobile ? "100%" : "fit-content",
            }}
          >
            Marcar treino de hoje
          </motion.button>
        </div>
      </motion.div>

      {/* ─── Stats + Missão ──────────────────────────────────── */}
      <motion.div
        variants={sectionRevealVariants}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}
      >
        {[
          { label: "Constância", value: `🔥 ${streak}`, sub: "dias seguidos", accent: streak >= 3 },
          { label: "Nível", value: `⭐ ${level}`, sub: `${xp} XP`, accent: false },
          { label: "Check-in", value: todayCheckedIn ? "✓ Feito" : "⏳ Pendente", sub: todayCheckedIn ? "Sequência protegida" : "Marque após o treino", accent: todayCheckedIn },
        ].map((stat) => (
          <motion.div key={stat.label} variants={itemRevealVariants} whileHover={subtleHoverScale} whileTap={subtleTapScale}>
            <div style={{
              background: stat.accent ? "rgba(34,197,94,0.05)" : "#FFFFFF",
              border: `1px solid ${stat.accent ? "rgba(34,197,94,0.22)" : "#E5E7EB"}`,
              borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", height: "100%",
            }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.accent ? "var(--color-primary)" : "#1F2937", lineHeight: 1 }}>{stat.value}</div>
              <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 5 }}>{stat.sub}</div>
            </div>
          </motion.div>
        ))}

        {/* Missão */}
        <motion.div variants={itemRevealVariants} whileHover={subtleHoverScale} whileTap={subtleTapScale}>
          <div style={{
            background: mission.completed ? "rgba(34,197,94,0.05)" : "#FFFFFF",
            border: `1px solid ${mission.completed ? "rgba(34,197,94,0.22)" : "#E5E7EB"}`,
            borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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
            <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 5 }}>{mission.progress}/{mission.target} · +{mission.rewardXp} XP</div>
          </div>
        </motion.div>
      </motion.div>

      {/* ─── Treino do dia + CTA ──────────────────────────────── */}
      <motion.div variants={sectionRevealVariants}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)", padding: 24 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1F2937", margin: 0, letterSpacing: "-0.01em" }}>Treino de hoje</h2>
              <p style={{ color: "#6B7280", fontSize: 14, margin: "6px 0 0", lineHeight: 1.5 }}>
                {recommendation?.title || "Treino base do dia"}
              </p>
            </div>

            {lastWorkout && (
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#6B7280" }}>
                Último treino: <span style={{ color: "#1F2937", fontWeight: 600 }}>{lastWorkout.title}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <motion.button
                type="button"
                onClick={() => navigate("/app/user/treinos/em-casa")}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
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
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    style={{ padding: "11px 16px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#FFFFFF", color: "#6B7280", cursor: "pointer", fontWeight: 500, fontSize: 14 }}
                  >
                    Ajustar rotina
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => navigate("/app/user/activities")}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="btn btn-accent-outline"
                    style={{ padding: "11px 16px", fontSize: 14 }}
                  >
                    Registrar atividade
                  </motion.button>
                </>
              )}
            </div>

            {!isFreePlan && recommendation && (
              <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(recommendation.tags ?? []).slice(0, 3).map((tag: string) => (
                    <span key={tag} style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 12, fontWeight: 500, color: "#6B7280" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Loading state dos stats enquanto backend responde */}
      {gamificationLoading && (
        <motion.div variants={sectionRevealVariants} style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center" }}>
          Carregando dados…
        </motion.div>
      )}
    </motion.div>
  );
}
