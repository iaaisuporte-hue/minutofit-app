import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

type Step = {
  id: string;
  title: string;
  videoId: string; // YouTube ID
  durationMin: number; // fallback (caso duração real não carregue)
};

type Workout = {
  title: string;
  steps: Step[];
  nextSuggestionId?: string;
};

const MOCK_WORKOUTS: Record<string, Workout> = {
  "home-10min": {
    title: "Treino em Casa • 10 minutos",
    nextSuggestionId: "home-20min",
    steps: [
      { id: "s1", title: "Aquecimento", videoId: "ml6cT4AZdqI", durationMin: 2 },
      { id: "s2", title: "Agachamentos", videoId: "aclHkVaku9U", durationMin: 4 },
      { id: "s3", title: "Prancha", videoId: "pSHjTRCQxIw", durationMin: 4 },
    ],
  },
  "home-20min": {
    title: "HIIT • 20 minutos",
    nextSuggestionId: "home-30min-peso",
    steps: [
      { id: "s1", title: "Aquecimento", videoId: "ml6cT4AZdqI", durationMin: 4 },
      { id: "s2", title: "Circuito", videoId: "aclHkVaku9U", durationMin: 10 },
      { id: "s3", title: "Core", videoId: "pSHjTRCQxIw", durationMin: 6 },
    ],
  },
  "home-30min-peso": {
    title: "Full Body com Peso • 30 minutos",
    steps: [
      { id: "s1", title: "Aquecimento", videoId: "ml6cT4AZdqI", durationMin: 5 },
      { id: "s2", title: "Força", videoId: "aclHkVaku9U", durationMin: 15 },
      { id: "s3", title: "Finalização", videoId: "pSHjTRCQxIw", durationMin: 10 },
    ],
  },
};

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function addToHistory(workoutId: string) {
  const key = "workout_history_v1";
  const raw = localStorage.getItem(key);
  const list: Array<{ workoutId: string; date: string }> = raw ? JSON.parse(raw) : [];
  list.push({ workoutId, date: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(list));
}

function updateStreak() {
  const key = "workout_streak_v1";
  const lastKey = "workout_streak_lastday_v1";

  const lastDayRaw = localStorage.getItem(lastKey);
  let streak = Number(localStorage.getItem(key) || "0");

  if (!lastDayRaw) {
    streak = 1;
  } else {
    const last = new Date(lastDayRaw);
    const now = new Date();

    const lastDate = new Date(last.toDateString());
    const nowDate = new Date(now.toDateString());
    const diffDays = Math.floor((+nowDate - +lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // já contou hoje
    } else if (diffDays === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
  }

  localStorage.setItem(key, String(streak));
  localStorage.setItem(lastKey, new Date().toISOString());
  return streak;
}

export default function WorkoutPlayerPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();

  const workout = useMemo(() => {
    if (!workoutId) return null;
    return MOCK_WORKOUTS[workoutId] || null;
  }, [workoutId]);

  const storageKey = `workout_progress_${workoutId}`;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [ytReady, setYtReady] = useState(false);

  // ⏱ Timer baseado no tempo REAL do vídeo
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const playerRef = useRef<any>(null);
  const playerHostIdRef = useRef(`yt_player_${Math.random().toString(36).slice(2)}`);

  // Guards contra múltiplos ENDED / reentrância
  const finishingRef = useRef(false);
  const finishedRef = useRef(false);

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

  // Carregar API do YouTube
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      setYtReady(true);
    };
  }, []);

  function stopTick() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  }

  function startTickWithPlayerFallback(fallbackMin: number) {
    stopTick();

    // fallback inicial (se getDuration demorar)
    setSecondsLeft(fallbackMin * 60);

    tickRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getDuration !== "function" || typeof p.getCurrentTime !== "function") return;

      const dur = Number(p.getDuration()); // segundos
      const cur = Number(p.getCurrentTime()); // segundos
      if (!isFinite(dur) || dur <= 0) return;

      const left = Math.max(0, Math.ceil(dur - cur));
      setSecondsLeft(left);
    }, 500);
  }

  function finishWorkout() {
    if (finishingRef.current || finishedRef.current) return;
    finishingRef.current = true;

    stopTick();
    setSecondsLeft(0);

    try {
      if (playerRef.current?.pauseVideo) playerRef.current.pauseVideo();
    } catch {}

    finishedRef.current = true;
    setFinished(true);

    localStorage.removeItem(storageKey);
    if (workoutId) addToHistory(workoutId);
    updateStreak();
  }

  function goNext() {
    if (!workout) return;
    if (finishedRef.current || finishingRef.current) return;

    const lastIndex = workout.steps.length - 1;

    if (currentIndex < lastIndex) {
      setCurrentIndex((i) => Math.min(i + 1, lastIndex));
      // tenta pausar/evitar áudio do vídeo anterior no instante da troca
      try {
        if (playerRef.current?.stopVideo) playerRef.current.stopVideo();
      } catch {}
    } else {
      finishWorkout();
    }
  }

  function handleVideoEnded() {
    goNext();
  }

  // ✅ Fallback: se o timer chegar em 0 e for o último vídeo, finaliza
  useEffect(() => {
    if (!workout) return;
    if (finished) return;
    if (secondsLeft === null) return;

    // quando chegar em 0, avança (ou finaliza)
    if (secondsLeft <= 0) {
      goNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, workout, finished]);

  // Criar / atualizar player quando muda a etapa
  useEffect(() => {
    if (!workout) return;
    if (!ytReady) return;
    if (finished) return;

    const steps = workout.steps;
    const lastIndex = steps.length - 1;
    const safeIndex = Math.min(Math.max(currentIndex, 0), lastIndex);
    const step = steps[safeIndex];

    startTickWithPlayerFallback(step.durationMin);

    // reset do guard de finishing quando muda etapa
    finishingRef.current = false;

    if (playerRef.current) {
      try {
        playerRef.current.loadVideoById(step.videoId);
      } catch {}
      return;
    }

    playerRef.current = new window.YT.Player(playerHostIdRef.current, {
      width: "100%",
      height: "100%",
      videoId: step.videoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        origin: window.location.origin,
        iv_load_policy: 3,
      },
      events: {
        onReady: (event: any) => {
          try {
            event.target.playVideo();
          } catch {}
        },
        onStateChange: (event: any) => {
          // 0 = ENDED
          if (event.data === 0) handleVideoEnded();
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout, currentIndex, ytReady, finished]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      stopTick();
      try {
        if (playerRef.current?.destroy) playerRef.current.destroy();
      } catch {}
      playerRef.current = null;
    };
  }, []);

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

  const steps = workout.steps;
  const lastIndex = steps.length - 1;
  const safeIndex = Math.min(Math.max(currentIndex, 0), lastIndex);
  const current = steps[safeIndex];
  const progressPct = Math.round(((safeIndex + 1) / steps.length) * 100);

  const streak = Number(localStorage.getItem("workout_streak_v1") || "1");
  const suggestion = workout.nextSuggestionId;

  return (
    <div style={{ display: "grid", gap: 12 }}>
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
        <div
          id={playerHostIdRef.current}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
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

        {/* ✅ Botão avançar manual */}
        {!finished ? (
          <button
            onClick={goNext}
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

        {!ytReady ? (
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
                      finishedRef.current = false;
                      finishingRef.current = false;
                      setFinished(false);
                      setCurrentIndex(0);
                      navigate(`/app/user/treinos/player/${suggestion}`);
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #111",
                      background: "#111",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 900,
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900 }}>
              {safeIndex + 1}/{steps.length} — {current?.title ?? ""}
            </div>
            <div style={{ fontSize: 13, color: "#666" }}>Avança automaticamente quando o vídeo termina ▶️</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}