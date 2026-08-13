import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./movementLab.css";
import { authFetch } from "../../services/apiClient";
import { API_URL } from "../../services/apiBase";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { postLabEvent } from "./lib/labEvents";
import {
  EXERCISE_CATALOG,
  EXERCISE_GROUPS,
  avgAngles,
  type ExerciseId,
  type ExerciseCategory,
  type PoseLandmark,
  type Stage,
} from "./lib/exerciseRules";
import {
  computeFormScore,
  computeSymmetry,
  generateInsight,
  rankCorrections,
  scoreToTone,
  type Correction,
} from "./lib/movementAnalytics";
import {
  assessContext,
  assessInactive,
  assessOutOfFrame,
  assessPartialReps,
  handleDeviceMotion,
  isDeviceMoving,
  type ContextAssessment,
} from "./lib/motionContext";

// ── Types ────────────────────────────────────────────────────

type CameraStatus = "idle" | "loading" | "ready" | "error";
type CalibrationState = "idle" | "countdown" | "tracking" | "paused";

type AnalysisState = {
  leftAngle: number | null;
  rightAngle: number | null;
  repCount: number;
  stage: Stage;
  feedback: Correction[];
  confidence: "low" | "medium" | "high";
  formScore: number;
  symmetry: number;
};

type MovementSession = {
  id: string;
  exerciseId: ExerciseId;
  exerciseLabel: string;
  timestamp: number;
  repCount: number;
  avgFormScore: number;
  bestRepScore: number;
  worstRepScore: number;
  avgSymmetry: number;
  insight: string;
};

type SessionSummaryData = MovementSession & {
  repScores: number[];
};

// ── Modo guiado pela ficha (Spec 022) ────────────────────────

type GuidedSet = {
  detectedReps: number;
  repsDone: number;
  formScore: number;
  symmetry: number;
  confidence: "low" | "medium" | "high";
};

type GuidedState = {
  planId: number;
  dayIndex: number;
  exerciseUuid: string; // UUID da biblioteca — vai em workout_set_logs.exercise_id
  name: string;
  targetSets: number;
  targetReps: string; // "10" ou "8-12"
  restS: number;
  completed: GuidedSet[];
};

// ── Globals (MediaPipe loaded via CDN) ───────────────────────

declare global {
  interface Window {
    Pose?: any;
    Camera?: any;
    drawConnectors?: (...args: any[]) => void;
    drawLandmarks?: (...args: any[]) => void;
    POSE_CONNECTIONS?: any;
  }
}

// ── Constants ────────────────────────────────────────────────

// Self-hosted assets (copied from node_modules by scripts/copy-mediapipe.js during build).
// Falls back to jsDelivr CDN only when the local file is missing (dev mode without prebuild).
const MEDIAPIPE_BASE_LOCAL = "/mediapipe";
const MEDIAPIPE_BASE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe";

const MEDIAPIPE_SCRIPTS = [
  `${MEDIAPIPE_BASE_LOCAL}/camera_utils/camera_utils.js`,
  `${MEDIAPIPE_BASE_LOCAL}/drawing_utils/drawing_utils.js`,
  `${MEDIAPIPE_BASE_LOCAL}/pose/pose.js`,
];

const STORAGE_KEY = "corefit:movement:sessions";
// Chave própria do ack do disclaimer beta — NÃO reutilizar a de sessões.
const BETA_ACK_KEY = "corefit:movement:betaDisclaimerAck";

// Classifica a falha de inicialização em uma mensagem acionável + um `kind` curto
// para analytics. getUserMedia (via window.Camera) rejeita com DOMException.name.
function describeCameraError(err: unknown): { kind: string; message: string } {
  const e = err as { name?: string; message?: string } | null;
  const name = e?.name ?? "";
  const msg = String(e?.message ?? "");
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return {
      kind: "permission_denied",
      message:
        "Permissão de câmera negada. Autorize o acesso pela barra de endereço (ícone de cadeado) e toque em Tentar novamente.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      kind: "no_camera",
      message:
        "Nenhuma câmera foi encontrada neste dispositivo. Conecte uma webcam ou abra o Lab em um aparelho com câmera.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return {
      kind: "camera_in_use",
      message:
        "A câmera parece estar em uso por outro aplicativo. Feche os outros programas que usam a câmera e toque em Tentar novamente.",
    };
  }
  if (msg.includes("MediaPipe") || msg.includes("Failed to load") || msg.includes("canvas")) {
    return {
      kind: "mediapipe_load",
      message:
        "Não foi possível carregar os recursos de análise. Verifique sua conexão e toque em Tentar novamente.",
    };
  }
  return {
    kind: "unknown",
    message: msg || "Não foi possível iniciar a câmera. Toque em Tentar novamente.",
  };
}

// Skeleton colors by form score range (must be literal values, not CSS vars)
const SKELETON_COLOR_HIGH = "#7B9919";
const SKELETON_COLOR_MID = "#F59E0B";
const SKELETON_COLOR_LOW = "#DC2626";

// ── Helpers ──────────────────────────────────────────────────

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${src}"]`
    ) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true }
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function loadScript(src: string): Promise<void> {
  if (!src.startsWith(MEDIAPIPE_BASE_LOCAL)) return injectScript(src);

  // Local self-hosted attempt → fall back to CDN on error
  const cdnSrc = src.replace(
    MEDIAPIPE_BASE_LOCAL + "/camera_utils",
    MEDIAPIPE_BASE_CDN + "/camera_utils"
  ).replace(
    MEDIAPIPE_BASE_LOCAL + "/drawing_utils",
    MEDIAPIPE_BASE_CDN + "/drawing_utils"
  ).replace(
    MEDIAPIPE_BASE_LOCAL + "/pose",
    MEDIAPIPE_BASE_CDN + "/pose"
  );

  return injectScript(src).catch(() => {
    console.warn(`[mediapipe] local asset not found, falling back to CDN: ${src}`);
    return injectScript(cdnSrc);
  });
}

function loadHistory(): MovementSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MovementSession[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(sessions: MovementSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-30)));
  } catch {
    // storage might be unavailable
  }
}

function skeletonColor(formScore: number, confidence: string): string {
  if (confidence === "low") return SKELETON_COLOR_HIGH;
  if (formScore >= 80) return SKELETON_COLOR_HIGH;
  if (formScore >= 60) return SKELETON_COLOR_MID;
  return SKELETON_COLOR_LOW;
}

function drawAngleLabel(
  ctx: CanvasRenderingContext2D,
  lm: PoseLandmark,
  canvasW: number,
  canvasH: number,
  angle: number | null,
  side: string
) {
  if (angle === null) return;
  const x = lm.x * canvasW;
  const y = lm.y * canvasH;
  const text = `${angle}° ${side}`;
  ctx.save();
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - tw / 2 - 5, y - 28, tw + 10, 18);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(text, x, y - 15);
  ctx.restore();
}

// ── Sparkline ────────────────────────────────────────────────

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const h = 36;
  const barW = 12;
  const gap = 4;
  const w = scores.length * (barW + gap) - gap;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {scores.map((s, i) => {
        const barH = Math.max(4, Math.round((s / 100) * h));
        const color =
          s >= 80
            ? SKELETON_COLOR_HIGH
            : s >= 60
              ? SKELETON_COLOR_MID
              : SKELETON_COLOR_LOW;
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={h - barH}
            width={barW}
            height={barH}
            fill={color}
            rx="3"
            opacity="0.85"
          />
        );
      })}
    </svg>
  );
}

// ── Initial analysis ─────────────────────────────────────────

function makeInitialAnalysis(): AnalysisState {
  return {
    leftAngle: null,
    rightAngle: null,
    repCount: 0,
    stage: "down",
    feedback: [],
    confidence: "low",
    formScore: 0,
    symmetry: 0,
  };
}

// ── Main component ───────────────────────────────────────────

export default function MovementLabPage() {
  // ── State ──────────────────────────────────────────────────
  const [exerciseId, setExerciseId] = useState<ExerciseId>("biceps_curl");
  const [activeCategory, setActiveCategory] =
    useState<ExerciseCategory>("gym");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calibrationState, setCalibrationState] =
    useState<CalibrationState>("idle");
  const [countdown, setCountdown] = useState(3);
  const [analysis, setAnalysis] = useState<AnalysisState>(
    makeInitialAnalysis()
  );
  const [repPulse, setRepPulse] = useState(false);
  const [coachingKey, setCoachingKey] = useState(0);
  const [seriesQuality, setSeriesQuality] = useState(0);
  const [contextWarning, setContextWarning] =
    useState<ContextAssessment | null>(null);
  const [sessionSummary, setSessionSummary] =
    useState<SessionSummaryData | null>(null);
  const [history, setHistory] = useState<MovementSession[]>(loadHistory);

  // ── Beta: disclaimer, retry de câmera e feedback pós-sessão ─
  const [searchParams] = useSearchParams();
  // Lido de forma SÍNCRONA no primeiro render: iniciado em `false` e promovido
  // por efeito, o disclaimer perdia a corrida para o efeito que liga a câmera —
  // o prompt do sistema aparecia junto com (ou antes de) o aviso que deveria
  // precedê-lo.
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try {
      return !localStorage.getItem(BETA_ACK_KEY);
    } catch {
      return false; // storage indisponível — segue sem bloquear
    }
  });
  const [retryToken, setRetryToken] = useState(0);
  const [feedbackFor, setFeedbackFor] = useState<{
    exerciseId: ExerciseId;
    exerciseLabel: string;
    repCount: number;
  } | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const openedReportedRef = useRef(false);

  // ── Modo guiado (Spec 022) ─────────────────────────────────
  const navigate = useNavigate();
  const { hasFeature } = useFeatureFlags();
  const [guided, setGuided] = useState<GuidedState | null>(null);
  const [guidedReps, setGuidedReps] = useState(0);
  const [guidedRest, setGuidedRest] = useState<number | null>(null);
  const [guidedFinished, setGuidedFinished] = useState(false);
  const [guidedSaving, setGuidedSaving] = useState(false);
  const [guidedError, setGuidedError] = useState<string | null>(null);
  const guidedInitRef = useRef(false);

  // ── Refs (accessed inside callbacks without stale closures) ─
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const exerciseIdRef = useRef<ExerciseId>(exerciseId);
  const stageRef = useRef<Stage>("down");
  const repCountRef = useRef(0);
  const lastRepAtRef = useRef(0);

  const calibrationStateRef = useRef<CalibrationState>("idle");
  const countdownValueRef = useRef(3);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const lastHighConfidenceRef = useRef<number>(0);

  const repScoresRef = useRef<number[]>([]);
  const repSymmetriesRef = useRef<number[]>([]);
  const repAmplitudesRef = useRef<number[]>([]);
  const repMinAngleRef = useRef<number | null>(null);
  const repMaxAngleRef = useRef<number | null>(null);
  const firstRepAtRef = useRef<number>(0);

  const frameCountRef = useRef(0);
  const angleHistoryRef = useRef<number[]>([]);
  const prevCoachingMsgRef = useRef<string>("");
  const repPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formScoreRef = useRef(0);

  // ── Sync exerciseIdRef when state changes ──────────────────
  useEffect(() => {
    exerciseIdRef.current = exerciseId;
    // Reset all per-series state when exercise changes
    stageRef.current = "down";
    repCountRef.current = 0;
    lastRepAtRef.current = 0;
    repScoresRef.current = [];
    repSymmetriesRef.current = [];
    repAmplitudesRef.current = [];
    repMinAngleRef.current = null;
    repMaxAngleRef.current = null;
    firstRepAtRef.current = 0;
    angleHistoryRef.current = [];
    formScoreRef.current = 0;
    prevCoachingMsgRef.current = "";

    // Stop countdown if running
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    calibrationStateRef.current = "idle";
    setCalibrationState("idle");
    setCountdown(3);
    setAnalysis(makeInitialAnalysis());
    setSeriesQuality(0);
    setContextWarning(null);
  }, [exerciseId]);

  // ── Device motion (once on mount) ─────────────────────────
  useEffect(() => {
    window.addEventListener("devicemotion", handleDeviceMotion);
    return () => window.removeEventListener("devicemotion", handleDeviceMotion);
  }, []);

  // ── Analytics: Lab aberto (uma vez), com a origem do card ─
  useEffect(() => {
    if (openedReportedRef.current) return;
    openedReportedRef.current = true;
    const from = searchParams.get("from");
    const source = from === "today" || from === "treino" ? from : "direct";
    postLabEvent("movement_lab.opened", { source });
  }, [searchParams]);

  // ── Init do modo guiado a partir da query da ficha (uma vez) ─
  useEffect(() => {
    if (guidedInitRef.current) return;
    guidedInitRef.current = true;
    if (!hasFeature("movement_lab_guided")) return; // flag off → cai no avulso
    const labId = searchParams.get("labId");
    const exerciseUuid = searchParams.get("exerciseId");
    const planIdP = Number(searchParams.get("planId"));
    const dayIndexP = Number(searchParams.get("dayIndex"));
    if (!labId || !(labId in EXERCISE_CATALOG) || !exerciseUuid) return;
    if (!Number.isFinite(planIdP) || !Number.isFinite(dayIndexP)) return;
    const id = labId as ExerciseId;
    setGuided({
      planId: planIdP,
      dayIndex: dayIndexP,
      exerciseUuid,
      name: searchParams.get("name") || EXERCISE_CATALOG[id].label,
      targetSets: Math.min(12, Math.max(1, Number(searchParams.get("sets")) || 1)),
      targetReps: searchParams.get("reps") || "",
      restS: Math.max(0, Math.min(600, Number(searchParams.get("rest")) || 60)),
      completed: [],
    });
    setActiveCategory(EXERCISE_CATALOG[id].category);
    setExerciseId(id);
  }, [searchParams, hasFeature]);

  // ── Ao abrir o resumo em modo guiado, prepara a correção de reps ─
  useEffect(() => {
    if (guided && sessionSummary) setGuidedReps(sessionSummary.repCount);
  }, [guided, sessionSummary]);

  // ── Contagem regressiva do descanso entre séries ─
  useEffect(() => {
    if (guidedRest == null) return;
    if (guidedRest <= 0) {
      setGuidedRest(null);
      return;
    }
    const t = setTimeout(() => setGuidedRest((s) => (s == null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [guidedRest]);

  // ── Camera initialization (once on mount) ─────────────────
  useEffect(() => {
    // O aviso de câmera e de privacidade precede o pedido de permissão.
    if (showDisclaimer) return;

    let cancelled = false;

    async function setup() {
      try {
        setCameraStatus("loading");
        setErrorMessage(null);
        await Promise.all(MEDIAPIPE_SCRIPTS.map(loadScript));
        if (cancelled) return;

        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        if (
          !videoElement ||
          !canvasElement ||
          !window.Pose ||
          !window.Camera
        ) {
          throw new Error("Não foi possível preparar a webcam ou o MediaPipe.");
        }

        const ctx = canvasElement.getContext("2d");
        if (!ctx) throw new Error("Não foi possível preparar o canvas.");

        const pose = new window.Pose({
          locateFile: (file: string) =>
            `${MEDIAPIPE_BASE_LOCAL}/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        pose.onResults((results: { poseLandmarks?: PoseLandmark[]; image?: any }) => {
          const canvasEl = canvasRef.current;
          if (!canvasEl) return;
          const cw = canvasEl.width;
          const ch = canvasEl.height;

          ctx.save();
          ctx.clearRect(0, 0, cw, ch);
          if (results.image) {
            ctx.drawImage(results.image, 0, 0, cw, ch);
          }

          const landmarks = results.poseLandmarks ?? [];
          const hasLandmarks = landmarks.length >= 25;

          // ── Determine confidence ───────────────────────────
          let confidence: "low" | "medium" | "high" = "low";
          if (hasLandmarks) {
            const vis = avgAngles([
              landmarks[11]?.visibility ?? null,
              landmarks[12]?.visibility ?? null,
              landmarks[13]?.visibility ?? null,
              landmarks[14]?.visibility ?? null,
            ]);
            confidence =
              vis && vis > 0.8
                ? "high"
                : vis && vis > 0.55
                  ? "medium"
                  : "low";
          }

          // ── Skeleton color from live form score ────────────
          const color = skeletonColor(formScoreRef.current, confidence);

          if (
            hasLandmarks &&
            window.drawConnectors &&
            window.drawLandmarks &&
            window.POSE_CONNECTIONS
          ) {
            window.drawConnectors(ctx, landmarks, window.POSE_CONNECTIONS, {
              color,
              lineWidth: 4,
            });
            window.drawLandmarks(ctx, landmarks, {
              color,
              lineWidth: 1,
              radius: 4,
            });
          }

          const rule = EXERCISE_CATALOG[exerciseIdRef.current];

          if (hasLandmarks) {
            // ── Angles ────────────────────────────────────────
            const { left: leftAngle, right: rightAngle } =
              rule.detectAngles(landmarks);
            const av = avgAngles([leftAngle, rightAngle]);

            // Draw angle labels on primary joints
            if (confidence !== "low") {
              const [lIdx, rIdx] = rule.primaryJoints;
              if (landmarks[lIdx] && leftAngle !== null) {
                drawAngleLabel(ctx, landmarks[lIdx], cw, ch, leftAngle, "E");
              }
              if (landmarks[rIdx] && rightAngle !== null) {
                drawAngleLabel(ctx, landmarks[rIdx], cw, ch, rightAngle, "D");
              }
            }

            // ── Calibration state machine ─────────────────────
            const calState = calibrationStateRef.current;
            if (confidence === "high") {
              lastHighConfidenceRef.current = Date.now();
              if (calState === "idle") {
                // Start 3-2-1 countdown
                calibrationStateRef.current = "countdown";
                setCalibrationState("countdown");
                countdownValueRef.current = 3;
                setCountdown(3);
                if (countdownIntervalRef.current)
                  clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = setInterval(() => {
                  countdownValueRef.current--;
                  setCountdown(countdownValueRef.current);
                  if (countdownValueRef.current <= 0) {
                    clearInterval(countdownIntervalRef.current!);
                    countdownIntervalRef.current = null;
                    calibrationStateRef.current = "tracking";
                    setCalibrationState("tracking");
                  }
                }, 1000);
              } else if (calState === "paused") {
                // Resume immediately (no countdown)
                calibrationStateRef.current = "tracking";
                setCalibrationState("tracking");
              }
            } else if (
              calState === "tracking" &&
              Date.now() - lastHighConfidenceRef.current > 4000
            ) {
              // Pose lost for 4s → pause
              calibrationStateRef.current = "paused";
              setCalibrationState("paused");
            } else if (
              calState === "countdown" &&
              Date.now() - lastHighConfidenceRef.current > 1500
            ) {
              // Confidence dropped during countdown → cancel
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              calibrationStateRef.current = "idle";
              setCalibrationState("idle");
            }

            // ── Rep counting (only when tracking) ─────────────
            const isTracking = calibrationStateRef.current === "tracking";
            let nextStage = stageRef.current;
            let repCounted = false;

            if (isTracking && av !== null) {
              // Track angle range for this rep
              if (repMinAngleRef.current === null || av < repMinAngleRef.current)
                repMinAngleRef.current = av;
              if (repMaxAngleRef.current === null || av > repMaxAngleRef.current)
                repMaxAngleRef.current = av;

              const transition = rule.detectRep({
                avgAngle: av,
                leftAngle,
                rightAngle,
                stage: stageRef.current,
                lastRepAt: lastRepAtRef.current,
              });
              nextStage = transition.nextStage;
              repCounted = transition.counted;

              if (repCounted) {
                repCountRef.current++;
                lastRepAtRef.current = Date.now();
                if (firstRepAtRef.current === 0)
                  firstRepAtRef.current = Date.now();
                stageRef.current = nextStage;

                // Store rep metrics
                const sym = computeSymmetry(leftAngle, rightAngle);
                const amp =
                  repMaxAngleRef.current !== null &&
                  repMinAngleRef.current !== null
                    ? repMaxAngleRef.current - repMinAngleRef.current
                    : 0;
                repAmplitudesRef.current.push(amp);
                repSymmetriesRef.current.push(sym);

                const repFeedback = rule.buildFeedback(
                  landmarks,
                  leftAngle,
                  rightAngle
                );
                const repFS = computeFormScore({
                  corrections: repFeedback,
                  leftAngle,
                  rightAngle,
                  confidence,
                });
                repScoresRef.current.push(repFS);

                // Update series quality
                const avg2 =
                  repScoresRef.current.reduce((s, v) => s + v, 0) /
                  repScoresRef.current.length;
                setSeriesQuality(Math.round(avg2));

                // Reset rep tracking
                repMinAngleRef.current = null;
                repMaxAngleRef.current = null;

                // Rep pulse
                setRepPulse(true);
                if (repPulseTimerRef.current)
                  clearTimeout(repPulseTimerRef.current);
                repPulseTimerRef.current = setTimeout(
                  () => setRepPulse(false),
                  400
                );
              } else {
                stageRef.current = nextStage;
              }
            }

            // ── Feedback & form score ──────────────────────────
            const corrections = rule.buildFeedback(
              landmarks,
              leftAngle,
              rightAngle
            );
            const ranked = rankCorrections(corrections);
            const fs = computeFormScore({
              corrections: ranked,
              leftAngle,
              rightAngle,
              confidence,
            });
            const sym = computeSymmetry(leftAngle, rightAngle);
            formScoreRef.current = fs;

            // ── Coaching message change → re-animate card ──────
            const topMsg = ranked[0]?.message ?? "";
            if (topMsg !== prevCoachingMsgRef.current) {
              prevCoachingMsgRef.current = topMsg;
              setCoachingKey((k) => k + 1);
            }

            // ── Angle history for inactivity detection ─────────
            if (av !== null) {
              angleHistoryRef.current.push(av);
              if (angleHistoryRef.current.length > 30)
                angleHistoryRef.current.shift();
            }

            // ── Context check (every 60 frames ≈ 2s at 30fps) ──
            frameCountRef.current++;
            if (frameCountRef.current % 60 === 0) {
              const outOfFrame = assessOutOfFrame([
                landmarks[11]?.visibility,
                landmarks[12]?.visibility,
                landmarks[13]?.visibility,
                landmarks[14]?.visibility,
                landmarks[23]?.visibility,
                landmarks[24]?.visibility,
              ]);
              const inactive = assessInactive(angleHistoryRef.current);
              const partialReps = assessPartialReps(
                repAmplitudesRef.current
              );
              const deviceMoving = isDeviceMoving();
              const ctx2 = assessContext({
                outOfFrame,
                inactive,
                deviceMoving,
                partialReps,
              });
              setContextWarning(ctx2.valid && !ctx2.reason ? null : ctx2);
            }

            // ── Update React state ─────────────────────────────
            setAnalysis({
              leftAngle,
              rightAngle,
              repCount: repCountRef.current,
              stage: stageRef.current,
              feedback: ranked,
              confidence,
              formScore: fs,
              symmetry: sym,
            });
          } else {
            // No landmarks detected
            formScoreRef.current = 0;

            if (
              calibrationStateRef.current === "tracking" &&
              Date.now() - lastHighConfidenceRef.current > 4000
            ) {
              calibrationStateRef.current = "paused";
              setCalibrationState("paused");
            }

            setAnalysis((prev) => ({
              ...prev,
              leftAngle: null,
              rightAngle: null,
              confidence: "low",
              formScore: 0,
              symmetry: 0,
              feedback: [],
            }));
          }

          ctx.restore();
        });

        const camera = new window.Camera(videoElement, {
          onFrame: async () => {
            if (videoElement.readyState >= 2) {
              const canvasEl = canvasRef.current;
              if (canvasEl) {
                canvasEl.width = videoElement.videoWidth || 960;
                canvasEl.height = videoElement.videoHeight || 540;
              }
              await pose.send({ image: videoElement });
            }
          },
          width: 960,
          height: 540,
        });

        poseRef.current = pose;
        cameraRef.current = camera;
        await camera.start();
        if (!cancelled) setCameraStatus("ready");
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          const described = describeCameraError(err);
          setCameraStatus("error");
          setErrorMessage(described.message);
          postLabEvent("movement_lab.camera_error", { errorKind: described.kind });
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      if (repPulseTimerRef.current) clearTimeout(repPulseTimerRef.current);
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      if (cameraRef.current?.stop) cameraRef.current.stop();
      poseRef.current = null;
      cameraRef.current = null;
    };
  }, [retryToken, showDisclaimer]);

  function handleRetryCamera() {
    setErrorMessage(null);
    setCameraStatus("idle");
    setRetryToken((t) => t + 1);
  }

  function ackDisclaimer() {
    try {
      localStorage.setItem(BETA_ACK_KEY, "1");
    } catch {
      // storage indisponível — segue mesmo assim
    }
    setShowDisclaimer(false);
  }

  function submitFeedback() {
    if (!feedbackFor || feedbackRating === 0) return;
    postLabEvent("movement_lab.feedback_submitted", {
      rating: feedbackRating,
      comment: feedbackComment.trim() || undefined,
      exerciseId: feedbackFor.exerciseId,
      repCount: feedbackFor.repCount,
    });
    setFeedbackFor(null);
  }

  function skipFeedback() {
    setFeedbackFor(null);
  }

  // ── Modo guiado: salvar série, descanso, finalizar ─────────
  async function finalizeGuided(completed: GuidedSet[], status: "completed" | "partial") {
    if (!guided) return;
    setGuidedSaving(true);
    setGuidedError(null);
    try {
      const res = await authFetch(`${API_URL}/training/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "movement_lab",
          status,
          planId: guided.planId,
          dayIndex: guided.dayIndex,
          title: guided.name,
          awardGamification: false, // analisar 1 exercício ≠ treino completo — não infla XP/streak
          sets: completed.map((c, i) => ({
            exerciseId: guided.exerciseUuid,
            name: guided.name,
            orderIndex: 0,
            setIndex: i + 1,
            plannedReps: guided.targetReps,
            repsDone: c.repsDone,
            plannedRestS: guided.restS,
            status: "done",
            capture: {
              detectedReps: c.detectedReps,
              corrected: c.repsDone !== c.detectedReps,
              avgFormScore: c.formScore,
              avgSymmetry: c.symmetry,
              confidence: c.confidence,
            },
          })),
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setGuidedFinished(true);
    } catch {
      setGuidedError("Não foi possível salvar a execução. Tente novamente.");
    } finally {
      setGuidedSaving(false);
    }
  }

  function handleSaveGuidedSet() {
    if (!guided || !sessionSummary) return;
    const entry: GuidedSet = {
      detectedReps: sessionSummary.repCount,
      repsDone: Math.max(0, guidedReps),
      formScore: sessionSummary.avgFormScore,
      symmetry: sessionSummary.avgSymmetry,
      confidence: analysis.confidence,
    };
    const completed = [...guided.completed, entry];
    setGuided({ ...guided, completed });
    setSessionSummary(null);
    handleResetSeries();
    if (completed.length >= guided.targetSets) {
      void finalizeGuided(completed, "completed");
    } else {
      setGuidedRest(guided.restS > 0 ? guided.restS : 60);
    }
  }

  function handleFinishGuidedEarly() {
    if (!guided || guided.completed.length === 0) return;
    const status = guided.completed.length >= guided.targetSets ? "completed" : "partial";
    void finalizeGuided(guided.completed, status);
  }

  function exitGuidedToWorkout() {
    if (!guided) return;
    navigate(`/app/user/treino/${guided.planId}/${guided.dayIndex}`);
  }

  // ── Derived values ────────────────────────────────────────
  const currentRule = EXERCISE_CATALOG[exerciseId];

  const activeGroups = useMemo(
    () => EXERCISE_GROUPS.filter((g) => g.category === activeCategory),
    [activeCategory]
  );

  const confidenceTone = useMemo(() => {
    if (analysis.confidence === "high") return "high";
    if (analysis.confidence === "medium") return "mid";
    return "low";
  }, [analysis.confidence]);

  const confidenceLabel = useMemo(() => {
    if (analysis.confidence === "high") return "leitura boa";
    if (analysis.confidence === "medium") return "leitura razoável";
    if (cameraStatus === "loading") return "inicializando...";
    if (cameraStatus === "error") return "falha";
    return "aguardando câmera";
  }, [analysis.confidence, cameraStatus]);

  const topCorrection: Correction | null =
    analysis.feedback.length > 0 ? analysis.feedback[0] : null;

  const exerciseHistory = useMemo(
    () =>
      history
        .filter((s) => s.exerciseId === exerciseId)
        .slice(-5),
    [history, exerciseId]
  );

  // ── Handlers ──────────────────────────────────────────────
  function handleExerciseSelect(id: ExerciseId) {
    setSessionSummary(null);
    setExerciseId(id);
  }

  function handleEndSeries() {
    const scores = repScoresRef.current;
    const symmetries = repSymmetriesRef.current;
    if (scores.length === 0) return;

    const avgFS = Math.round(
      scores.reduce((s, v) => s + v, 0) / scores.length
    );
    const bestRepScore = Math.max(...scores);
    const worstRepScore = Math.min(...scores);
    const avgSym =
      symmetries.length > 0
        ? Math.round(
            symmetries.reduce((s, v) => s + v, 0) / symmetries.length
          )
        : 0;

    const insight = generateInsight({
      repScores: scores,
      avgFormScore: avgFS,
      avgSymmetry: avgSym,
      exerciseLabel: currentRule.label,
    });

    setSessionSummary({
      id: crypto.randomUUID(),
      exerciseId,
      exerciseLabel: currentRule.label,
      timestamp: Date.now(),
      repCount: repCountRef.current,
      avgFormScore: avgFS,
      bestRepScore,
      worstRepScore,
      avgSymmetry: avgSym,
      insight,
      repScores: scores,
    });
  }

  function handleSaveSession() {
    if (!sessionSummary) return;
    const session: MovementSession = {
      id: sessionSummary.id,
      exerciseId: sessionSummary.exerciseId,
      exerciseLabel: sessionSummary.exerciseLabel,
      timestamp: sessionSummary.timestamp,
      repCount: sessionSummary.repCount,
      avgFormScore: sessionSummary.avgFormScore,
      bestRepScore: sessionSummary.bestRepScore,
      worstRepScore: sessionSummary.worstRepScore,
      avgSymmetry: sessionSummary.avgSymmetry,
      insight: sessionSummary.insight,
    };
    const updated = [...history, session];
    setHistory(updated);
    saveHistory(updated);

    // Persist to backend — fire-and-forget; localStorage is source of truth
    authFetch(`${API_URL}/movement/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId: session.exerciseId,
        exerciseLabel: session.exerciseLabel,
        repCount: session.repCount,
        avgFormScore: session.avgFormScore,
        bestRepScore: session.bestRepScore,
        worstRepScore: session.worstRepScore,
        avgSymmetry: session.avgSymmetry,
        insight: session.insight,
      }),
    }).catch(() => {
      // Backend unavailable — session already saved to localStorage
    });

    const durationS = firstRepAtRef.current
      ? Math.max(0, Math.round((Date.now() - firstRepAtRef.current) / 1000))
      : 0;
    postLabEvent("movement_lab.session_completed", {
      exerciseId: session.exerciseId,
      repCount: session.repCount,
      avgFormScore: session.avgFormScore,
      durationS,
    });

    // Abre o feedback do beta (o resumo fecha; firstRepAtRef é zerado no reset)
    setFeedbackFor({
      exerciseId: session.exerciseId,
      exerciseLabel: session.exerciseLabel,
      repCount: session.repCount,
    });
    setFeedbackRating(0);
    setFeedbackComment("");

    handleResetSeries();
  }

  function handleResetSeries() {
    setSessionSummary(null);
    repCountRef.current = 0;
    repScoresRef.current = [];
    repSymmetriesRef.current = [];
    repAmplitudesRef.current = [];
    firstRepAtRef.current = 0;
    setAnalysis((prev) => ({ ...prev, repCount: 0 }));
    setSeriesQuality(0);
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="ml-page">

      {/* ── Header + selo beta ────────────────────────────── */}
      <div className="ml-page-header">
        <h1 className="ml-page-title">Lab de Movimento</h1>
        <span className="ml-beta-badge">Beta</span>
      </div>

      {/* ── Banner do modo guiado (aberto da ficha) ───────── */}
      {guided && !guidedFinished && (
        <div className="ml-guided-banner">
          <div className="ml-guided-info">
            <div className="ml-guided-title">Guiado · {guided.name}</div>
            <div className="ml-guided-meta">
              Série {Math.min(guided.completed.length + 1, guided.targetSets)} de {guided.targetSets}
              {guided.targetReps ? ` · meta ${guided.targetReps} reps` : ""}
            </div>
          </div>
          <div className="ml-guided-actions">
            {guided.completed.length > 0 && (
              <button
                type="button"
                className="ml-guided-finish"
                onClick={handleFinishGuidedEarly}
                disabled={guidedSaving}
              >
                {guidedSaving ? "Salvando..." : "Concluir treino"}
              </button>
            )}
            <button type="button" className="ml-guided-exit" onClick={exitGuidedToWorkout}>
              Sair
            </button>
          </div>
        </div>
      )}
      {guidedError && <div className="ml-error-msg"><div className="ml-error-text">{guidedError}</div></div>}

      {/* ── Exercise selector ─────────────────────────────── */}
      <div className="ml-card ml-selector-wrap">
        <div className="ml-selector-tab-row">
          {(["gym", "home"] as ExerciseCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`ml-selector-tab${activeCategory === cat ? " ml-active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === "gym" ? "Academia" : "Casa"}
            </button>
          ))}
        </div>

        {activeGroups.map((group) => (
          <div key={`${group.category}-${group.group}`} className="ml-selector-group-row">
            <span className="ml-selector-group-label">{group.groupLabel}</span>
            <div className="ml-selector-chips-row">
              {group.exercises.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`ml-exercise-chip${exerciseId === id ? " ml-active" : ""}`}
                  onClick={() => handleExerciseSelect(id)}
                >
                  {EXERCISE_CATALOG[id].label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Ready Bar ─────────────────────────────────────── */}
      <div className="ml-ready-bar">
        <span className={`ml-dot ml-dot-${confidenceTone}`} />
        <span>IA: {confidenceLabel}</span>
        <span className="ml-ready-sep">·</span>
        <span className="ml-ready-strong">{currentRule.label}</span>
        {cameraStatus === "ready" && calibrationState === "tracking" && (
          <>
            <span className="ml-ready-sep">·</span>
            <span className="ml-ready-reps">×{analysis.repCount}</span>
          </>
        )}
        {calibrationState === "paused" && (
          <span className="ml-ready-paused">⏸ pausado</span>
        )}
      </div>

      {/* ── Canvas card ───────────────────────────────────── */}
      <div className="ml-card ml-canvas-card">
        <div className="ml-canvas-wrap">
          <video ref={videoRef} playsInline muted style={{ display: "none" }} />
          <canvas ref={canvasRef} className="ml-canvas-el" />

          {/* HUD — visible only when tracking */}
          {cameraStatus === "ready" && calibrationState === "tracking" && (
            <div className="ml-hud">
              <div className="ml-hud-section">
                <div
                  className={`ml-form-score ml-tone-${scoreToTone(analysis.formScore)}`}
                >
                  {analysis.formScore}
                </div>
                <div className="ml-form-score-label">Form</div>
              </div>

              <div className="ml-hud-section ml-hud-section-center">
                <div
                  className={`ml-rep-count${repPulse ? " ml-rep-pulse" : ""}`}
                >
                  {analysis.repCount}
                </div>
                <div className="ml-hud-label">reps</div>
              </div>

              <div className="ml-hud-section ml-hud-section-right">
                <div className="ml-hud-value">{analysis.symmetry}%</div>
                <div className="ml-hud-label">simetria</div>
              </div>
            </div>
          )}

          {/* Secondary angle chips — top right */}
          {cameraStatus === "ready" && analysis.confidence !== "low" && (
            <div className="ml-angle-chips">
              {analysis.leftAngle !== null && (
                <span className="ml-angle-chip">
                  {analysis.leftAngle}° E
                </span>
              )}
              {analysis.rightAngle !== null && (
                <span className="ml-angle-chip">
                  {analysis.rightAngle}° D
                </span>
              )}
            </div>
          )}

          {/* Countdown overlay */}
          {calibrationState === "countdown" && (
            <div className="ml-camera-overlay">
              <div
                className="ml-countdown-number"
                key={countdown}
              >
                {countdown}
              </div>
              <div className="ml-camera-overlay-text">Prepare-se...</div>
            </div>
          )}

          {/* Loading overlay */}
          {cameraStatus === "loading" && (
            <div className="ml-camera-overlay ml-camera-overlay-dark">
              <div className="ml-camera-overlay-text">
                Inicializando câmera e IA...
              </div>
              <div className="ml-camera-overlay-sub">
                Aguarde alguns segundos
              </div>
            </div>
          )}

          {/* Idle — waiting for user to appear */}
          {cameraStatus === "ready" && calibrationState === "idle" && (
            <div className="ml-camera-overlay">
              <div className="ml-camera-overlay-text">
                Mostre-se à câmera
              </div>
              <div className="ml-camera-overlay-sub">
                {currentRule.positionHint}
              </div>
            </div>
          )}

          {/* Paused overlay */}
          {calibrationState === "paused" && (
            <div className="ml-camera-overlay">
              <div className="ml-camera-overlay-text">Pausado</div>
              <div className="ml-camera-overlay-sub">
                Retorne ao enquadramento para continuar
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Context warning ───────────────────────────────── */}
      {contextWarning && contextWarning.reason && (
        <div
          className={`ml-context-warning${
            contextWarning.severity === "info"
              ? " ml-context-warning-info"
              : contextWarning.severity === "block"
                ? " ml-context-warning-block"
                : ""
          }`}
        >
          {contextWarning.reason}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────── */}
      {errorMessage && (
        <div className="ml-error-msg">
          <div className="ml-error-text">{errorMessage}</div>
          <button type="button" className="ml-retry-btn" onClick={handleRetryCamera}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Coaching stack ────────────────────────────────── */}
      {cameraStatus === "ready" && (
        <div className="ml-card ml-coaching-stack">
          {topCorrection ? (
            <div
              key={coachingKey}
              className="ml-coaching-card"
            >
              <div
                className={`ml-coaching-icon ${
                  topCorrection.severity === "safety"
                    ? "ml-coaching-icon-safety"
                    : "ml-coaching-icon-warn"
                }`}
              >
                !
              </div>
              <div className="ml-coaching-text">{topCorrection.message}</div>
            </div>
          ) : calibrationState === "tracking" ? (
            <div
              key={coachingKey}
              className="ml-coaching-card ml-coaching-card-ok"
            >
              <div className="ml-coaching-icon ml-coaching-icon-ok">✓</div>
              <div className="ml-coaching-text">
                {analysis.repCount === 0
                  ? "Pronto — inicie o movimento para começar a contar."
                  : "Boa execução. Continue controlando o tempo da repetição."}
              </div>
            </div>
          ) : (
            <div className="ml-coaching-card">
              <div className="ml-coaching-icon ml-coaching-icon-warn">·</div>
              <div className="ml-coaching-text">
                {currentRule.positionHint}
              </div>
            </div>
          )}

          {calibrationState === "tracking" && (
            <div className="ml-quality-wrap">
              <div className="ml-quality-header">
                <span className="ml-quality-label">Qualidade da série</span>
                <span className="ml-quality-pct">{seriesQuality}%</span>
              </div>
              <div className="ml-quality-track">
                <div
                  className={`ml-quality-fill ml-tone-${scoreToTone(seriesQuality)}`}
                  style={{ width: `${seriesQuality}%` }}
                />
              </div>
            </div>
          )}

          {analysis.repCount >= 3 && (
            <button className="ml-end-btn" type="button" onClick={handleEndSeries}>
              Encerrar série
            </button>
          )}
        </div>
      )}

      {/* ── Session Summary modal ─────────────────────────── */}
      {sessionSummary && (
        <div
          className="ml-summary-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleResetSeries();
          }}
        >
          <div className="ml-summary-modal">
            <div>
              <div className="ml-summary-eyebrow">Série concluída</div>
              <div className="ml-summary-headline">
                {sessionSummary.exerciseLabel} — {sessionSummary.repCount} reps
              </div>
            </div>

            <div className="ml-summary-score-block">
              <div
                className={`ml-summary-score ml-tone-${scoreToTone(sessionSummary.avgFormScore)}`}
              >
                {sessionSummary.avgFormScore}
              </div>
              <div className="ml-summary-score-sub">Form Score médio</div>
            </div>

            <div className="ml-summary-grid">
              <div className="ml-summary-metric">
                <div
                  className={`ml-summary-metric-value ml-tone-${scoreToTone(sessionSummary.bestRepScore)}`}
                >
                  {sessionSummary.bestRepScore}
                </div>
                <div className="ml-summary-metric-label">Melhor rep</div>
              </div>
              <div className="ml-summary-metric">
                <div
                  className={`ml-summary-metric-value ml-tone-${scoreToTone(sessionSummary.worstRepScore)}`}
                >
                  {sessionSummary.worstRepScore}
                </div>
                <div className="ml-summary-metric-label">Pior rep</div>
              </div>
              <div className="ml-summary-metric">
                <div className="ml-summary-metric-value">
                  {sessionSummary.avgSymmetry}%
                </div>
                <div className="ml-summary-metric-label">Simetria</div>
              </div>
            </div>

            <div className="ml-summary-insight">{sessionSummary.insight}</div>

            {guided ? (
              <>
                <div className="ml-reps-correct">
                  <span className="ml-reps-correct-label">
                    Reps válidas (a IA contou {sessionSummary.repCount})
                  </span>
                  <div className="ml-reps-stepper">
                    <button
                      type="button"
                      aria-label="Diminuir"
                      onClick={() => setGuidedReps((r) => Math.max(0, r - 1))}
                    >
                      −
                    </button>
                    <span className="ml-reps-stepper-value">{guidedReps}</span>
                    <button
                      type="button"
                      aria-label="Aumentar"
                      onClick={() => setGuidedReps((r) => r + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="ml-summary-actions">
                  <button
                    className="ml-summary-btn-primary"
                    type="button"
                    disabled={guidedSaving}
                    onClick={handleSaveGuidedSet}
                  >
                    {guided.completed.length + 1 >= guided.targetSets
                      ? guidedSaving
                        ? "Salvando..."
                        : "Salvar e concluir"
                      : "Salvar série"}
                  </button>
                  <button
                    className="ml-summary-btn-secondary"
                    type="button"
                    onClick={handleResetSeries}
                  >
                    Refazer série
                  </button>
                </div>
              </>
            ) : (
              <div className="ml-summary-actions">
                <button
                  className="ml-summary-btn-primary"
                  type="button"
                  onClick={handleSaveSession}
                >
                  Salvar sessão
                </button>
                <button
                  className="ml-summary-btn-secondary"
                  type="button"
                  onClick={handleResetSeries}
                >
                  Descartar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── History ───────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="ml-card">
          <div className="ml-history-title">Histórico de sessões</div>
          <div className="ml-history-list">
            {exerciseHistory.length > 0 ? (
              exerciseHistory
                .slice()
                .reverse()
                .map((session) => (
                  <div key={session.id} className="ml-history-row">
                    <div className="ml-history-label">
                      {session.exerciseLabel}
                    </div>
                    <div className="ml-history-meta">
                      {session.repCount} reps ·{" "}
                      {new Date(session.timestamp).toLocaleDateString("pt-BR")}
                    </div>
                    <div
                      className={`ml-history-score ml-tone-${scoreToTone(session.avgFormScore)}`}
                    >
                      {session.avgFormScore}
                    </div>
                  </div>
                ))
            ) : (
              <div className="ml-history-row">
                <div className="ml-history-label" style={{ color: "var(--color-text-muted)" }}>
                  Nenhuma sessão salva para este exercício ainda.
                </div>
              </div>
            )}
          </div>

          {exerciseHistory.length >= 2 && (
            <div className="ml-sparkline-wrap">
              <span className="ml-sparkline-label">Evolução</span>
              <Sparkline scores={exerciseHistory.map((s) => s.avgFormScore)} />
            </div>
          )}
        </div>
      )}

      {/* ── Descanso entre séries (guiado) ────────────────── */}
      {guided && guidedRest != null && !guidedFinished && (
        <div className="ml-summary-backdrop">
          <div className="ml-summary-modal ml-rest-modal">
            <div className="ml-summary-eyebrow">Descanso</div>
            <div className="ml-rest-count">{guidedRest}s</div>
            <div className="ml-summary-score-sub">
              Prepare a próxima série ({guided.completed.length + 1}/{guided.targetSets})
            </div>
            <div className="ml-summary-actions">
              <button className="ml-summary-btn-primary" type="button" onClick={() => setGuidedRest(null)}>
                Pular descanso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Execução guiada concluída ─────────────────────── */}
      {guided && guidedFinished && (
        <div className="ml-summary-backdrop">
          <div className="ml-summary-modal">
            <div>
              <div className="ml-summary-eyebrow">Execução salva</div>
              <div className="ml-summary-headline">{guided.name}</div>
            </div>
            <div className="ml-summary-score-sub">
              {guided.completed.length} de {guided.targetSets} séries registradas na sua ficha.
            </div>
            <div className="ml-summary-actions">
              <button className="ml-summary-btn-primary" type="button" onClick={exitGuidedToWorkout}>
                Voltar ao treino
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disclaimer beta (primeira visita) ─────────────── */}
      {showDisclaimer && (
        <div className="ml-summary-backdrop">
          <div className="ml-summary-modal">
            <div>
              <div className="ml-summary-eyebrow">Recurso em teste · Beta</div>
              <div className="ml-summary-headline">Como funciona o Lab</div>
            </div>
            <ul className="ml-disclaimer-list">
              <li>
                Vamos pedir acesso à <strong>câmera</strong> para analisar sua execução em tempo real.
              </li>
              <li>A análise acontece no seu aparelho. Nenhum vídeo é gravado ou enviado.</li>
              <li>A contagem de repetições é experimental e pode errar — ajuste manualmente quando precisar.</li>
              <li>É um apoio à execução. Não substitui a orientação do seu personal ou profissional de saúde.</li>
            </ul>
            <div className="ml-summary-actions">
              <button className="ml-summary-btn-secondary" type="button" onClick={() => navigate(-1)}>
                Agora não
              </button>
              <button className="ml-summary-btn-primary" type="button" onClick={ackDisclaimer}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback pós-sessão (beta) ────────────────────── */}
      {feedbackFor && (
        <div
          className="ml-summary-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) skipFeedback();
          }}
        >
          <div className="ml-summary-modal">
            <div>
              <div className="ml-summary-eyebrow">Sua opinião ajuda o beta</div>
              <div className="ml-summary-headline">A contagem fez sentido?</div>
            </div>
            <div className="ml-feedback-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} ${n > 1 ? "estrelas" : "estrela"}`}
                  className={`ml-feedback-star${feedbackRating >= n ? " ml-feedback-star-on" : ""}`}
                  onClick={() => setFeedbackRating(n)}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              className="ml-feedback-textarea"
              placeholder="O que funcionou ou falhou? (opcional)"
              value={feedbackComment}
              maxLength={500}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
            <div className="ml-summary-actions">
              <button
                className="ml-summary-btn-primary"
                type="button"
                disabled={feedbackRating === 0}
                onClick={submitFeedback}
              >
                Enviar
              </button>
              <button className="ml-summary-btn-secondary" type="button" onClick={skipFeedback}>
                Pular
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
