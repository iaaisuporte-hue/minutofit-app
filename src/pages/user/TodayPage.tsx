import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { loadRecommendation } from "./onboarding/onboardingStorage";
import { addWorkoutHistoryEntry, getCurrentWeekdayLabel, getLastWorkoutEntry, getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";
import { getDailyMission, getLevel, getStreak, getXp, hasTodayCheckin, registerDailyCheckin } from "./gamification";
import { persistGamificationCheckin } from "../../services/gamificationApi";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  mutedSoft: "rgba(232,236,233,.58)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  primarySoft: "rgba(29,185,84,.18)",
  highlightSoft: "rgba(124,255,107,.12)",
};

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
        borderRadius: 18,
        background: COLORS.panel,
        boxShadow: "0 10px 28px rgba(0,0,0,.32)",
        padding: 14,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
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

  const recommendationTags = recommendation?.tags?.slice(0, 3) || [];
  const groupLabelMap: Record<MuscleGroup, string> = {
    chest: "peito",
    back: "costas",
    legs: "pernas",
    shoulders: "ombros",
    arms: "bíceps e braços",
    core: "core",
    full_body: "corpo inteiro",
    cardio: "cardio",
    mobility: "mobilidade",
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

  const isTablet = !isMobile && typeof window !== "undefined" && window.innerWidth <= 1024;
  const heroStatsColumns = isMobile ? "repeat(2, minmax(0, 1fr))" : isTablet ? "1fr 1fr" : "repeat(2, minmax(180px, 1fr))";
  const heroProgressColumns = isMobile ? "1fr" : "1fr 1fr";
  const compactActionBtnStyle: React.CSSProperties = {
    padding: isMobile ? "11px 12px" : "10px 12px",
    borderRadius: 12,
    border: `1px solid ${COLORS.border}`,
    background: "rgba(255,255,255,.02)",
    color: COLORS.text,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    lineHeight: 1.1,
    transition: "transform .16s ease, opacity .16s ease, border-color .16s ease, background .16s ease",
  };

  function toggleQuickGroup(group: MuscleGroup) {
    if (yesterdayMuscleGroups.includes(group) && !alwaysAvailableGroups.includes(group)) {
      return;
    }
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
        : `Treino do dia marcado. +20 XP e sequência atualizada.`
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
    <div style={{ display: "grid", gap: 10, color: COLORS.text, minWidth: 0, width: "100%" }}>
      <Card
        style={{
          background: COLORS.panelDeep,
          borderColor: COLORS.borderStrong,
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                background: COLORS.highlightSoft,
                color: "#7CFF6B",
                padding: "6px 10px",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Hoje
            </div>

            <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 1000, lineHeight: 1.12, letterSpacing: "-0.02em" }}>
              {user?.name ? `Olá, ${user.name.split(" ")[0]}.` : "Olá."} Hora de pontuar o dia.
            </div>

            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45, maxWidth: 620 }}>
              {recommendation?.subtitle ||
                "Menos decisão, mais execução: inicie o treino e mantenha sua sequência."}
            </div>

            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.04)",
                padding: "6px 10px",
                color: COLORS.mutedSoft,
                fontSize: 11,
                fontWeight: 900,
                textTransform: "capitalize",
              }}
            >
              📅 {weekdayLabel}
            </div>
          </div>

          {recommendationTags.length ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {recommendationTags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.primarySoft,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, auto) minmax(0, 1fr)",
              gap: 8,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/app/user/treinos/em-casa")}
              style={{
                padding: isMobile ? "13px 14px" : "12px 16px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                color: "#082014",
                cursor: "pointer",
                fontWeight: 1000,
                boxShadow: "0 10px 20px rgba(29,185,84,.2)",
                width: isMobile ? "100%" : "fit-content",
                fontSize: isMobile ? 15 : 14,
                transition: "transform .18s ease, box-shadow .18s ease, opacity .18s ease",
              }}
            >
              ▶️ Iniciar treino agora
            </button>

            {!isFreePlan ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => navigate("/app/user/onboarding")}
                  style={compactActionBtnStyle}
                >
                  Ajustar rotina inicial
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/app/user/activities")}
                  style={compactActionBtnStyle}
                >
                  Registrar atividade
                </button>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: heroStatsColumns, gap: 8 }}>
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.03)",
                padding: 10,
                display: "grid",
                gap: 4,
                minHeight: 0,
                alignContent: "start",
              }}
            >
              <div style={{ color: COLORS.mutedSoft, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1 }}>Constância</div>
              <div style={{ fontSize: 24, fontWeight: 1000, lineHeight: 1 }}>
                🔥 <span>{streak}</span>
              </div>
              <div style={{ color: COLORS.muted, fontSize: 11 }}>dias seguidos</div>
            </div>

            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.03)",
                padding: 10,
                display: "grid",
                gap: 4,
                minHeight: 0,
                alignContent: "start",
              }}
            >
              <div style={{ color: COLORS.mutedSoft, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1 }}>Nível</div>
              <div style={{ fontSize: 24, fontWeight: 1000, lineHeight: 1 }}>
                ⭐ <span>{level}</span>
              </div>
              <div style={{ color: COLORS.muted, fontSize: 11 }}>{xp} XP</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: heroProgressColumns, gap: 8 }}>
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${todayCheckedIn ? COLORS.borderStrong : COLORS.border}`,
                background: todayCheckedIn ? COLORS.primarySoft : "rgba(255,255,255,.04)",
                padding: 12,
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 22, lineHeight: 1 }}>{todayCheckedIn ? "✅" : "⏳"}</div>
              <div style={{ display: "grid", gap: 3 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1 }}>Check-in do dia</div>
                <div style={{ fontWeight: 1000, fontSize: 17, lineHeight: 1.2 }}>{todayCheckedIn ? "Dia garantido" : "Falta marcar o dia"}</div>
                <div style={{ color: COLORS.muted, fontSize: 11, lineHeight: 1.35 }}>
                  {todayCheckedIn ? "Sequência protegida." : "Marque no check-in rápido após o treino."}
                </div>
              </div>
            </div>

            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${mission.completed ? COLORS.borderStrong : COLORS.border}`,
                background: mission.completed ? COLORS.primarySoft : "rgba(255,255,255,.04)",
                padding: 12,
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 10,
                alignItems: "start",
              }}
            >
              <div style={{ fontSize: 22, lineHeight: 1 }}>🎯</div>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1 }}>Missão do dia</div>
                <div style={{ fontWeight: 1000, fontSize: 16, lineHeight: 1.2 }}>{mission.title}</div>
                <div style={{ color: COLORS.muted, fontSize: 11, lineHeight: 1.35 }}>{mission.description}</div>
                <div style={{ color: COLORS.mutedSoft, fontSize: 11 }}>
                  {mission.progress}/{mission.target} • +{mission.rewardXp} XP
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 999,
                    background: "rgba(255,255,255,.1)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((mission.progress / mission.target) * 100))}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : isFreePlan ? "1fr" : "minmax(0, 1.1fr) minmax(0, 0.9fr)",
          gap: 10,
          minWidth: 0,
        }}
      >
        {!isFreePlan ? (
          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>Treino sugerido para hoje</div>
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4 }}>
                  {recommendation?.title ||
                    "Uma sugestão simples para manter consistência e reduzir o esforço de decidir o que fazer agora."}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,.03)",
                  padding: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 1000, fontSize: 15 }}>{recommendation?.title || "Treino base do dia"}</div>
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4 }}>
                  {recommendation?.subtitle ||
                    "Comece com um treino curto e mantenha o hábito. Depois a recomendação pode ficar mais precisa com mais dados de uso."}
                </div>

                {muscleGroupLabel ? (
                  <div
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${COLORS.border}`,
                      background: "rgba(255,255,255,.03)",
                      padding: "10px 12px",
                      color: COLORS.muted,
                      fontSize: 12,
                      lineHeight: 1.35,
                    }}
                  >
                    Ontem você treinou <b style={{ color: COLORS.text }}>{muscleGroupLabel}</b>. Hoje vale variar o grupo muscular para recuperar melhor.
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => navigate("/app/user/treinos/em-casa")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${COLORS.borderStrong}`,
                      background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                      color: "#082014",
                      cursor: "pointer",
                      fontWeight: 1000,
                      transition: "transform .16s ease, opacity .16s ease",
                    }}
                  >
                    Começar agora
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/app/user/treinos")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${COLORS.border}`,
                      background: "transparent",
                      color: COLORS.text,
                      cursor: "pointer",
                      fontWeight: 900,
                      transition: "transform .16s ease, opacity .16s ease",
                    }}
                  >
                    Ver catálogo de treinos
                  </button>
                </div>
              </div>

              {lastWorkout ? (
                <div
                  style={{
                    borderTop: `1px solid ${COLORS.border}`,
                    paddingTop: 10,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 1000 }}>Retomar do último treino</div>
                  <div style={{ color: COLORS.muted, fontSize: 12 }}>
                    Seu último registro foi <b style={{ color: COLORS.text }}>{lastWorkout.title}</b>.
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/app/user/treinos/player/${lastWorkout.workoutId}`)}
                      style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                        border: `1px solid ${COLORS.border}`,
                        background: "rgba(255,255,255,.03)",
                        color: COLORS.text,
                        cursor: "pointer",
                        fontWeight: 900,
                      transition: "transform .16s ease, opacity .16s ease",
                      }}
                    >
                      Repetir último treino
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          {isFreePlan ? (
            <Card>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>Foco do dia</div>
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4 }}>
                  No plano Free, priorize constância: marque seu treino diário no check-in rápido e mantenha sua sequência.
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 1000, fontSize: 15 }}>Check-in rápido do treino</div>
              <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4 }}>
                Marque rapidamente quais grupos você treinou hoje. Exemplo: peito e bíceps. Isso pontua o dia e impede repetir os mesmos grupos apenas amanhã.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {(["chest", "back", "legs", "shoulders", "arms", "core", "cardio", "mobility"] as MuscleGroup[]).map((group) => (
                  (() => {
                    const disabled = yesterdayMuscleGroups.includes(group) && !alwaysAvailableGroups.includes(group);
                    const active = quickGroups.includes(group);

                    return (
                      <button
                        key={group}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleQuickGroup(group)}
                        style={{
                          padding: "10px 10px",
                          borderRadius: 12,
                          border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
                          background: active ? COLORS.primarySoft : disabled ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.03)",
                          color: COLORS.text,
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.45 : 1,
                          fontWeight: 900,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          textAlign: "left",
                          transition: "transform .16s ease, opacity .16s ease, border-color .16s ease",
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{groupIconMap[group]}</span>
                        <span style={{ display: "grid", gap: 2 }}>
                          <span style={{ fontSize: 12 }}>{groupLabelMap[group]}</span>
                          <span style={{ fontSize: 10, color: COLORS.mutedSoft, fontWeight: 700 }}>
                            {disabled ? "Indisponível hoje" : yesterdayMuscleGroups.includes(group) ? "Liberado hoje" : "Disponível hoje"}
                          </span>
                        </span>
                      </button>
                    );
                  })()
                ))}
              </div>
              {quickMessage ? <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4 }}>{quickMessage}</div> : null}
              <button
                type="button"
                onClick={handleQuickCheckin}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                  color: "#082014",
                  cursor: "pointer",
                  fontWeight: 1000,
                  width: isMobile ? "100%" : "fit-content",
                  transition: "transform .16s ease, opacity .16s ease",
                }}
              >
                Marcar treino de hoje
              </button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
