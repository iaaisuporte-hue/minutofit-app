export type DailyWorkoutCondition = "tired" | "normal" | "high";
export type WorkoutIntensity = "light" | "moderate" | "intense";
export type WorkoutType = "home" | "gym";
export type WorkoutGoal = "reactivate metabolism" | "build momentum" | "raise metabolic output";
export type PreferredTrainingPlace = "home" | "gym" | "both";

export interface DailyWorkoutEngineInput {
  dailyCondition: DailyWorkoutCondition;
  userProfile: {
    age?: number;
    weight?: number;
    height?: number;
  };
  userHistory: {
    daysWithoutTraining: number;
    workoutsThisWeek: number;
  };
  preferredTrainingPlace?: PreferredTrainingPlace;
}

export interface WorkoutRecommendation {
  type: WorkoutType;
  title: string;
  duration: number;
  goal: WorkoutGoal;
  scoreImpact: string;
  exercises: string[];
}

export interface DailyWorkoutRecommendation {
  state: DailyWorkoutCondition;
  intensity: WorkoutIntensity;
  message: string;
  primaryRecommendationType: WorkoutType;
  recommendations: [WorkoutRecommendation, WorkoutRecommendation];
}

/**
 * Sample React usage:
 *
 * ```tsx
 * const recommendation = generateDailyWorkout({
 *   dailyCondition: condition?.feeling === "energized" ? "high" : condition?.feeling ?? "normal",
 *   userProfile: { weight: user?.weightKg, height: user?.heightCm },
 *   userHistory: { daysWithoutTraining, workoutsThisWeek },
 *   preferredTrainingPlace: onboarding?.trainingPlace,
 * });
 *
 * const primary = recommendation.recommendations.find(
 *   (item) => item.type === recommendation.primaryRecommendationType
 * );
 * ```
 */

const SCORE_IMPACT: Record<WorkoutIntensity, Record<WorkoutType, number>> = {
  light: { home: 4, gym: 6 },
  moderate: { home: 6, gym: 8 },
  intense: { home: 8, gym: 10 },
};

const HOME_LIBRARY = {
  light: ["Marcha no lugar", "Mobilidade", "Agachamento livre", "Elevação de quadril"],
  moderate: ["Polichinelo", "Agachamento livre", "Flexão inclinada", "Avanço reverso", "Dead bug"],
  intense: ["Joelho alto rápido", "Agachamento livre", "Mountain climber", "Avanço reverso", "Flexão inclinada", "Prancha com toque"],
} as const satisfies Record<WorkoutIntensity, string[]>;

const GYM_LIBRARY = {
  light: ["Caminhada na esteira", "Leg press (leve)", "Remada sentada (leve)", "Prancha"],
  moderate: ["Corrida leve na esteira", "Leg press", "Supino", "Remada sentada", "Prancha"],
  intense: ["Intervalos no remo", "Agachamento goblet", "Supino", "Puxada alta", "Levantamento terra com halteres", "Sprint na bike"],
} as const satisfies Record<WorkoutIntensity, string[]>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBaseIntensity(condition: DailyWorkoutCondition): WorkoutIntensity {
  if (condition === "tired") return "light";
  if (condition === "high") return "intense";
  return "moderate";
}

function softenIntensity(intensity: WorkoutIntensity): WorkoutIntensity {
  if (intensity === "intense") return "moderate";
  if (intensity === "moderate") return "light";
  return "light";
}

function getGoal(intensity: WorkoutIntensity, isReactivation: boolean): WorkoutGoal {
  if (isReactivation) return "reactivate metabolism";
  if (intensity === "intense") return "raise metabolic output";
  return "build momentum";
}

function getDuration(
  intensity: WorkoutIntensity,
  type: WorkoutType,
  profile: DailyWorkoutEngineInput["userProfile"],
  history: DailyWorkoutEngineInput["userHistory"],
  lowFrictionStart: boolean
) {
  const base = {
    light: { home: 10, gym: 16 },
    moderate: { home: 16, gym: 22 },
    intense: { home: 22, gym: 28 },
  }[intensity][type];

  let adjusted = base;

  if (history.daysWithoutTraining >= 3) adjusted -= 2;
  if (history.workoutsThisWeek >= 5) adjusted -= 2;
  if (lowFrictionStart) adjusted -= 2;
  if (profile.age && profile.age >= 50) adjusted -= 2;
  if (profile.weight && profile.weight >= 100) adjusted -= 1;
  if (profile.height && profile.height < 155) adjusted -= 1;

  const [min, max] =
    intensity === "light"
      ? type === "home"
        ? [5, 12]
        : [10, 20]
      : intensity === "moderate"
        ? type === "home"
          ? [10, 20]
          : [15, 25]
        : type === "home"
          ? [15, 25]
          : [20, 30];

  return clamp(adjusted, min, max);
}

function buildMessage(condition: DailyWorkoutCondition, intensity: WorkoutIntensity, isReactivation: boolean) {
  if (isReactivation && condition === "high") {
    return "Você ficou alguns dias sem treinar, mas está com energia. Começamos com volume moderado para proteger a consistência.";
  }
  if (isReactivation) {
    return "Você ficou alguns dias sem treinar. A melhor jogada hoje é uma sessão leve de reativação.";
  }
  if (condition === "tired") {
    return "Seu corpo precisa de uma ativação leve hoje para manter o metabolismo em movimento.";
  }
  if (condition === "high") {
    return intensity === "moderate"
      ? "Sua energia está alta, mas o volume foi ajustado para manter a consistência."
      : "Seu corpo está pronto para uma sessão de maior intensidade com trabalho curto e focado.";
  }
  return "Você tem energia suficiente para uma sessão simples de corpo inteiro.";
}

function buildTitle(type: WorkoutType, intensity: WorkoutIntensity, isReactivation: boolean) {
  if (isReactivation) {
    return type === "home" ? "Reativação em casa" : "Reativação na academia";
  }

  if (intensity === "light") {
    return type === "home" ? "Ativação leve em casa" : "Sessão leve na academia";
  }
  if (intensity === "moderate") {
    return type === "home" ? "Circuito simples em casa" : "Circuito completo na academia";
  }
  return type === "home" ? "Sessão intensa em casa" : "Treino metabólico na academia";
}

function getExercises(type: WorkoutType, intensity: WorkoutIntensity, lowFrictionStart: boolean) {
  const base = [...(type === "home" ? HOME_LIBRARY[intensity] : GYM_LIBRARY[intensity])];

  if (!lowFrictionStart) {
    return base;
  }

  if (type === "home" && intensity === "moderate") {
    return ["Marcha no lugar", "Agachamento livre", "Flexão inclinada", "Elevação de quadril"];
  }
  if (type === "gym" && intensity === "moderate") {
    return ["Caminhada na esteira", "Leg press", "Remada sentada", "Prancha"];
  }
  if (type === "home" && intensity === "intense") {
    return ["Joelho alto rápido", "Agachamento livre", "Mountain climber", "Prancha com toque", "Dead bug"];
  }
  if (type === "gym" && intensity === "intense") {
    return ["Intervalos no remo", "Agachamento goblet", "Supino", "Puxada alta", "Prancha"];
  }

  return base;
}

function getPrimaryRecommendationType(
  condition: DailyWorkoutCondition,
  intensity: WorkoutIntensity,
  isReactivation: boolean,
  preferredTrainingPlace?: PreferredTrainingPlace
): WorkoutType {
  if (condition === "tired" || isReactivation) return "home";
  if (preferredTrainingPlace === "home") return "home";
  if (preferredTrainingPlace === "gym") return "gym";
  if (intensity === "intense") return "gym";
  return "home";
}

export function generateDailyWorkout(input: DailyWorkoutEngineInput): DailyWorkoutRecommendation {
  const isReactivation = input.userHistory.daysWithoutTraining >= 3;
  const lowFrictionStart = input.userHistory.workoutsThisWeek === 0 && !isReactivation;

  let intensity = getBaseIntensity(input.dailyCondition);
  if (isReactivation) {
    // Check-in "Disposto" (high) tem prioridade: reativa com volume moderado, não leve
    intensity = input.dailyCondition === "high" ? "moderate" : "light";
  } else if (input.userHistory.workoutsThisWeek >= 5) {
    intensity = softenIntensity(intensity);
  }

  const goal = getGoal(intensity, isReactivation);
  const primaryRecommendationType = getPrimaryRecommendationType(
    input.dailyCondition,
    intensity,
    isReactivation,
    input.preferredTrainingPlace
  );

  const homeWorkout: WorkoutRecommendation = {
    type: "home",
    title: buildTitle("home", intensity, isReactivation),
    duration: getDuration(intensity, "home", input.userProfile, input.userHistory, lowFrictionStart),
    goal,
    scoreImpact: `+${SCORE_IMPACT[intensity].home}`,
    exercises: getExercises("home", intensity, lowFrictionStart),
  };

  const gymWorkout: WorkoutRecommendation = {
    type: "gym",
    title: buildTitle("gym", intensity, isReactivation),
    duration: getDuration(intensity, "gym", input.userProfile, input.userHistory, lowFrictionStart),
    goal,
    scoreImpact: `+${SCORE_IMPACT[intensity].gym}`,
    exercises: getExercises("gym", intensity, lowFrictionStart),
  };

  return {
    state: input.dailyCondition,
    intensity,
    message: buildMessage(input.dailyCondition, intensity, isReactivation),
    primaryRecommendationType,
    recommendations: [homeWorkout, gymWorkout],
  };
}
