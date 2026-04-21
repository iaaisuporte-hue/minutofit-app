import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS } from "../../styles/colors";

type CameraStatus = "idle" | "loading" | "ready" | "error";
type Stage = "down" | "up";
type ExerciseMode = "biceps_curl" | "shoulder_press" | "squat";

type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type PoseResult = {
  poseLandmarks?: PoseLandmark[];
};

type CurlAnalysis = {
  leftAngle: number | null;
  rightAngle: number | null;
  repCount: number;
  stage: Stage;
  feedback: string[];
  confidence: "low" | "medium" | "high";
};

type MovementAnalysis = CurlAnalysis & {
  label: string;
};

declare global {
  interface Window {
    Pose?: any;
    Camera?: any;
    drawConnectors?: (...args: any[]) => void;
    drawLandmarks?: (...args: any[]) => void;
    POSE_CONNECTIONS?: any;
  }
}

const MEDIAPIPE_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js",
];

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
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {eyebrow ? (
        <div
          style={{
            display: "inline-flex",
            width: "fit-content",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            background: COLORS.highlightSoft,
            color: COLORS.lime,
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text }}>{title}</div>
      {subtitle ? <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>{subtitle}</div> : null}
    </div>
  );
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
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

function angleBetween(
  first: PoseLandmark,
  mid: PoseLandmark,
  last: PoseLandmark
) {
  const radians =
    Math.atan2(last.y - mid.y, last.x - mid.x) -
    Math.atan2(first.y - mid.y, first.x - mid.x);
  let degrees = Math.abs((radians * 180) / Math.PI);
  if (degrees > 180) {
    degrees = 360 - degrees;
  }
  return degrees;
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (!valid.length) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function buildCurlFeedback(
  landmarks: PoseLandmark[],
  leftAngle: number | null,
  rightAngle: number | null
) {
  const feedback = new Set<string>();

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || !leftWrist || !rightWrist || !leftHip || !rightHip) {
    feedback.add("Posicione o corpo inteiro dentro da câmera.");
    return Array.from(feedback);
  }

  const torsoCenterX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  if (Math.abs(torsoCenterX - shoulderCenterX) > 0.06) {
    feedback.add("Evite balançar o tronco durante a rosca.");
  }

  const leftElbowDrift = Math.abs(leftElbow.x - leftHip.x);
  const rightElbowDrift = Math.abs(rightElbow.x - rightHip.x);
  if (leftElbowDrift > 0.13 || rightElbowDrift > 0.13) {
    feedback.add("Mantenha os cotovelos mais próximos do tronco.");
  }

  const leftWristTravel = Math.abs(leftWrist.x - leftElbow.x);
  const rightWristTravel = Math.abs(rightWrist.x - rightElbow.x);
  if (leftWristTravel > 0.18 || rightWristTravel > 0.18) {
    feedback.add("Controle o punho e evite abrir demais os braços.");
  }

  const avgAngle = average([leftAngle, rightAngle]);
  if (avgAngle !== null && avgAngle > 135) {
    feedback.add("Suba mais o movimento para fechar melhor a rosca.");
  }

  if (!feedback.size) {
    feedback.add("Execução estável. Continue controlando o tempo da repetição.");
  }

  return Array.from(feedback);
}

function buildShoulderPressFeedback(
  landmarks: PoseLandmark[],
  leftAngle: number | null,
  rightAngle: number | null
) {
  const feedback = new Set<string>();

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || !leftWrist || !rightWrist || !leftHip || !rightHip) {
    feedback.add("Ajuste a câmera para mostrar braços e tronco inteiros.");
    return Array.from(feedback);
  }

  const hipDrift = Math.abs(((leftShoulder.x + rightShoulder.x) / 2) - ((leftHip.x + rightHip.x) / 2));
  if (hipDrift > 0.08) {
    feedback.add("Evite compensar com a lombar. Mantenha o tronco mais neutro.");
  }

  const leftWristOverElbow = leftWrist.y < leftElbow.y;
  const rightWristOverElbow = rightWrist.y < rightElbow.y;
  if (!(leftWristOverElbow || rightWristOverElbow)) {
    feedback.add("Leve as mãos mais acima da linha dos ombros na subida.");
  }

  if (leftWristOverElbow !== rightWristOverElbow) {
    feedback.add("A subida está assimétrica. Evite levantar apenas um braço.");
  }

  const leftElbowWidth = Math.abs(leftElbow.x - leftShoulder.x);
  const rightElbowWidth = Math.abs(rightElbow.x - rightShoulder.x);
  if (leftElbowWidth > 0.2 || rightElbowWidth > 0.2) {
    feedback.add("Não abra demais os cotovelos. Procure uma linha mais estável.");
  }

  if (leftAngle !== null && rightAngle !== null && Math.abs(leftAngle - rightAngle) > 18) {
    feedback.add("Os braços não estão subindo juntos. Tente manter a mesma amplitude nos dois lados.");
  }

  const avgAngle = average([leftAngle, rightAngle]);
  if (avgAngle !== null && avgAngle < 60) {
    feedback.add("Desça um pouco mais para ganhar amplitude no desenvolvimento.");
  }

  if (!feedback.size) {
    feedback.add("Boa linha de subida. Continue estabilizando punhos e tronco.");
  }

  return Array.from(feedback);
}

function buildSquatFeedback(
  landmarks: PoseLandmark[],
  leftAngle: number | null,
  rightAngle: number | null
) {
  const feedback = new Set<string>();

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) {
    feedback.add("Ajuste a câmera para enquadrar quadril, joelhos e tornozelos.");
    return Array.from(feedback);
  }

  const avgKneeAngle = average([leftAngle, rightAngle]);
  if (avgKneeAngle !== null && avgKneeAngle > 125) {
    feedback.add("Desça um pouco mais se estiver confortável para melhorar a amplitude.");
  }

  const torsoLeanLeft = Math.abs(leftShoulder.x - leftHip.x);
  const torsoLeanRight = Math.abs(rightShoulder.x - rightHip.x);
  if (torsoLeanLeft > 0.14 || torsoLeanRight > 0.14) {
    feedback.add("Evite inclinar demais o tronco. Tente manter o peito mais aberto.");
  }

  const leftKneeInside = leftKnee.x > leftAnkle.x + 0.03;
  const rightKneeInside = rightKnee.x < rightAnkle.x - 0.03;
  if (leftKneeInside || rightKneeInside) {
    feedback.add("Empurre os joelhos levemente para fora para evitar valgo dinâmico.");
  }

  if (!feedback.size) {
    feedback.add("Agachamento estável. Continue controlando joelhos e tronco.");
  }

  return Array.from(feedback);
}

function buildAnalysisForExercise(
  exerciseMode: ExerciseMode,
  landmarks: PoseLandmark[],
  repCount: number,
  stage: Stage,
  confidence: "low" | "medium" | "high"
): MovementAnalysis {
  if (exerciseMode === "squat") {
    const leftAngle = angleBetween(landmarks[23], landmarks[25], landmarks[27]);
    const rightAngle = angleBetween(landmarks[24], landmarks[26], landmarks[28]);
    return {
      label: "Agachamento",
      leftAngle: Number.isFinite(leftAngle) ? Math.round(leftAngle) : null,
      rightAngle: Number.isFinite(rightAngle) ? Math.round(rightAngle) : null,
      repCount,
      stage,
      feedback: buildSquatFeedback(landmarks, leftAngle, rightAngle),
      confidence,
    };
  }

  if (exerciseMode === "shoulder_press") {
    const leftAngle = angleBetween(landmarks[11], landmarks[13], landmarks[15]);
    const rightAngle = angleBetween(landmarks[12], landmarks[14], landmarks[16]);
    return {
      label: "Desenvolvimento de Ombros",
      leftAngle: Number.isFinite(leftAngle) ? Math.round(leftAngle) : null,
      rightAngle: Number.isFinite(rightAngle) ? Math.round(rightAngle) : null,
      repCount,
      stage,
      feedback: buildShoulderPressFeedback(landmarks, leftAngle, rightAngle),
      confidence,
    };
  }

  const leftAngle = angleBetween(landmarks[11], landmarks[13], landmarks[15]);
  const rightAngle = angleBetween(landmarks[12], landmarks[14], landmarks[16]);
  return {
    label: "Rosca Direta",
    leftAngle: Number.isFinite(leftAngle) ? Math.round(leftAngle) : null,
    rightAngle: Number.isFinite(rightAngle) ? Math.round(rightAngle) : null,
    repCount,
    stage,
    feedback: buildCurlFeedback(landmarks, leftAngle, rightAngle),
    confidence,
  };
}

export default function MovementLabPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const stageRef = useRef<Stage>("down");
  const repCountRef = useRef(0);
  const lastRepAtRef = useRef(0);

  const [exerciseMode, setExerciseMode] = useState<ExerciseMode>("biceps_curl");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MovementAnalysis>({
    label: "Rosca Direta",
    leftAngle: null,
    rightAngle: null,
    repCount: 0,
    stage: "down",
    feedback: ["Permita o acesso à câmera e fique de frente para o celular ou notebook."],
    confidence: "low",
  });

  const confidenceVisual = useMemo(() => {
    if (analysis.confidence === "high") {
      return { bg: COLORS.primarySoft, border: COLORS.borderStrong, color: COLORS.lime, label: "Leitura boa" };
    }
    if (analysis.confidence === "medium") {
      return { bg: COLORS.yellowSoft, border: COLORS.yellowBorder, color: "#FFD36C", label: "Leitura razoável" };
    }
    return { bg: COLORS.redSoft, border: COLORS.redBorder, color: "#FFB4B4", label: "Ajuste a câmera" };
  }, [analysis.confidence]);

  const metricLabels = useMemo(() => {
    if (exerciseMode === "shoulder_press") {
      return {
        left: "Braco esquerdo",
        right: "Braco direito",
        stageUp: "Press",
        stageDown: "Base",
      };
    }

    if (exerciseMode === "squat") {
      return {
        left: "Joelho esquerdo",
        right: "Joelho direito",
        stageUp: "Subida",
        stageDown: "Descida",
      };
    }

    return {
      left: "Cotovelo esquerdo",
      right: "Cotovelo direito",
      stageUp: "Subida",
      stageDown: "Descida",
    };
  }, [exerciseMode]);

  useEffect(() => {
    repCountRef.current = 0;
    stageRef.current = "down";
    lastRepAtRef.current = 0;
    setAnalysis((current) => ({
      ...current,
      label:
        exerciseMode === "biceps_curl"
          ? "Rosca Direta"
          : exerciseMode === "shoulder_press"
            ? "Desenvolvimento de Ombros"
            : "Agachamento",
      leftAngle: null,
      rightAngle: null,
      repCount: 0,
      stage: "down",
      feedback: ["Preparando leitura do novo exercício..."],
      confidence: "low",
    }));
  }, [exerciseMode]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        setCameraStatus("loading");
        setErrorMessage(null);
        await Promise.all(MEDIAPIPE_SCRIPTS.map((src) => loadScript(src)));
        if (cancelled) return;

        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;

        if (!videoElement || !canvasElement || !window.Pose || !window.Camera) {
          throw new Error("Nao foi possivel preparar a webcam ou o MediaPipe.");
        }

        const ctx = canvasElement.getContext("2d");
        if (!ctx) {
          throw new Error("Nao foi possivel preparar o canvas de desenho.");
        }

        const pose = new window.Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        pose.onResults((results: PoseResult) => {
          ctx.save();
          ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
          if ((results as any).image) {
            ctx.drawImage((results as any).image, 0, 0, canvasElement.width, canvasElement.height);
          }

          const landmarks = results.poseLandmarks || [];
          if (landmarks.length && window.drawConnectors && window.drawLandmarks && window.POSE_CONNECTIONS) {
            window.drawConnectors(ctx, landmarks, window.POSE_CONNECTIONS, {
              color: "#22C55E",
              lineWidth: 4,
            });
            window.drawLandmarks(ctx, landmarks, {
              color: "#22C55E",
              lineWidth: 1,
              radius: 4,
            });
          }

          if (landmarks.length >= 25) {
            const leftAngle =
              exerciseMode === "squat"
                ? angleBetween(landmarks[23], landmarks[25], landmarks[27])
                : angleBetween(landmarks[11], landmarks[13], landmarks[15]);
            const rightAngle =
              exerciseMode === "squat"
                ? angleBetween(landmarks[24], landmarks[26], landmarks[28])
                : angleBetween(landmarks[12], landmarks[14], landmarks[16]);
            const avgAngle = average([leftAngle, rightAngle]);
            let nextStage = stageRef.current;

            const now = Date.now();
            const cooldownMs = 900;

            if (avgAngle !== null) {
              if (exerciseMode === "squat") {
                const kneesBalanced = leftAngle !== null && rightAngle !== null && Math.abs(leftAngle - rightAngle) < 18;
                if (avgAngle > 155 && kneesBalanced) {
                  nextStage = "down";
                }
                if (
                  avgAngle < 95 &&
                  kneesBalanced &&
                  stageRef.current === "down" &&
                  now - lastRepAtRef.current > cooldownMs
                ) {
                  nextStage = "up";
                  repCountRef.current += 1;
                  lastRepAtRef.current = now;
                }
              } else if (exerciseMode === "shoulder_press") {
                const balancedPress = leftAngle !== null && rightAngle !== null && Math.abs(leftAngle - rightAngle) < 16;
                const bothAtBottom =
                  leftAngle !== null &&
                  rightAngle !== null &&
                  leftAngle < 95 &&
                  rightAngle < 95;
                const bothAtTop =
                  leftAngle !== null &&
                  rightAngle !== null &&
                  leftAngle > 150 &&
                  rightAngle > 150;

                if (bothAtBottom && balancedPress) {
                  nextStage = "down";
                }
                if (
                  bothAtTop &&
                  balancedPress &&
                  stageRef.current === "down" &&
                  now - lastRepAtRef.current > cooldownMs
                ) {
                  nextStage = "up";
                  repCountRef.current += 1;
                  lastRepAtRef.current = now;
                }
              } else {
                const balancedCurl = leftAngle !== null && rightAngle !== null && Math.abs(leftAngle - rightAngle) < 20;
                if (avgAngle > 150 && balancedCurl) {
                  nextStage = "down";
                }
                if (
                  avgAngle < 55 &&
                  balancedCurl &&
                  stageRef.current === "down" &&
                  now - lastRepAtRef.current > cooldownMs
                ) {
                  nextStage = "up";
                  repCountRef.current += 1;
                  lastRepAtRef.current = now;
                }
              }
            }

            stageRef.current = nextStage;
            const visibility = average([
              landmarks[11]?.visibility ?? null,
              landmarks[12]?.visibility ?? null,
              landmarks[13]?.visibility ?? null,
              landmarks[14]?.visibility ?? null,
              landmarks[15]?.visibility ?? null,
              landmarks[16]?.visibility ?? null,
            ]);

            setAnalysis(
              buildAnalysisForExercise(
                exerciseMode,
                landmarks,
                repCountRef.current,
                nextStage,
                visibility && visibility > 0.8 ? "high" : visibility && visibility > 0.55 ? "medium" : "low"
              )
            );
          } else {
            setAnalysis((current) => ({
              ...current,
              confidence: "low",
              feedback: ["Ajuste o enquadramento para aparecer dos ombros ao quadril."],
            }));
          }

          ctx.restore();
        });

        const camera = new window.Camera(videoElement, {
          onFrame: async () => {
            if (videoElement.readyState >= 2) {
              const canvas = canvasRef.current;
              if (canvas) {
                canvas.width = videoElement.videoWidth || 960;
                canvas.height = videoElement.videoHeight || 540;
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
        if (!cancelled) {
          setCameraStatus("ready");
        }
      } catch (error: any) {
        console.error(error);
        if (!cancelled) {
          setCameraStatus("error");
          setErrorMessage(error?.message || "Nao foi possivel iniciar a webcam experimental.");
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      const mediaStream = videoRef.current?.srcObject as MediaStream | null;
      mediaStream?.getTracks().forEach((track) => track.stop());
      if (cameraRef.current?.stop) {
        cameraRef.current.stop();
      }
      poseRef.current = null;
      cameraRef.current = null;
    };
  }, [exerciseMode]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card style={{ background: COLORS.panelDeep, borderColor: COLORS.borderStrong }}>
        <SectionTitle
          eyebrow="Lab de Movimento"
          title="Correção experimental com webcam + MediaPipe"
          subtitle="Essa tela é um espaço de experimentação para leitura de movimento em tempo real. O primeiro exercício disponível é Rosca Direta, com contagem de repetições e alertas básicos de execução."
        />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, .85fr)", gap: 16 }}>
        <Card>
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{analysis.label}</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                  {exerciseMode === "biceps_curl"
                    ? "Fique com ombros, cotovelos e quadril visíveis. A leitura usa ângulo do cotovelo e estabilidade do tronco para sugerir correções."
                    : exerciseMode === "shoulder_press"
                      ? "Mostre tronco e braços inteiros. A leitura acompanha a linha de subida e a estabilidade do desenvolvimento."
                      : "Posicione a câmera para mostrar do tronco aos pés. A leitura observa joelhos, quadril e inclinação do tronco no agachamento."}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 999,
                  padding: "8px 12px",
                  background: confidenceVisual.bg,
                  border: `1px solid ${confidenceVisual.border}`,
                  color: confidenceVisual.color,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {confidenceVisual.label}
              </div>
            </div>

            <div
              style={{
                position: "relative",
                borderRadius: 22,
                overflow: "hidden",
                border: `1px solid ${COLORS.borderStrong}`,
                minHeight: 420,
                background: "linear-gradient(180deg, rgba(10,14,12,.98), rgba(14,18,15,.98))",
              }}
            >
              <video ref={videoRef} playsInline muted style={{ display: "none" }} />
              <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

              <div
                style={{
                  position: "absolute",
                  left: 16,
                  top: 16,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.05)",
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {cameraStatus === "ready"
                    ? "Webcam ativa"
                    : cameraStatus === "loading"
                      ? "Iniciando webcam..."
                      : cameraStatus === "error"
                        ? "Falha na webcam"
                        : "Aguardando"}
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: `1px solid ${COLORS.redBorder}`,
                  background: COLORS.redSoft,
                  color: "#FFD6D6",
                  lineHeight: 1.6,
                }}
              >
                {errorMessage}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                Exercício em teste
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["biceps_curl", "Rosca Direta"],
                  ["shoulder_press", "Desenvolvimento"],
                  ["squat", "Agachamento"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setExerciseMode(value as ExerciseMode)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: exerciseMode === value ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                      background: exerciseMode === value ? COLORS.primarySoft : COLORS.panelSoft,
                      color: COLORS.text,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Leitura em tempo real</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                    {metricLabels.left}
                  </div>
                  <div style={{ color: COLORS.text, fontSize: 24, fontWeight: 700 }}>
                    {analysis.leftAngle ?? "--"}°
                  </div>
                </div>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                    {metricLabels.right}
                  </div>
                  <div style={{ color: COLORS.text, fontSize: 24, fontWeight: 700 }}>
                    {analysis.rightAngle ?? "--"}°
                  </div>
                </div>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                    Repetições
                  </div>
                  <div style={{ color: COLORS.text, fontSize: 24, fontWeight: 700 }}>
                    {analysis.repCount}
                  </div>
                </div>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                    Fase
                  </div>
                  <div style={{ color: COLORS.text, fontSize: 24, fontWeight: 700 }}>
                    {analysis.stage === "up" ? metricLabels.stageUp : metricLabels.stageDown}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Correções sugeridas</div>
              <div style={{ display: "grid", gap: 10 }}>
                {analysis.feedback.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.panelSoft,
                      color: COLORS.muted,
                      lineHeight: 1.6,
                    }}
                  >
                    <div
                      style={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: 999,
                        background: COLORS.primarySoft,
                        color: COLORS.lime,
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                      }}
                    >
                      !
                    </div>
                    <div>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Notas do experimento</div>
              <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                Esta é uma versão inicial. Ela já ajuda a testar webcam, landmarks do Pose e correções básicas de Rosca Direta, mas ainda não substitui orientação humana.
              </div>
              <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                Próximos passos naturais: adicionar lado preferencial, mais exercícios, gravação de sessão e regras mais robustas de biomecânica.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
