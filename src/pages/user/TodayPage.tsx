import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
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
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        padding: 18,
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
  const isMobile = useIsMobile(720);
  const userId = (id ?? "").trim().toLowerCase();

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

  const suggestedWorkoutId = recommendation?.route === "/app/user/treinos" ? "chest" : "home-10min";
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
    <div style={{ display: "grid", gap: 14, color: COLORS.text }}>
      <Card
        style={{
          background: COLORS.panelDeep,
          borderColor: COLORS.borderStrong,
          borderRadius: 24,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  background: COLORS.highlightSoft,
                  color: "#7CFF6B",
                  padding: "8px 12px",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                Hoje
              </div>
              <div style={{ fontSize: 32, fontWeight: 1000, lineHeight: 1.1 }}>
                {user?.name ? `Olá, ${user.name.split(" ")[0]}.` : "Olá."} Seu próximo passo já está pronto.
              </div>
              <div style={{ color: COLORS.muted, fontSize: 15, lineHeight: 1.6 }}>
                {recommendation?.subtitle ||
                  "Sua home diária agora prioriza ação: iniciar treino, acompanhar ritmo e retomar o que ficou pendente com menos atrito."}
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
                  padding: "8px 12px",
                  color: COLORS.mutedSoft,
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: "capitalize",
                }}
              >
                📅 {weekdayLabel}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                minWidth: 180,
                borderRadius: 18,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.04)",
                padding: 16,
              }}
            >
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>Constância</div>
              <div style={{ fontSize: 30, fontWeight: 1000 }}>🔥 {streak}</div>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>dias seguidos registrando treino</div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                minWidth: 180,
                borderRadius: 18,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.04)",
                padding: 16,
              }}
            >
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>Nível</div>
              <div style={{ fontSize: 30, fontWeight: 1000 }}>⭐ {level}</div>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>{xp} XP acumulados</div>
            </div>
          </div>

          {recommendationTags.length ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {recommendationTags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.primarySoft,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate(`/app/user/treinos/player/${suggestedWorkoutId}`)}
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                color: "#082014",
                cursor: "pointer",
                fontWeight: 1000,
                boxShadow: "0 14px 28px rgba(29,185,84,.22)",
              }}
            >
              ▶️ Iniciar treino agora
            </button>

            <button
              type="button"
              onClick={() => navigate("/app/user/onboarding")}
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.03)",
                color: COLORS.text,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Ajustar rotina inicial
            </button>

            <button
              type="button"
              onClick={() => navigate("/app/user/activities")}
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.03)",
                color: COLORS.text,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Registrar atividade
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 14 }}>
            <div
              style={{
                borderRadius: 18,
                border: `1px solid ${todayCheckedIn ? COLORS.borderStrong : COLORS.border}`,
                background: todayCheckedIn ? COLORS.primarySoft : "rgba(255,255,255,.04)",
                padding: 16,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>Check-in do dia</div>
              <div style={{ fontWeight: 1000, fontSize: 22 }}>{todayCheckedIn ? "✅ Dia garantido" : "⏳ Falta marcar o dia"}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                {todayCheckedIn
                  ? "Você já treinou ou registrou atividade hoje. Sua sequência está protegida."
                  : "Conclua um treino, registre atividade ou use o check-in rápido para contar o dia."}
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                border: `1px solid ${mission.completed ? COLORS.borderStrong : COLORS.border}`,
                background: mission.completed ? COLORS.primarySoft : "rgba(255,255,255,.04)",
                padding: 16,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>Missão do dia</div>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>{mission.title}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{mission.description}</div>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>
                Progresso: {mission.progress}/{mission.target} • Recompensa: +{mission.rewardXp} XP
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(255,255,255,.08)",
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
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.1fr) minmax(280px, .9fr)", gap: 14 }}>
        <Card>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>Treino sugerido para hoje</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                {recommendation?.title ||
                  "Uma sugestão simples para manter consistência e reduzir o esforço de decidir o que fazer agora."}
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.03)",
                padding: 16,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 1000, fontSize: 17 }}>{recommendation?.title || "Treino base do dia"}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                {recommendation?.subtitle ||
                  "Comece com um treino curto e mantenha o hábito. Depois a recomendação pode ficar mais precisa com mais dados de uso."}
              </div>

              {muscleGroupLabel ? (
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,.03)",
                    padding: "12px 14px",
                    color: COLORS.muted,
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  Ontem você treinou <b style={{ color: COLORS.text }}>{muscleGroupLabel}</b>. Hoje vale variar o grupo muscular para recuperar melhor.
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/user/treinos/player/${suggestedWorkoutId}`)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.borderStrong}`,
                    background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                    color: "#082014",
                    cursor: "pointer",
                    fontWeight: 1000,
                  }}
                >
                  Começar agora
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/app/user/treinos")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: "transparent",
                    color: COLORS.text,
                    cursor: "pointer",
                    fontWeight: 900,
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
                  paddingTop: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 1000 }}>Retomar do último treino</div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  Seu último registro foi <b style={{ color: COLORS.text }}>{lastWorkout.title}</b>.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/user/treinos/player/${lastWorkout.workoutId}`)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: `1px solid ${COLORS.border}`,
                      background: "rgba(255,255,255,.03)",
                      color: COLORS.text,
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Repetir último treino
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <div style={{ display: "grid", gap: 14 }}>
          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 1000, fontSize: 16 }}>Check-in rápido do treino</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                Marque rapidamente quais grupos você treinou hoje. Exemplo: peito e bíceps. Isso pontua o dia e impede repetir os mesmos grupos apenas amanhã.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
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
                          padding: "14px 14px",
                          borderRadius: 18,
                          border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
                          background: active ? COLORS.primarySoft : disabled ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.03)",
                          color: COLORS.text,
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.45 : 1,
                          fontWeight: 900,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{groupIconMap[group]}</span>
                        <span style={{ display: "grid", gap: 2 }}>
                          <span>{groupLabelMap[group]}</span>
                          <span style={{ fontSize: 11, color: COLORS.mutedSoft, fontWeight: 700 }}>
                            {disabled ? "Indisponível hoje" : yesterdayMuscleGroups.includes(group) ? "Liberado hoje" : "Disponível hoje"}
                          </span>
                        </span>
                      </button>
                    );
                  })()
                ))}
              </div>
              {quickMessage ? <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{quickMessage}</div> : null}
              <button
                type="button"
                onClick={handleQuickCheckin}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                  color: "#082014",
                  cursor: "pointer",
                  fontWeight: 1000,
                  width: "fit-content",
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
