import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { loadAnswers } from "./onboarding/onboardingStorage";
import { getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";
import { addXp, registerDailyCheckin } from "./gamification";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import { addWorkoutHistoryEntry } from "./workoutHistory";
import { COLORS } from "../../styles/colors";
import { useDailyCondition } from "../../features/dailyCheckin/useDailyCondition";
import { buildDailyWorkoutRecommendation, getWorkoutRoute } from "../../features/training/dailyWorkoutAdapter";
import { resolveSupportVideoForActivity } from "./trainingSupportVideos";

type ReadinessLevel = "green" | "yellow" | "red";
type RecommendationMode =
  | "train_moderate"
  | "train_light"
  | "mobility_recovery"
  | "cardio_low"
  | "no_training"
  | "medical_attention";

type DailySignals = {
  wokeUpFeeling: "great" | "ok" | "tired";
  sleepQuality: "good" | "regular" | "poor";
  stressLevel: "low" | "medium" | "high";
  sorenessLevel: "low" | "medium" | "high";
  glucoseStatus: "normal" | "elevated" | "critical";
  bloodPressureStatus: "normal" | "elevated" | "critical";
  symptoms: Array<"none" | "headache" | "dizziness" | "nausea" | "palpitations">;
  timeAvailable: "10-15" | "20-30" | "30-45" | "60+";
  preferredContext: "home" | "gym" | "outdoor";
};

type SelectableStrengthGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core";

type MetabolicRecommendation = {
  level: ReadinessLevel;
  mode: RecommendationMode;
  title: string;
  summary: string;
  rationale: string[];
  actions: string[];
  warnings: string[];
  workoutPlan: {
    focus: string;
    duration: string;
    intensity: string;
    blocks: Array<{
      title: string;
      exercises: string[];
    }>;
    closingNote: string;
  } | null;
};

const defaultSignals: DailySignals = {
  wokeUpFeeling: "ok",
  sleepQuality: "regular",
  stressLevel: "medium",
  sorenessLevel: "low",
  glucoseStatus: "normal",
  bloodPressureStatus: "normal",
  symptoms: ["none"],
  timeAvailable: "20-30",
  preferredContext: "home",
};

const groupLabelMap: Record<MuscleGroup, string> = {
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
      {subtitle ? <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 780 }}>{subtitle}</div> : null}
    </div>
  );
}

function ChoicePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
        background: active ? COLORS.primarySoft : "#FAFAFA",
        color: COLORS.text,
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function getLevelVisual(level: ReadinessLevel) {
  if (level === "green") {
    return {
      label: "Prontidão alta",
      background: "rgba(34,197,94,.14)",
      border: COLORS.borderStrong,
      color: COLORS.lime,
    };
  }
  if (level === "yellow") {
    return {
      label: "Prontidão ajustada",
      background: COLORS.yellowSoft,
      border: COLORS.yellowBorder,
      color: "#FFD36C",
    };
  }
  return {
    label: "Alerta metabólico",
    background: COLORS.redSoft,
    border: COLORS.redBorder,
    color: "#FF9C9C",
  };
}

function buildMetabolicRecommendation(
  signals: DailySignals,
  yesterdayGroups: MuscleGroup[],
  selectedGroups: SelectableStrengthGroup[],
  context: {
    fitnessGoal?: string;
    experienceLevel?: string;
    onboardingTrainingPlace?: string;
    onboardingDaysPerWeek?: number;
  }
): MetabolicRecommendation {
  const rationale: string[] = [];
  const warnings: string[] = [];

  if (signals.wokeUpFeeling === "tired") rationale.push("Você relatou acordar cansado.");
  if (signals.sleepQuality === "poor") rationale.push("Seu sono de ontem foi ruim.");
  if (signals.stressLevel === "high") rationale.push("Seu estresse está alto hoje.");
  if (signals.sorenessLevel === "high") rationale.push("Há fadiga muscular relevante.");
  if (yesterdayGroups.length) {
    rationale.push(`Ontem houve estímulo em ${yesterdayGroups.map((group) => groupLabelMap[group]).join(", ")}.`);
  }
  if (context.fitnessGoal) rationale.push(`Objetivo principal em foco: ${context.fitnessGoal}.`);
  if (context.experienceLevel) rationale.push(`Nível atual considerado: ${context.experienceLevel}.`);

  const symptomRisk = signals.symptoms.some((symptom) => symptom !== "none");
  const criticalVitals =
    signals.glucoseStatus === "critical" || signals.bloodPressureStatus === "critical";
  const elevatedVitals =
    signals.glucoseStatus === "elevated" || signals.bloodPressureStatus === "elevated";

  const availableStrengthFocus = (["chest", "back", "legs", "shoulders", "arms", "core"] as SelectableStrengthGroup[]).filter(
    (group) => !yesterdayGroups.includes(group)
  );
  const preferredAvailableGroups = selectedGroups.filter((group) => !yesterdayGroups.includes(group));
  const fallbackGroups = selectedGroups.length ? selectedGroups : availableStrengthFocus;
  const resolvedGroups = (preferredAvailableGroups.length ? preferredAvailableGroups : fallbackGroups).slice(
    0,
    signals.timeAvailable === "60+" ? 3 : signals.timeAvailable === "30-45" ? 2 : 1
  );
  const primaryFocus = resolvedGroups[0] || "core";
  const isUltraShort = signals.timeAvailable === "10-15";
  const isShort = signals.timeAvailable === "20-30";
  const timeLabelMap: Record<DailySignals["timeAvailable"], string> = {
    "10-15": "10 a 15 min",
    "20-30": "20 a 30 min",
    "30-45": "30 a 45 min",
    "60+": "60+ min",
  };

  function buildGymStrengthPlan(focus: SelectableStrengthGroup) {
    const plans: Record<string, { focus: string; blocks: Array<{ title: string; exercises: string[] }>; closingNote: string }> = {
      chest: {
        focus: "Peito e empurrada",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              isUltraShort
                ? "2 a 3 min de aquecimento articular + mobilidade de ombro"
                : "5 min de aquecimento articular + mobilidade de ombro",
              isUltraShort
                ? "1 serie leve de supino reto para preparar a carga"
                : "2 series leves de supino reto para preparar a carga",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort
                ? "Supino reto: 3 series de 8 a 10 repeticoes"
                : isShort
                  ? "Supino reto: 4 series de 8 a 10 repeticoes"
                  : "Supino reto: 4 series de 8 a 10 repeticoes",
              isUltraShort
                ? "Supino inclinado: 3 series de 10 repeticoes"
                : isShort
                  ? "Supino inclinado: 3 series de 10 a 12 repeticoes"
                  : "Supino inclinado: 4 series de 10 a 12 repeticoes",
              ...(isUltraShort ? [] : ["Crucifixo ou crossover: 3 series de 12 repeticoes"]),
              ...(isUltraShort
                ? []
                : isShort
                  ? []
                  : ["Flexao controlada: 3 series ate perto da falha tecnica"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    isShort ? "Triceps pulley: 2 series de 12 repeticoes" : "Triceps pulley: 3 series de 12 repeticoes",
                    "Prancha: 3 series de 30 a 40 segundos",
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Descanse entre 60 e 90 segundos e pare a serie se perder controle tecnico.",
      },
      back: {
        focus: "Costas e puxada",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              isUltraShort ? "2 a 3 min de mobilidade toracica e escapular" : "Mobilidade toracica e escapular por 5 min",
              isUltraShort ? "1 serie leve de puxada para ativacao" : "1 a 2 series leves de puxada para ativacao",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Puxada frente: 3 series de 8 a 10 repeticoes" : "Puxada frente: 4 series de 8 a 10 repeticoes",
              isUltraShort
                ? "Remada curvada ou maquina: 3 series de 10 repeticoes"
                : "Remada curvada ou maquina: 4 series de 10 repeticoes",
              ...(isUltraShort ? [] : ["Remada unilateral: 3 series de 12 repeticoes por lado"]),
              ...(isUltraShort || isShort ? [] : ["Face pull: 3 series de 15 repeticoes"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    isShort ? "Rosca direta: 2 series de 12 repeticoes" : "Rosca direta: 3 series de 12 repeticoes",
                    "Dead bug ou hollow hold: 3 series controladas",
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Mantenha a lombar protegida e priorize amplitude com controle.",
      },
      legs: {
        focus: "Pernas e base",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              isUltraShort ? "3 min de mobilidade de quadril, joelho e tornozelo" : "5 min de mobilidade de quadril, joelho e tornozelo",
              isUltraShort ? "1 serie leve de agachamento" : "1 a 2 series leves de agachamento",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Agachamento livre ou guiado: 3 series de 8 a 10 repeticoes" : "Agachamento livre ou guiado: 4 series de 8 a 10 repeticoes",
              isUltraShort ? "Leg press: 3 series de 10 repeticoes" : "Leg press: 4 series de 10 a 12 repeticoes",
              ...(isUltraShort ? [] : ["Afundo ou passada: 3 series de 10 repeticoes por lado"]),
              ...(isUltraShort || isShort ? [] : ["Stiff: 3 series de 10 a 12 repeticoes"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    "Panturrilha em pe: 3 series de 15 repeticoes",
                    "Prancha lateral: 3 series de 30 segundos por lado",
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Foque em tecnica e nao force se houver desconforto articular.",
      },
      shoulders: {
        focus: "Ombros e estabilidade",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              isUltraShort ? "3 min de mobilidade de ombro e escapula" : "Mobilidade de ombro e escapula por 5 min",
              "Elevacoes leves para ativacao",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Desenvolvimento com halteres: 3 series de 8 a 10 repeticoes" : "Desenvolvimento com halteres: 4 series de 8 a 10 repeticoes",
              isUltraShort ? "Elevacao lateral: 3 series de 12 repeticoes" : "Elevacao lateral: 4 series de 12 repeticoes",
              ...(isUltraShort ? [] : ["Elevacao frontal: 3 series de 12 repeticoes"]),
              ...(isUltraShort || isShort ? [] : ["Crucifixo invertido: 3 series de 15 repeticoes"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    "Rotacao externa leve: 3 series de 15 repeticoes",
                    ...(isShort ? [] : ["Farmer walk curta: 3 voltas controladas"]),
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Se o ombro reclamar, reduza carga e privilegie amplitude confortavel.",
      },
      arms: {
        focus: "Bracos e acessorios",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              "Mobilidade de cotovelo e punho por 3 a 5 min",
              "Series leves de rosca e triceps para ativacao",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Rosca direta: 3 series de 10 repeticoes" : "Rosca direta: 4 series de 10 repeticoes",
              isUltraShort ? "Rosca alternada: 2 series de 12 repeticoes" : "Rosca alternada: 3 series de 12 repeticoes",
              isUltraShort ? "Triceps pulley: 3 series de 10 a 12 repeticoes" : "Triceps pulley: 4 series de 10 a 12 repeticoes",
              ...(isUltraShort ? [] : ["Triceps testa: 3 series de 12 repeticoes"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    "Abdominal curto: 3 series de 15 repeticoes",
                    "Alongamento rapido de bracos e peitoral",
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Volume moderado, sem roubar repeticoes e sem sobrecarregar articulacoes.",
      },
      core: {
        focus: "Core e estabilidade",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              "Respiracao diafragmatica e mobilidade de coluna por 4 min",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              "Prancha frontal: 4 series de 30 a 40 segundos",
              "Dead bug: 3 series de 10 repeticoes por lado",
              "Bird dog: 3 series de 10 repeticoes por lado",
              "Elevacao de pernas controlada: 3 series de 12 repeticoes",
            ],
          },
        ],
        closingNote: "Treino enxuto para manter consistencia sem estourar recuperacao.",
      },
    };
    return plans[focus];
  }

  function buildHomeStrengthPlan(focus: SelectableStrengthGroup) {
    const plans: Record<string, { focus: string; blocks: Array<{ title: string; exercises: string[] }>; closingNote: string }> = {
      chest: {
        focus: "Peito e empurrada em casa",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              isUltraShort ? "2 a 3 min de mobilidade de ombro e escapula" : "3 a 5 min de mobilidade de ombro e escapula",
              isUltraShort ? "1 serie leve de flexao inclinada para ativacao" : "2 series leves de flexao inclinada para ativacao",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Flexao tradicional: 3 series de 10 a 15 repeticoes" : "Flexao tradicional: 4 series de 10 a 15 repeticoes",
              isUltraShort ? "Flexao inclinada: 3 series de 8 a 12 repeticoes" : "Flexao com pes elevados ou inclinada: 4 series de 8 a 12 repeticoes",
              ...(isUltraShort ? [] : ["Flexao com pausa no fundo: 3 series de 8 a 10 repeticoes"]),
              ...(isUltraShort || isShort ? [] : ["Prancha com toque no ombro: 3 series de 20 toques"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    "Triceps no banco ou cadeira: 3 series de 12 repeticoes",
                    "Alongamento rapido de peito e ombros por 3 min",
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Controle o tempo da repeticao e use mochila com carga apenas se estiver muito facil.",
      },
      back: {
        focus: "Costas e postura em casa",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              "Mobilidade toracica e escapular por 4 min",
              "Ativacao de costas com elastico ou toalha",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Remada com mochila: 3 series de 10 a 12 repeticoes" : "Remada com mochila: 4 series de 10 a 12 repeticoes",
              isUltraShort ? "Pulldown com elastico ou toalha: 3 series de 12 repeticoes" : "Pulldown com elastico ou toalha presa: 4 series de 12 repeticoes",
              ...(isUltraShort ? [] : ["Superman controlado: 3 series de 15 repeticoes"]),
              ...(isUltraShort || isShort ? [] : ["Face pull com elastico: 3 series de 15 repeticoes"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    "Rosca com mochila ou elastico: 3 series de 12 repeticoes",
                    "Dead bug: 3 series de 10 por lado",
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Se nao houver elastico, mantenha foco em postura, mochila e controle do tronco.",
      },
      legs: {
        focus: "Pernas em casa",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              "Mobilidade de quadril, joelho e tornozelo por 5 min",
              "2 series leves de agachamento com peso corporal",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Agachamento livre: 3 series de 15 repeticoes" : "Agachamento livre: 4 series de 15 repeticoes",
              isUltraShort ? "Avanco alternado: 3 series de 10 por lado" : "Avanco alternado: 4 series de 10 repeticoes por lado",
              ...(isUltraShort ? [] : ["Agachamento isometrico na parede: 3 series de 30 a 40 segundos"]),
              isUltraShort ? "Ponte de gluteo: 3 series de 15 repeticoes" : "Ponte de gluteo: 4 series de 15 repeticoes",
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    "Panturrilha em pe: 3 series de 20 repeticoes",
                    "Prancha lateral: 3 series de 30 segundos por lado",
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Se quiser subir carga, use mochila. Se houver dor articular, reduza amplitude.",
      },
      shoulders: {
        focus: "Ombros e estabilidade em casa",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              "Mobilidade de ombro e escapula por 4 min",
              "Elevacoes leves sem carga para ativar",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Desenvolvimento com mochila ou garrafas: 3 series de 10 repeticoes" : "Desenvolvimento com mochila ou garrafas: 4 series de 10 repeticoes",
              isUltraShort ? "Elevacao lateral com garrafas: 3 series de 12 repeticoes" : "Elevacao lateral com garrafas: 4 series de 12 repeticoes",
              ...(isUltraShort ? [] : ["Elevacao frontal: 3 series de 12 repeticoes"]),
              ...(isUltraShort || isShort ? [] : ["Crucifixo invertido inclinado: 3 series de 15 repeticoes"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    "Rotacao externa leve: 3 series de 15 repeticoes",
                    ...(isShort ? [] : ["Farmer walk com sacolas: 3 voltas curtas"]),
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Trabalhe leve e limpo. Ombro aceita bem controle, nao pressa.",
      },
      arms: {
        focus: "Bracos e acessorios em casa",
        blocks: [
          {
            title: "Aquecimento",
            exercises: [
              "Mobilidade de punho, cotovelo e ombro por 3 min",
            ],
          },
          {
            title: "Bloco principal",
            exercises: [
              isUltraShort ? "Rosca com mochila ou elastico: 3 series de 12 repeticoes" : "Rosca com mochila ou elastico: 4 series de 12 repeticoes",
              isUltraShort ? "Rosca martelo com garrafas: 2 series de 12 repeticoes" : "Rosca martelo com garrafas: 3 series de 12 repeticoes",
              isUltraShort ? "Triceps no banco ou cadeira: 3 series de 10 a 12 repeticoes" : "Triceps no banco ou cadeira: 4 series de 10 a 12 repeticoes",
              ...(isUltraShort ? [] : ["Triceps acima da cabeca com garrafa: 3 series de 12 repeticoes"]),
            ],
          },
          ...(!isUltraShort
            ? [
                {
                  title: "Complemento",
                  exercises: [
                    "Abdominal curto: 3 series de 15 repeticoes",
                    "Alongamento de bracos e ombro por 3 min",
                  ],
                },
              ]
            : []),
        ],
        closingNote: "Se a carga for leve, aumente tempo sob tensao e diminua descanso.",
      },
      core: {
        focus: "Core e estabilidade em casa",
        blocks: [
          {
            title: "Bloco principal",
            exercises: [
              "Prancha frontal: 4 series de 30 a 40 segundos",
              "Dead bug: 3 series de 10 por lado",
              "Bird dog: 3 series de 10 por lado",
              "Abdominal canivete: 3 series de 12 repeticoes",
            ],
          },
        ],
        closingNote: "Treino curto para fortalecer o centro e manter consistencia sem equipamento.",
      },
    };
    return plans[focus];
  }

  function buildOutdoorPlan() {
    return {
      focus: "Condicionamento outdoor",
      blocks: [
        {
          title: "Aquecimento",
          exercises: [
            "5 min de caminhada leve",
            "Mobilidade dinamica de quadril, tornozelo e ombro",
          ],
        },
        {
          title: "Bloco principal",
          exercises:
        signals.timeAvailable === "10-15"
              ? [
                  "3 min de caminhada acelerando aos poucos",
                  "4 tiros de 30 segundos em ritmo forte",
                  "60 a 90 segundos andando entre cada tiro",
                  "2 min finais de caminhada leve",
                ]
              : signals.timeAvailable === "20-30"
                ? [
                    "4 blocos de 3 min de corrida moderada",
                    "2 min de caminhada entre blocos",
                    "5 min finais de desaceleracao",
                  ]
                : [
                    "8 min de caminhada ativa",
                    "20 a 30 min de corrida ou pedal moderado",
                    "4 aceleracoes de 20 segundos se a energia estiver boa",
                    "5 min finais de volta a calma",
                  ],
        },
      ],
      closingNote: "Outdoor sem maquinario: hoje a IA prioriza locomocao, ritmo e recuperacao cardiovascular.",
    };
  }

  function buildCombinedPlan(groups: SelectableStrengthGroup[]) {
    if (signals.preferredContext === "outdoor") {
      return buildOutdoorPlan();
    }

    const planBuilder = signals.preferredContext === "gym" ? buildGymStrengthPlan : buildHomeStrengthPlan;
    const chosenGroups = groups.length ? groups : [primaryFocus];
    const perGroupExerciseLimit =
      signals.timeAvailable === "60+" ? 2 : signals.timeAvailable === "30-45" ? 2 : 1;

    const blocks = chosenGroups.map((group, index) => {
      const plan = planBuilder(group);
      const mainBlock = plan.blocks.find((block) => block.title === "Bloco principal") || plan.blocks[0];

      return {
        title: `${index + 1}. ${plan.focus}`,
        exercises: mainBlock.exercises.slice(0, perGroupExerciseLimit),
      };
    });

    const warmup = signals.preferredContext === "gym"
      ? ["5 min de aquecimento geral + mobilidade das articulacoes que vao trabalhar hoje"]
      : ["4 a 5 min de aquecimento global com mobilidade e ativacao leve"];

    const finisher =
      signals.timeAvailable === "60+"
        ? ["Core rapido: 3 series de prancha de 30 a 40 segundos", "Desaceleracao e alongamento por 5 min"]
        : ["Desaceleracao e alongamento por 3 a 5 min"];

    return {
      focus: chosenGroups.map((group) => groupLabelMap[group]).join(" + "),
      blocks: [
        {
          title: "Aquecimento",
          exercises: warmup,
        },
        ...blocks,
        {
          title: "Fechamento",
          exercises: finisher,
        },
      ],
      closingNote:
        "Sessao combinada do dia: a IA distribuiu o volume entre os grupos escolhidos para caber no tempo disponivel sem virar uma ficha longa demais.",
    };
  }

  function buildRecoveryPlan(): MetabolicRecommendation["workoutPlan"] {
    return {
      focus: signals.preferredContext === "outdoor" ? "Cardio leve de recuperacao" : "Mobilidade e recuperacao",
      duration: timeLabelMap[signals.timeAvailable],
      intensity: "Leve",
      blocks:
        signals.preferredContext === "outdoor"
          ? [
              {
                title: "Sessao sugerida",
                exercises: [
                  "5 min de aquecimento caminhando leve",
                  "20 a 30 min de caminhada ou pedal em ritmo confortavel",
                  "5 min finais desacelerando e respirando",
                ],
              },
            ]
          : [
              {
                title: "Sessao sugerida",
                exercises: [
                  "5 min de mobilidade global",
                  "3 series de alongamento dinamico para quadril, torax e ombros",
                  "10 min de ativacao leve de core e gluteos",
                  "5 min finais de respiracao e relaxamento",
                ],
              },
            ],
      closingNote: "Hoje o objetivo e sair melhor do que entrou, nao bater recorde.",
    };
  }

  function buildNoTrainingPlan(note: string): MetabolicRecommendation["workoutPlan"] {
    return {
      focus: "Sem treino prescrito",
      duration: "Hoje sem sessao de treino",
      intensity: "Recuperacao",
      blocks: [
        {
          title: "Conduta do dia",
          exercises: [
            "Hidratacao e observacao dos sinais",
            "Descanso ativo leve apenas se estiver confortavel",
            "Reavaliacao antes de qualquer esforco",
          ],
        },
      ],
      closingNote: note,
    };
  }

  if (criticalVitals || symptomRisk) {
    if (criticalVitals) {
      warnings.push("Seus marcadores de glicose ou pressão foram informados em zona crítica.");
    }
    if (symptomRisk) {
      warnings.push("Você relatou sintomas que pedem mais cautela hoje.");
    }

    return {
      level: "red",
      mode: criticalVitals ? "medical_attention" : "no_training",
      title: criticalVitals ? "Hoje o foco é segurança, não treino." : "Hoje a melhor decisão é não treinar.",
      summary: criticalVitals
        ? "A IA priorizou proteção metabólica e recomendou interromper esforço intenso até reavaliar seus sinais."
        : "Seus sinais do dia não combinam com treino produtivo. Recuperação e observação têm mais valor agora.",
      rationale,
      actions: criticalVitals
        ? [
            "Evite treino hoje.",
            "Hidrate-se e reavalie seus sinais depois.",
            "Se persistir, procure orientação médica.",
          ]
        : [
            "Troque o treino por descanso ativo leve.",
            "Observe sintomas ao longo do dia.",
            "Se piorar, suspenda esforço e busque avaliação.",
          ],
      warnings,
      workoutPlan: buildNoTrainingPlan(
        criticalVitals
          ? "Hoje a IA nao prescreve treino. O mais importante e proteger seu estado geral e buscar ajuda se os sinais persistirem."
          : "Hoje o foco e recuperacao e vigilancia dos sintomas antes de voltar a treinar."
      ),
    };
  }

  if (
    signals.wokeUpFeeling === "tired" ||
    signals.sleepQuality === "poor" ||
    signals.stressLevel === "high" ||
    signals.sorenessLevel === "high" ||
    elevatedVitals
  ) {
    if (elevatedVitals) warnings.push("Há sinal de glicose ou pressão acima do ideal para alta intensidade.");

    return {
      level: "yellow",
      mode: signals.preferredContext === "outdoor" ? "cardio_low" : "mobility_recovery",
      title:
        signals.preferredContext === "outdoor"
          ? "Hoje vale cardio leve com controle."
          : "Hoje seu corpo responde melhor a recuperação guiada.",
      summary:
        signals.preferredContext === "outdoor"
          ? "A sugestão do dia é manter movimento, mas sem puxar intensidade. O objetivo é preservar consistência."
          : "A IA reduziu carga e impacto. Mobilidade, alongamento e ativação leve entregam mais do que insistir em força hoje.",
      rationale,
      actions:
        signals.preferredContext === "outdoor"
          ? [
              "Faça caminhada ou pedal leve.",
              "Mantenha a sessão curta e monitorada.",
              "Reveja energia e sintomas depois do treino.",
            ]
          : [
              "Priorize aquecimento, mobilidade e alongamento.",
              "Evite grupos musculares exigidos ontem.",
              "Reavalie sua disposição antes de voltar à carga.",
            ],
      warnings,
      workoutPlan: buildRecoveryPlan(),
    };
  }

  const contextPlan =
    resolvedGroups.length > 1
      ? buildCombinedPlan(resolvedGroups)
      : signals.preferredContext === "gym"
        ? buildGymStrengthPlan(primaryFocus)
        : signals.preferredContext === "home"
          ? buildHomeStrengthPlan(primaryFocus)
          : buildOutdoorPlan();

  return {
    level: "green",
    mode: signals.preferredContext === "gym" ? "train_moderate" : "train_light",
      title:
        signals.preferredContext === "gym"
          ? `Hoje você está liberado para um treino moderado de ${resolvedGroups.map((group) => groupLabelMap[group]).join(" + ")}.`
          : signals.preferredContext === "home"
            ? `Hoje você pode treinar ${resolvedGroups.map((group) => groupLabelMap[group]).join(" + ")} em casa com boa margem de segurança.`
            : "Hoje você pode fazer um treino outdoor com boa margem de segurança.",
    summary:
      signals.preferredContext === "gym"
        ? "Seus sinais estão consistentes para um treino de força controlado, respeitando recuperação e tempo disponível."
        : signals.preferredContext === "home"
          ? "Seu estado do dia favorece uma sessão produtiva em casa, sem depender de maquinario."
          : "Seu estado do dia favorece uma sessao outdoor focada em ritmo, consistencia e condicionamento.",
    rationale,
    actions:
      signals.preferredContext === "gym"
        ? [
            "Faça um treino moderado de força.",
            "Evite repetir exatamente os grupos de ontem.",
            "Finalize com mobilidade curta.",
          ]
        : [
            "Siga um treino em casa ou cardio estruturado.",
            "Use o tempo disponível para manter qualidade.",
            "Se houver queda de energia, reduza intensidade.",
          ],
    warnings,
    workoutPlan: {
      focus: contextPlan.focus,
      duration: timeLabelMap[signals.timeAvailable],
      intensity:
        signals.preferredContext === "gym"
          ? "Moderada"
          : signals.preferredContext === "home"
            ? "Leve a moderada"
            : "Cardio progressivo",
      blocks: contextPlan.blocks,
      closingNote: contextPlan.closingNote,
    },
  };
}

export default function SuggestedTrainingPage() {
  const navigate = useNavigate();
  const { user, id } = useAuth();
  const { condition } = useDailyCondition();
  const userId = (id ?? "").trim().toLowerCase();
  const onboarding = useMemo(() => (userId ? loadAnswers(userId) : null), [userId]);
  const yesterdayGroups = useMemo(() => getYesterdayMuscleGroups(), []);
  const [selectedGroups, setSelectedGroups] = useState<SelectableStrengthGroup[]>([]);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [exerciseXpEarned, setExerciseXpEarned] = useState(0);
  const [groupMessage, setGroupMessage] = useState<string | null>(null);
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null);
  const [showWorkoutWidget, setShowWorkoutWidget] = useState(false);
  const [signals, setSignals] = useState<DailySignals>(() => ({
    ...defaultSignals,
    timeAvailable: onboarding?.timePerDay || defaultSignals.timeAvailable,
    preferredContext:
      onboarding?.trainingPlace === "gym"
        ? "gym"
        : onboarding?.trainingPlace === "both"
          ? "outdoor"
          : "home",
  }));

  const recommendation = useMemo(
    () =>
      buildMetabolicRecommendation(signals, yesterdayGroups, selectedGroups, {
        fitnessGoal: user?.fitnessGoal,
        experienceLevel: user?.experienceLevel,
        onboardingTrainingPlace: onboarding?.trainingPlace,
        onboardingDaysPerWeek: onboarding?.daysPerWeek,
      }),
    [onboarding?.daysPerWeek, onboarding?.trainingPlace, selectedGroups, signals, user?.experienceLevel, user?.fitnessGoal, yesterdayGroups]
  );
  const adaptiveWorkout = useMemo(
    () =>
      buildDailyWorkoutRecommendation({
        condition,
        user,
        onboarding,
      }),
    [condition, onboarding, user]
  );
  const primaryAdaptiveWorkout =
    adaptiveWorkout.recommendations.find((item) => item.type === adaptiveWorkout.primaryRecommendationType) ??
    adaptiveWorkout.recommendations[0];
  const alternativeAdaptiveWorkout =
    adaptiveWorkout.recommendations.find((item) => item.type !== adaptiveWorkout.primaryRecommendationType) ??
    adaptiveWorkout.recommendations[1];

  const readinessVisual = getLevelVisual(recommendation.level);
  const maxSelectableGroups =
    signals.timeAvailable === "60+" ? 3 : signals.timeAvailable === "30-45" ? 2 : 1;
  const totalExercises = recommendation.workoutPlan
    ? recommendation.workoutPlan.blocks.reduce((sum, block) => sum + block.exercises.length, 0)
    : 0;
  const allExercisesCompleted = totalExercises > 0 && completedExercises.length === totalExercises;

  function openSupportVideo(activity: string, workoutFocus?: string) {
    const support = resolveSupportVideoForActivity(activity, workoutFocus);
    if (!support) return;

    navigate(
      `/app/user/treinos/player/support-video?videoId=${encodeURIComponent(support.video.videoId)}&title=${encodeURIComponent(
        `${activity} · apoio`
      )}&durationMin=${support.video.durationMin}&returnTo=${encodeURIComponent("/app/user/suggested-training")}`
    );
  }

  function toggleSymptom(symptom: Exclude<DailySignals["symptoms"][number], "none">) {
    setSignals((current) => {
      const currentSymptoms = current.symptoms.filter((item) => item !== "none");
      const exists = currentSymptoms.includes(symptom);
      const nextSymptoms = exists
        ? currentSymptoms.filter((item) => item !== symptom)
        : [...currentSymptoms, symptom];

      return {
        ...current,
        symptoms: nextSymptoms.length ? nextSymptoms : ["none"],
      };
    });
  }

  function toggleGroup(group: SelectableStrengthGroup) {
    if (yesterdayGroups.includes(group)) {
      return;
    }

    setSelectedGroups((current) => {
      if (current.includes(group)) {
        setGroupMessage(null);
        return current.filter((item) => item !== group);
      }

      if (current.length >= maxSelectableGroups) {
        setGroupMessage(
          maxSelectableGroups === 1
            ? "Com esse tempo disponível, escolha apenas 1 grupo muscular."
            : `Com ${signals.timeAvailable} minutos, a IA aceita até ${maxSelectableGroups} grupos musculares.`
        );
        return current;
      }

      setGroupMessage(null);
      return [...current, group];
    });
  }

  function toggleExerciseComplete(exerciseKey: string) {
    setCompletedExercises((current) => {
      if (current.includes(exerciseKey)) {
        return current.filter((item) => item !== exerciseKey);
      }

      addXp(5);
      setExerciseXpEarned((value) => value + 5);
      return [...current, exerciseKey];
    });
  }

  async function handleCompleteTraining() {
    if (!recommendation.workoutPlan) {
      return;
    }

    const workoutId = `ai-plan-${Date.now()}`;
    const workoutTitle = `IA do dia • ${recommendation.workoutPlan.focus}`;
    const workoutGroups: MuscleGroup[] = selectedGroups.length
      ? [...selectedGroups]
      : recommendation.workoutPlan.focus.toLowerCase().includes("cardio")
        ? ["cardio"]
        : ["core"];

    addWorkoutHistoryEntry({
      workoutId,
      title: workoutTitle,
      muscleGroups: workoutGroups,
      date: new Date().toISOString(),
    });

    const checkin = registerDailyCheckin("workout", 0);
    setTrainingMessage(
      checkin.alreadyCheckedIn
        ? `Treino concluído. ${exerciseXpEarned} XP vieram dos exercícios marcados; o check-in de hoje já estava garantido.`
        : `Treino concluído. ${exerciseXpEarned} XP vieram dos exercícios marcados e a sequência do dia foi atualizada.`
    );

    try {
      await persistGamificationCheckin({
        source: "workout",
        xp: exerciseXpEarned,
        workout: {
          workoutId,
          title: workoutTitle,
          muscleGroups: workoutGroups,
        },
      });
    } catch (error) {
      console.error("Failed to persist AI workout completion:", error);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {trainingMessage ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${COLORS.borderStrong}`,
            background: "rgba(34,197,94,.12)",
            color: COLORS.text,
            fontWeight: 600,
          }}
        >
          {trainingMessage}
        </div>
      ) : null}
      <Card style={{ background: COLORS.panelDeep, borderColor: COLORS.borderStrong }}>
        <SectionTitle
          eyebrow="Metabolismo como Serviço"
          title="Seu treino de hoje começa com leitura do estado do corpo."
          subtitle="O plano Black transforma sinais do dia em decisão. Aqui a IA não só escolhe um treino: ela decide se hoje vale acelerar, reduzir, recuperar ou pausar com segurança."
        />
      </Card>

      <Card
        style={{
          borderColor: COLORS.borderStrong,
          background: "linear-gradient(135deg, rgba(34,197,94,.10), rgba(6,182,212,.08), rgba(255,255,255,.98))",
          boxShadow: "0 18px 40px rgba(6,182,212,.08)",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                background: "rgba(34,197,94,.12)",
                color: COLORS.lime,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.1,
              }}
            >
              Today's adaptive recommendation
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, lineHeight: 1.15 }}>
              {primaryAdaptiveWorkout.title}
            </div>
            <div style={{ color: COLORS.muted, lineHeight: 1.7, maxWidth: 760 }}>
              {adaptiveWorkout.message}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, .8fr)", gap: 14 }}>
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "#FFFFFF",
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "inline-flex",
                    borderRadius: 999,
                    padding: "6px 10px",
                    background: "rgba(34,197,94,.12)",
                    color: COLORS.lime,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Recommended · {primaryAdaptiveWorkout.type === "home" ? "Home workout" : "Gym workout"}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.lime }}>
                  {primaryAdaptiveWorkout.scoreImpact} score
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "#F9FAFB" }}>
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.1 }}>Duration</div>
                  <div style={{ marginTop: 6, color: COLORS.text, fontSize: 18, fontWeight: 700 }}>{primaryAdaptiveWorkout.duration} min</div>
                </div>
                <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "#F9FAFB" }}>
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.1 }}>Goal</div>
                  <div style={{ marginTop: 6, color: COLORS.text, fontSize: 18, fontWeight: 700 }}>{primaryAdaptiveWorkout.goal}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "#F9FAFB" }}>
                  <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.1 }}>Intensity</div>
                  <div style={{ marginTop: 6, color: COLORS.text, fontSize: 18, fontWeight: 700 }}>{adaptiveWorkout.intensity}</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {primaryAdaptiveWorkout.exercises.map((exercise) => (
                  <div
                    key={exercise}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: `1px solid ${COLORS.border}`,
                      background: "#FAFAFA",
                      color: COLORS.muted,
                    }}
                    >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        marginTop: 7,
                        borderRadius: 999,
                        background: "#22C55E",
                        flex: "0 0 auto",
                      }}
                    />
                    <div style={{ display: "grid", gap: 8, width: "100%" }}>
                      <div>{exercise}</div>
                      <button
                        type="button"
                        onClick={() => openSupportVideo(exercise, primaryAdaptiveWorkout.title)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: `1px solid ${COLORS.borderStrong}`,
                          background: "rgba(34,197,94,.08)",
                          color: COLORS.text,
                          fontWeight: 700,
                          width: "fit-content",
                          cursor: "pointer",
                        }}
                      >
                        Ver vídeo de apoio no app
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => navigate(getWorkoutRoute(primaryAdaptiveWorkout.type))}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.borderStrong}`,
                    background: "#22C55E",
                    color: "#0A130D",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {primaryAdaptiveWorkout.type === "home" ? `Start ${primaryAdaptiveWorkout.duration} min home workout` : "Go to gym session"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(getWorkoutRoute(alternativeAdaptiveWorkout.type))}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: "#FAFAFA",
                    color: COLORS.text,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {alternativeAdaptiveWorkout.type === "home" ? "Use home alternative" : "Use gym alternative"}
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 18,
                border: `1px solid ${COLORS.border}`,
                background: "#FFFFFF",
                display: "grid",
                gap: 14,
                alignContent: "start",
              }}
            >
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Alternative option
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{alternativeAdaptiveWorkout.title}</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                  {alternativeAdaptiveWorkout.duration} min · {alternativeAdaptiveWorkout.goal} · {alternativeAdaptiveWorkout.scoreImpact}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {alternativeAdaptiveWorkout.exercises.slice(0, 5).map((exercise) => (
                  <div
                    key={exercise}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${COLORS.border}`,
                      background: "#FAFAFA",
                      color: COLORS.muted,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {exercise}
                  </div>
                ))}
              </div>

              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.6 }}>
                Esta camada rápida existe para reduzir fricção: você escolhe entre casa e academia sem precisar passar pelo fluxo completo primeiro.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, .95fr)", gap: 16 }}>
        <Card>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>Estado de hoje</div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                Como você acordou?
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  ["great", "Acordei muito bem"],
                  ["ok", "Acordei normal"],
                  ["tired", "Acordei cansado"],
                ].map(([value, label]) => (
                  <ChoicePill
                    key={value}
                    active={signals.wokeUpFeeling === value}
                    onClick={() => setSignals((current) => ({ ...current, wokeUpFeeling: value as DailySignals["wokeUpFeeling"] }))}
                  >
                    {label}
                  </ChoicePill>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Sono
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    ["good", "Bom"],
                    ["regular", "Regular"],
                    ["poor", "Ruim"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.sleepQuality === value}
                      onClick={() => setSignals((current) => ({ ...current, sleepQuality: value as DailySignals["sleepQuality"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Estresse
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    ["low", "Baixo"],
                    ["medium", "Médio"],
                    ["high", "Alto"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.stressLevel === value}
                      onClick={() => setSignals((current) => ({ ...current, stressLevel: value as DailySignals["stressLevel"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Dor muscular
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    ["low", "Baixa"],
                    ["medium", "Média"],
                    ["high", "Alta"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.sorenessLevel === value}
                      onClick={() => setSignals((current) => ({ ...current, sorenessLevel: value as DailySignals["sorenessLevel"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Tempo disponível
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    ["10-15", "10–15"],
                    ["20-30", "20–30"],
                    ["30-45", "30–45"],
                    ["60+", "60+"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.timeAvailable === value}
                      onClick={() => setSignals((current) => ({ ...current, timeAvailable: value as DailySignals["timeAvailable"] }))}
                    >
                      {label} min
                    </ChoicePill>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Glicose
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["normal", "Normal"],
                    ["elevated", "Alta"],
                    ["critical", "Muito alta"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.glucoseStatus === value}
                      onClick={() => setSignals((current) => ({ ...current, glucoseStatus: value as DailySignals["glucoseStatus"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Pressão
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["normal", "Normal"],
                    ["elevated", "Elevada"],
                    ["critical", "Crítica"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.bloodPressureStatus === value}
                      onClick={() =>
                        setSignals((current) => ({ ...current, bloodPressureStatus: value as DailySignals["bloodPressureStatus"] }))
                      }
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Contexto
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["home", "Em casa"],
                    ["gym", "Academia"],
                    ["outdoor", "Outdoor"],
                  ].map(([value, label]) => (
                    <ChoicePill
                      key={value}
                      active={signals.preferredContext === value}
                      onClick={() => setSignals((current) => ({ ...current, preferredContext: value as DailySignals["preferredContext"] }))}
                    >
                      {label}
                    </ChoicePill>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                Grupos musculares que você quer priorizar hoje
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {(["chest", "back", "legs", "shoulders", "arms", "core"] as SelectableStrengthGroup[]).map((group) => {
                  const disabled = yesterdayGroups.includes(group);
                  const active = selectedGroups.includes(group);

                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => toggleGroup(group)}
                      disabled={disabled}
                      style={{
                        padding: "12px 10px",
                        borderRadius: 14,
                        border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${disabled ? "#F9FAFB" : COLORS.border}`,
                        background: active
                          ? COLORS.primarySoft
                          : disabled
                            ? "#FAFAFA"
                            : "#FAFAFA",
                        color: disabled ? COLORS.mutedSoft : COLORS.text,
                        cursor: disabled ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        textTransform: "capitalize",
                        opacity: disabled ? 0.65 : 1,
                      }}
                    >
                      {groupLabelMap[group]}
                    </button>
                  );
                })}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.6 }}>
                Se você não escolher nada, a IA decide o foco automaticamente. Grupos treinados ontem ficam indisponíveis hoje para respeitar recuperação.
              </div>
              {groupMessage ? (
                <div style={{ color: "#FFD36C", fontSize: 12, lineHeight: 1.6 }}>{groupMessage}</div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                Sintomas de hoje
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["headache", "Dor de cabeça"],
                  ["dizziness", "Tontura"],
                  ["nausea", "Enjoo"],
                  ["palpitations", "Palpitação"],
                ].map(([value, label]) => (
                  <ChoicePill
                    key={value}
                    active={signals.symptoms.includes(value as any)}
                    onClick={() => toggleSymptom(value as Exclude<DailySignals["symptoms"][number], "none">)}
                  >
                    {label}
                  </ChoicePill>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card style={{ background: COLORS.panelDeep, borderColor: readinessVisual.border }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: readinessVisual.background,
                  color: readinessVisual.color,
                  border: `1px solid ${readinessVisual.border}`,
                }}
              >
                {readinessVisual.label}
              </div>

              <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.text }}>{recommendation.title}</div>
              <div style={{ color: COLORS.muted, lineHeight: 1.7 }}>{recommendation.summary}</div>
            </div>
          </Card>

          {recommendation.workoutPlan ? (
            <Card
              style={{
                borderColor: COLORS.borderStrong,
                background: "linear-gradient(180deg, rgba(18,28,21,.98), rgba(12,16,14,.98))",
                boxShadow: "0 24px 60px rgba(0,0,0,.52)",
              }}
            >
              <div style={{ display: "grid", gap: 16 }}>
                <div
                  style={{
                    display: "grid",
                    gap: 16,
                    padding: 18,
                    borderRadius: 22,
                    border: `1px solid ${COLORS.borderStrong}`,
                    background: "linear-gradient(135deg, rgba(15,61,46,.92), rgba(14,22,18,.98))",
                  }}
                >
                  <div style={{ display: "grid", gap: 8 }}>
                    <div
                      style={{
                        display: "inline-flex",
                        width: "fit-content",
                        borderRadius: 999,
                        background: "rgba(34,197,94,.14)",
                        color: COLORS.lime,
                        padding: "8px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 1.1,
                      }}
                    >
                      Plano de hoje
                    </div>
                    <div style={{ fontSize: 14, color: COLORS.mutedSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                      Treino prescrito pela IA
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text, lineHeight: 1.15 }}>
                      {recommendation.workoutPlan.focus}
                    </div>
                    <div style={{ color: COLORS.muted, lineHeight: 1.7, maxWidth: 760 }}>
                      Em vez de apontar para catálogo, a IA já entrega uma sessão pronta para hoje, coerente com seus sinais, contexto e tempo disponível.
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${COLORS.border}`,
                        background: "#F9FAFB",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                        Duracao
                      </div>
                      <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.duration}</div>
                    </div>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${COLORS.border}`,
                        background: "#F9FAFB",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                        Intensidade
                      </div>
                      <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.intensity}</div>
                    </div>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${COLORS.border}`,
                        background: "#F9FAFB",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
                        Blocos
                      </div>
                      <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.blocks.length}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setShowWorkoutWidget(true)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        border: `1px solid ${COLORS.borderStrong}`,
                        background: "#22C55E",
                        color: "#0A130D",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Abrir treino de hoje
                    </button>
                    <div
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        border: `1px solid ${COLORS.border}`,
                        background: "#FAFAFA",
                        color: COLORS.muted,
                        fontWeight: 600,
                      }}
                    >
                      {completedExercises.length}/{totalExercises} exercícios marcados
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Por que a IA chegou nisso</div>
              <div style={{ display: "grid", gap: 10 }}>
                {recommendation.rationale.map((item) => (
                  <div
                    key={item}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: COLORS.panelSoft,
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.muted,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Ação recomendada</div>
              <div style={{ display: "grid", gap: 10 }}>
                {recommendation.actions.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: COLORS.muted }}>
                    <div
                      style={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: 999,
                        background: COLORS.primarySoft,
                        color: COLORS.lime,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 600,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </div>
                    <div style={{ lineHeight: 1.6 }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {recommendation.warnings.length ? (
            <Card style={{ borderColor: COLORS.redBorder, background: "linear-gradient(180deg, rgba(42,20,20,.92), rgba(18,14,14,.96))" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Alertas do dia</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {recommendation.warnings.map((warning) => (
                    <div
                      key={warning}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${COLORS.redBorder}`,
                        background: COLORS.redSoft,
                        color: "#FFD6D6",
                        lineHeight: 1.6,
                      }}
                    >
                      {warning}
                    </div>
                  ))}
                </div>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.6 }}>
                  Este módulo ajuda a interpretar sinais do dia, mas não substitui avaliação médica ou acompanhamento clínico.
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {showWorkoutWidget && recommendation.workoutPlan ? (
        <div
          onClick={() => setShowWorkoutWidget(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 1200,
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(980px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              borderRadius: 24,
              border: `1px solid ${COLORS.borderStrong}`,
              background: "linear-gradient(180deg, rgba(18,28,21,.98), rgba(10,14,12,.99))",
              boxShadow: "0 32px 80px rgba(0,0,0,.6)",
              padding: 20,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    borderRadius: 999,
                    background: "rgba(34,197,94,.14)",
                    color: COLORS.lime,
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1.1,
                  }}
                >
                  Widget do treino
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text }}>{recommendation.workoutPlan.focus}</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                  Treino do dia aberto em foco total para você seguir a sessão, marcar exercícios e concluir sem sair da tela.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowWorkoutWidget(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: `1px solid ${COLORS.border}`,
                  background: "#FAFAFA",
                  color: COLORS.text,
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: `1px solid ${COLORS.border}`,
                  background: "#F9FAFB",
                }}
              >
                <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>Duracao</div>
                <div style={{ marginTop: 8, color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.duration}</div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: `1px solid ${COLORS.border}`,
                  background: "#F9FAFB",
                }}
              >
                <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>Intensidade</div>
                <div style={{ marginTop: 8, color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.intensity}</div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: `1px solid ${COLORS.border}`,
                  background: "#F9FAFB",
                }}
              >
                <div style={{ color: COLORS.mutedSoft, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>Blocos</div>
                <div style={{ marginTop: 8, color: COLORS.text, fontSize: 20, fontWeight: 700 }}>{recommendation.workoutPlan.blocks.length}</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {recommendation.workoutPlan.blocks.map((block, blockIndex) => (
                <div
                  key={block.title}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    border: `1px solid ${COLORS.border}`,
                    background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        minWidth: 30,
                        height: 30,
                        borderRadius: 999,
                        background: COLORS.primarySoft,
                        color: COLORS.lime,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {blockIndex + 1}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{block.title}</div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {block.exercises.map((exercise, exerciseIndex) => {
                      const exerciseKey = `${blockIndex}-${exerciseIndex}-${exercise}`;
                      const checked = completedExercises.includes(exerciseKey);

                      return (
                        <button
                          key={exerciseKey}
                          type="button"
                          onClick={() => toggleExerciseComplete(exerciseKey)}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            color: COLORS.muted,
                            borderRadius: 14,
                            border: `1px solid ${checked ? COLORS.borderStrong : COLORS.border}`,
                            background: checked
                              ? "linear-gradient(135deg, rgba(34,197,94,.18), rgba(16,28,20,.88))"
                              : "#FAFAFA",
                            padding: "12px 14px",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div
                            style={{
                              minWidth: 24,
                              height: 24,
                              borderRadius: 999,
                              background: checked ? "rgba(10,19,13,.72)" : COLORS.primarySoft,
                              color: COLORS.lime,
                              display: "grid",
                              placeItems: "center",
                              fontSize: 11,
                              fontWeight: 600,
                              marginTop: 1,
                            }}
                          >
                            {checked ? "✓" : "+"}
                          </div>
                          <div style={{ lineHeight: 1.6 }}>
                            {exercise}
                            <div style={{ fontSize: 11, color: checked ? COLORS.text : COLORS.mutedSoft, marginTop: 4 }}>
                              {checked ? "Exercício concluído • +5 XP" : "Marcar como concluído • +5 XP"}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openSupportVideo(exercise, recommendation.workoutPlan?.focus);
                              }}
                              style={{
                                marginTop: 8,
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: `1px solid ${COLORS.borderStrong}`,
                                background: "rgba(34,197,94,.08)",
                                color: COLORS.text,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Ver vídeo de apoio
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: "#FAFAFA",
                color: COLORS.muted,
                lineHeight: 1.6,
              }}
            >
              {recommendation.workoutPlan.closingNote}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: 16,
                borderRadius: 18,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "linear-gradient(135deg, rgba(15,61,46,.64), rgba(15,22,18,.92))",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>
                  Progresso da sessão: {completedExercises.length}/{totalExercises} exercícios
                </div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  XP acumulado nesta sessão: {exerciseXpEarned}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCompleteTraining}
                disabled={!allExercisesCompleted}
                style={{
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: `1px solid ${allExercisesCompleted ? COLORS.borderStrong : COLORS.border}`,
                  background: allExercisesCompleted
                    ? "#22C55E"
                    : "#F9FAFB",
                  color: allExercisesCompleted ? "#0A130D" : COLORS.muted,
                  fontWeight: 700,
                  cursor: allExercisesCompleted ? "pointer" : "not-allowed",
                }}
              >
                Concluir treino do dia
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
