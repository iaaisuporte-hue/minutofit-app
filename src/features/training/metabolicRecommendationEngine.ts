/**
 * Motor de recomendação metabólica diária.
 * Lógica pura de domínio — sem dependências de UI, sem efeitos colaterais.
 * Extraído de SuggestedTrainingPage para isolar responsabilidade.
 */
import { type MuscleGroup } from "../../pages/user/workoutHistory";
import {
  type DailySignals,
  type MetabolicRecommendation,
  type SelectableStrengthGroup,
} from "./metabolicRecommendationTypes";

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

export function buildMetabolicRecommendation(
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
