import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addWorkoutHistoryEntry, wasMuscleGroupTrainedYesterday, type MuscleGroup } from "./workoutHistory";
import { getStreak, registerDailyCheckin } from "./gamification";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import { homeWorkoutCatalog, type HomeWorkoutAccessibility } from "./homeWorkoutCatalog";

type Step = {
  id: string;
  title: string;
  videoId: string; // YouTube ID
  durationMin: number; // fallback (caso duração real não carregue)
};

type Workout = {
  title: string;
  muscleGroup: MuscleGroup;
  steps: Step[];
  nextSuggestionId?: string;
  alwaysAvailable?: boolean;
  accessibility?: HomeWorkoutAccessibility;
};

const MOCK_WORKOUTS: Record<string, Workout> = {
  "home-10min": {
    title: "Treino em Casa • 10 minutos",
    muscleGroup: "full_body",
    nextSuggestionId: "home-20min",
    steps: [
      { id: "s1", title: "Aquecimento", videoId: "ml6cT4AZdqI", durationMin: 2 },
      { id: "s2", title: "Agachamentos", videoId: "aclHkVaku9U", durationMin: 4 },
      { id: "s3", title: "Prancha", videoId: "pSHjTRCQxIw", durationMin: 4 },
    ],
  },
  "home-20min": {
    title: "HIIT • 20 minutos",
    muscleGroup: "cardio",
    nextSuggestionId: "home-30min-peso",
    steps: [
      { id: "s1", title: "Aquecimento", videoId: "ml6cT4AZdqI", durationMin: 4 },
      { id: "s2", title: "Circuito", videoId: "aclHkVaku9U", durationMin: 10 },
      { id: "s3", title: "Core", videoId: "pSHjTRCQxIw", durationMin: 6 },
    ],
  },
  "home-30min-peso": {
    title: "Full Body com Peso • 30 minutos",
    muscleGroup: "full_body",
    steps: [
      { id: "s1", title: "Aquecimento", videoId: "ml6cT4AZdqI", durationMin: 5 },
      { id: "s2", title: "Força", videoId: "aclHkVaku9U", durationMin: 15 },
      { id: "s3", title: "Finalização", videoId: "pSHjTRCQxIw", durationMin: 10 },
    ],
  },
};

function getYoutubeEmbedUrl(videoId: string) {
  const params = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function getYoutubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export default function WorkoutPlayerPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();

  const workout = useMemo(() => {
    if (!workoutId) return null;
    const predefined = MOCK_WORKOUTS[workoutId];
    if (predefined) return predefined;

    const short = homeWorkoutCatalog.find((item) => item.id === workoutId);
    if (!short) return null;

    return {
      title: short.title,
      muscleGroup: short.muscleGroups[0] || "full_body",
      alwaysAvailable: short.alwaysAvailable,
      accessibility: short.accessibility,
      steps: [
        {
          id: `${short.id}-step-1`,
          title: short.title,
          videoId: short.videoId,
          durationMin: short.durationMin,
        },
      ],
    } satisfies Workout;
  }, [workoutId]);

  const storageKey = `workout_progress_${workoutId}`;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Restaurar progresso salvo
  useEffect(() => {
    if (!workoutId) return;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const idx = Number(raw);
      if (!isNaN(idx)) setCurrentIndex(idx);
    }
  }, [storageKey, workoutId]);

  // Salvar progresso
  useEffect(() => {
    if (!workoutId) return;
    localStorage.setItem(storageKey, String(currentIndex));
  }, [currentIndex, storageKey, workoutId]);

  async function finishWorkout() {
    if (isFinishing || isFinished) return;
    setIsFinishing(true);
    setCountdownActive(false);
    setSecondsLeft(0);
    setIsFinished(true);
    setFinished(true);

    localStorage.removeItem(storageKey);
    if (workoutId && workout) {
      addWorkoutHistoryEntry({
        workoutId,
        title: workout.title,
        muscleGroups: [workout.muscleGroup],
        date: new Date().toISOString(),
      });
    }
    const checkin = registerDailyCheckin("workout", 30);
    setRewardMessage(
      checkin.alreadyCheckedIn ? "Treino registrado. O check-in de hoje já estava valendo." : "Treino registrado. +30 XP."
    );
    if (workoutId && workout) {
      try {
        await persistGamificationCheckin({
          source: "workout",
          xp: 30,
          workout: {
            workoutId,
            title: workout.title,
            muscleGroups: [workout.muscleGroup],
          },
        });
      } catch (error) {
        console.error("Failed to persist workout gamification:", error);
      }
    }

    setIsFinishing(false);
  }

  function goNext() {
    if (!workout) return;
    if (isFinished || isFinishing) return;

    const lastIndex = workout.steps.length - 1;

    if (currentIndex < lastIndex) {
      setCurrentIndex((i) => Math.min(i + 1, lastIndex));
      setCountdownActive(false);
      setIframeLoaded(false);
    } else {
      finishWorkout();
    }
  }

  useEffect(() => {
    if (!workout) return;

    if (!workout.alwaysAvailable && wasMuscleGroupTrainedYesterday(workout.muscleGroup)) {
      const labels: Record<MuscleGroup, string> = {
        chest: "peito",
        back: "costas",
        legs: "pernas",
        shoulders: "ombros",
        arms: "braços",
        core: "core",
        full_body: "corpo inteiro",
        cardio: "cardio",
        mobility: "mobilidade",
      };

      setBlockedMessage(
        `Ontem você já treinou ${labels[workout.muscleGroup]}. Hoje o ideal é variar para outro grupo muscular.`
      );
      return;
    }

    setBlockedMessage(null);
  }, [workout]);

  useEffect(() => {
    if (!workout || blockedMessage || finished) return;
    const step = workout.steps[currentIndex];
    if (!step) return;

    setSecondsLeft(step.durationMin * 60);
    setIframeLoaded(false);
    setCountdownActive(false);
  }, [blockedMessage, currentIndex, finished, workout]);

  useEffect(() => {
    if (!countdownActive || finished || blockedMessage) return;
    if (secondsLeft === null || secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev;
        return Math.max(prev - 1, 0);
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [blockedMessage, countdownActive, finished, secondsLeft]);

  function formatTime(sec: number | null) {
    if (sec === null) return "--:--";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (!workout) {
    return (
      <div>
        <p>Treino não encontrado.</p>
        <Link to="/app/user/treinos">← Voltar para Treinos</Link>
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(255,122,122,.35)",
            background: "rgba(255,122,122,.08)",
            color: "#FFFFFF",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Treino bloqueado hoje</div>
          <div style={{ lineHeight: 1.5 }}>{blockedMessage}</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            to="/app/user/treinos"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #eee",
              background: "#fff",
              textDecoration: "none",
              fontWeight: 900,
              color: "#111",
            }}
          >
            Escolher outro treino
          </Link>

          <Link
            to="/app/user/today"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "transparent",
              textDecoration: "none",
              fontWeight: 900,
              color: "#FFFFFF",
            }}
          >
            Voltar para hoje
          </Link>
        </div>
      </div>
    );
  }

  const steps = workout.steps;
  const lastIndex = steps.length - 1;
  const safeIndex = Math.min(Math.max(currentIndex, 0), lastIndex);
  const current = steps[safeIndex];
  const progressPct = Math.round(((safeIndex + 1) / steps.length) * 100);
  const currentEmbedUrl = getYoutubeEmbedUrl(current.videoId);
  const currentYoutubeUrl = getYoutubeWatchUrl(current.videoId);

  const streak = getStreak() || 1;
  const suggestion = workout.nextSuggestionId;
  const accessibility = workout.accessibility;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {blockedMessage ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(255,122,122,.35)",
            background: "rgba(255,122,122,.08)",
            color: "#FFFFFF",
            fontWeight: 700,
          }}
        >
          {blockedMessage}
        </div>
      ) : null}

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Link to="/app/user/treinos" style={{ textDecoration: "none" }}>
          ← Treinos
        </Link>
        <div style={{ fontWeight: 900 }}>{workout.title}</div>
        <div style={{ fontSize: 12, color: "#666" }}>{progressPct}%</div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 8, background: "#eee", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progressPct}%`,
            background: "#111",
            transition: "width .3s ease",
          }}
        />
      </div>

      {/* Player */}
      <div
        style={{
          position: "relative",
          paddingTop: "56.25%",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #eee",
          background: "#000",
        }}
      >
        <iframe
          key={current.id}
          src={currentEmbedUrl}
          title={`Video do treino: ${current.title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
          onLoad={() => {
            setIframeLoaded(true);
            setCountdownActive(true);
          }}
        />

        {/* Timer overlay */}
        {!finished ? (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(0,0,0,.6)",
              color: "#fff",
              fontWeight: 900,
              fontSize: 14,
              zIndex: 5,
            }}
          >
            ⏱️ {formatTime(secondsLeft)}
          </div>
        ) : null}

        {!finished ? (
          <button
            onClick={goNext}
            aria-label="Avancar para o proximo video do treino"
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.25)",
              background: "rgba(0,0,0,.6)",
              color: "#fff",
              fontWeight: 900,
              fontSize: 14,
              cursor: "pointer",
              zIndex: 6,
            }}
            title="Avançar para o próximo vídeo"
          >
            ⏭️ Avançar
          </button>
        ) : null}

        {!iframeLoaded ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 900,
              background: "rgba(0,0,0,.35)",
              zIndex: 4,
            }}
          >
            Carregando vídeo…
          </div>
        ) : null}

        {/* ✅ Overlay de finalização */}
        {finished ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 16,
              background: "rgba(0,0,0,.72)",
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: "min(640px, 100%)",
                background: "#fff",
                borderRadius: 16,
                padding: 16,
                border: "1px solid #eee",
              }}
            >
              <h2 style={{ marginTop: 0 }}>🎉 Parabéns! Treino concluído!</h2>

              <p style={{ fontSize: 16, marginTop: 8, lineHeight: 1.35 }}>
                Você mandou muito bem hoje! 💪 <br />
                <b>Agora posta no Instagram</b>: tira aquela foto/vídeo no espelho e marca a PH Gym 😉
              </p>

              <div style={{ marginTop: 10, fontWeight: 900 }}>🔥 Streak atual: {streak} dia(s) consecutivo(s)</div>
              {rewardMessage ? <div style={{ marginTop: 8, fontWeight: 800, color: "#0F3D2E" }}>{rewardMessage}</div> : null}

              <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "#f6f6f6" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Texto pronto pra postar:</div>
                <div style={{ fontSize: 14, color: "#111", lineHeight: 1.35 }}>
                  “Treino concluído ✅💪 Hoje eu fui! #PHGym #SemDesculpa”
                  <br />
                  Marque: <b>@ph_gym</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                {suggestion ? (
                  <button
                    onClick={() => {
                      if (blockedMessage) return;
                      setIsFinished(false);
                      setIsFinishing(false);
                      setCountdownActive(false);
                      setIframeLoaded(false);
                      setFinished(false);
                      setCurrentIndex(0);
                      navigate(`/app/user/treinos/player/${suggestion}`);
                    }}
                    disabled={Boolean(blockedMessage)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #111",
                      background: "#111",
                      color: "#fff",
                      cursor: blockedMessage ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      opacity: blockedMessage ? 0.55 : 1,
                    }}
                  >
                    ▶️ Próximo sugerido
                  </button>
                ) : null}

                <Link
                  to="/app/user/treinos"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #eee",
                    background: "#fff",
                    textDecoration: "none",
                    fontWeight: 900,
                    color: "#111",
                  }}
                >
                  Voltar para Treinos
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Info da etapa */}
      {!finished ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>
              {safeIndex + 1}/{steps.length} — {current?.title ?? ""}
            </div>
            <div style={{ fontSize: 13, color: "#666" }}>
              Embed direto do YouTube para funcionar melhor no mobile. Se o player do navegador travar, abra no app do YouTube.
            </div>
          </div>

          <a
            href={currentYoutubeUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Abrir ${current.title} no YouTube em nova aba`}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #eee",
              background: "#fff",
              textDecoration: "none",
              fontWeight: 900,
              color: "#111",
              width: "fit-content",
            }}
          >
            Abrir no YouTube
          </a>
        </div>
      ) : null}

      {accessibility ? (
        <section
          aria-label="Recursos de acessibilidade do treino"
          style={{
            border: "1px solid rgba(255,255,255,.16)",
            borderRadius: 14,
            padding: 12,
            background: "rgba(255,255,255,.04)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900, color: "#FFFFFF" }}>Recursos de acessibilidade</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 800,
                border: "1px solid rgba(255,255,255,.22)",
                color: "#FFFFFF",
                background: accessibility.visual ? "rgba(27,153,139,.28)" : "rgba(255,255,255,.08)",
              }}
            >
              Visual: {accessibility.visual ? "suportado" : "parcial"}
            </span>
            <span
              style={{
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 800,
                border: "1px solid rgba(255,255,255,.22)",
                color: "#FFFFFF",
                background: accessibility.auditory ? "rgba(27,153,139,.28)" : "rgba(255,255,255,.08)",
              }}
            >
              Auditiva: {accessibility.auditory ? "suportado" : "parcial"}
            </span>
            <span
              style={{
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 800,
                border: "1px solid rgba(255,255,255,.22)",
                color: "#FFFFFF",
                background: accessibility.motor ? "rgba(27,153,139,.28)" : "rgba(255,255,255,.08)",
              }}
            >
              Motora: {accessibility.motor ? "suportado" : "parcial"}
            </span>
          </div>
          {accessibility.notes.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20, color: "rgba(255,255,255,.92)", lineHeight: 1.4 }}>
              {accessibility.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
