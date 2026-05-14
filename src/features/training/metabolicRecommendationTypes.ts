/**
 * Tipos e constantes do motor de recomendação metabólica diária.
 * Extraído de SuggestedTrainingPage para isolar domínio de UI.
 */

export type ReadinessLevel = "green" | "yellow" | "red";

export type RecommendationMode =
  | "train_moderate"
  | "train_light"
  | "mobility_recovery"
  | "cardio_low"
  | "no_training"
  | "medical_attention";

export type DailySignals = {
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

export type SelectableStrengthGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core";

export type MetabolicRecommendation = {
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

export const defaultSignals: DailySignals = {
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
