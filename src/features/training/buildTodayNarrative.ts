import type { DailyCondition } from "../dailyCheckin/useDailyCondition";
import type { WorkoutIntensity } from "./generateDailyWorkout";
import type { MetabolicData } from "../metabolism/metabolism.types";

export type NarrativeWorkout = {
  isReactivation: boolean;
  intensity: WorkoutIntensity;
  daysWithoutTraining: number;
  workoutsThisWeek: number;
};

export type NarrativeInput = {
  workout: NarrativeWorkout;
  condition: DailyCondition | null;
  metabolism: MetabolicData | null;
  streak: number;
};

export type Narrative = {
  reason: string;
  signals: string[];
  rhythm: string | null;
};

export function buildTodayNarrative({ workout, condition, streak }: NarrativeInput): Narrative {
  const { isReactivation, intensity, daysWithoutTraining, workoutsThisWeek } = workout;
  const details = condition?.details;
  const sleptWell = details?.sleptWell;
  const inPain = details?.inPain;
  const stressed = details?.stressed;
  const feeling = condition?.feeling;
  const nutritionLevel = details?.nutritionLevel;
  const mentalLoadLevel = details?.mentalLoadLevel;

  const absenceSuffix = `${daysWithoutTraining} ${daysWithoutTraining === 1 ? "dia" : "dias"}`;

  let reason: string;
  let signals: string[];

  if (isReactivation && sleptWell === false) {
    reason = `Você dormiu mal e ficou ${absenceSuffix} sem treinar. Hoje, reativação leve.`;
    signals = ["Sono curto", `Ausência ${daysWithoutTraining}d`];
  } else if (isReactivation) {
    reason = `Ficou ${absenceSuffix} sem treinar. Vamos reativar o ritmo com um treino leve.`;
    signals = [`Ausência ${daysWithoutTraining}d`];
  } else if (inPain) {
    reason = "Dor relatada hoje. Treino mais conservador, foco em mobilidade.";
    signals = ["Dor relatada"];
  } else if (stressed && intensity === "light") {
    reason = "Carga emocional alta + sinais de fadiga. Hoje é dia de recuperação ativa.";
    signals = ["Estresse", "Fadiga"];
  } else if (intensity === "intense" && streak >= 3 && sleptWell !== false) {
    reason = "Boa aderência e recuperação. Seu corpo aceita carga hoje.";
    signals = sleptWell === true ? ["Aderência alta", "Sono ok"] : ["Aderência alta"];
  } else if (intensity === "moderate" && feeling === "tired") {
    reason = "Sinais leves de fadiga. Mantemos volume médio com foco em recuperação.";
    signals = ["Fadiga leve"];
  } else if (nutritionLevel === "poor" && intensity === "light") {
    reason = "Alimentação fraca hoje. Volume reduzido para preservar recuperação.";
    signals = [];
  } else if (mentalLoadLevel === "high" && intensity !== "intense") {
    reason = "Carga mental alta. Treino moderado mantido com foco em decompressão.";
    signals = [];
  } else {
    reason = "Treino adaptado ao seu estado atual.";
    signals = [];
  }

  // Sinais opt-in — chip visível apenas quando desfavorável
  if (details?.hydrationOk === false) signals.push("Pouca hidratação");
  if (details?.nutritionLevel === "poor") signals.push("Alimentação fraca");
  if (details?.mentalLoadLevel === "high") signals.push("Carga mental alta");

  let rhythm: string | null = null;
  if (workoutsThisWeek === 0 && streak === 0) {
    rhythm = null;
  } else if (workoutsThisWeek === 0) {
    rhythm = "Retomando frequência";
  } else if (streak >= 7) {
    rhythm = "Boa aderência";
  } else if (streak >= 3) {
    rhythm = "Ritmo consistente";
  } else if (streak >= 1) {
    rhythm = "Ganhando consistência";
  }

  return { reason, signals, rhythm };
}
