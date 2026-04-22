import type {
  MetabolicData,
  MetabolicFactor,
  MetabolicHistory,
  MetabolicHistoryPoint,
  MetabolicTrend,
} from "./metabolism.types";

type EnergyBand = "low" | "moderate" | "high";
type MetabolicStateLabel = "Sleeping" | "Warming up" | "Active" | "Peak";
type InsightTone = "positive" | "neutral" | "alert";
type QuickActionKind = "suggested_training" | "recovery" | "checkin" | "home_workout";
type HistoryMarkerKind = "workout" | "drop";

export interface DerivedEnergyStatus {
  band: EnergyBand;
  energyLabel: string;
  metabolicState: MetabolicStateLabel;
  focus: number;
  energy: number;
  fatBurn: number;
}

export interface MetabolicForecast {
  tomorrowWithActivity: number;
  tomorrowWithoutActivity: number;
  withActivityDelta: number;
  withoutActivityDelta: number;
}

export interface SmartInsightModel {
  title: string;
  message: string;
  tone: InsightTone;
}

export interface QuickActionModel {
  kind: QuickActionKind;
  label: string;
  helper: string;
  route?: string;
}

export interface HistoryMarker {
  date: string;
  kind: HistoryMarkerKind;
  label: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBand(score: number): EnergyBand {
  if (score <= 39) return "low";
  if (score <= 69) return "moderate";
  return "high";
}

function getLabelForBand(band: EnergyBand) {
  if (band === "low") return "Low energy";
  if (band === "moderate") return "Moderate";
  return "High";
}

function sumFactorDelta(factors: MetabolicFactor[]) {
  return factors.reduce((total, factor) => total + factor.delta, 0);
}

export function deriveEnergyStatus(data: MetabolicData | null): DerivedEnergyStatus | null {
  if (!data) return null;

  const score = data.score;
  const band = getBand(score);
  const factorDelta = sumFactorDelta(data.factors);

  let metabolicState: MetabolicStateLabel = "Active";
  if (score <= 32 && data.trend !== "up") {
    metabolicState = "Sleeping";
  } else if (score <= 55 || (score <= 62 && data.trend === "down")) {
    metabolicState = "Warming up";
  } else if (score >= 80 && data.trend !== "down") {
    metabolicState = "Peak";
  }

  const focusBase = score + (data.trend === "up" ? 6 : data.trend === "down" ? -7 : 0);
  const energyBase = score + factorDelta * 1.6;
  const fatBurnBase =
    score * 0.72 +
    (band === "low" ? 12 : band === "moderate" ? 18 : 10) +
    (data.trend === "up" ? 4 : 0);

  return {
    band,
    energyLabel: getLabelForBand(band),
    metabolicState,
    focus: clamp(Math.round(focusBase), 18, 100),
    energy: clamp(Math.round(energyBase), 16, 100),
    fatBurn: clamp(Math.round(fatBurnBase), 20, 100),
  };
}

function trendBias(trend: MetabolicTrend) {
  if (trend === "up") return 3;
  if (trend === "down") return -5;
  return -1;
}

export function deriveMetabolicForecast(
  data: MetabolicData | null,
  options: { streak: number; todayCheckedIn: boolean; activityImpact: number }
): MetabolicForecast | null {
  if (!data) return null;

  const score = data.score;
  const factorDelta = sumFactorDelta(data.factors);
  const streakBonus = Math.min(4, Math.floor(options.streak / 3));
  const recoveryPenalty = options.todayCheckedIn ? -1 : -3;
  const baseWithoutActivity = score + trendBias(data.trend) + Math.round(factorDelta * 0.25) + recoveryPenalty;
  const baseWithActivity =
    score +
    Math.round(options.activityImpact * 0.72) +
    trendBias(data.trend) +
    streakBonus +
    Math.max(0, Math.round(factorDelta * 0.18));

  const tomorrowWithoutActivity = clamp(Math.round(baseWithoutActivity), 0, 100);
  const tomorrowWithActivity = clamp(Math.round(baseWithActivity), 0, 100);

  return {
    tomorrowWithActivity,
    tomorrowWithoutActivity,
    withActivityDelta: tomorrowWithActivity - score,
    withoutActivityDelta: tomorrowWithoutActivity - score,
  };
}

export function deriveHistoryMarkers(
  history: MetabolicHistory,
  options: { todayCheckedIn: boolean }
): HistoryMarker[] {
  if (history.length < 2) return [];

  const markers: HistoryMarker[] = [];

  for (let index = 1; index < history.length; index += 1) {
    const current = history[index];
    const previous = history[index - 1];
    const delta = current.score - previous.score;

    if (delta >= 5) {
      markers.push({
        date: current.date,
        kind: "workout",
        label: "Workout lift",
      });
    } else if (delta <= -5) {
      markers.push({
        date: current.date,
        kind: "drop",
        label: "Inactivity drop",
      });
    }
  }

  if (options.todayCheckedIn && history.length > 0) {
    const lastDate = history[history.length - 1].date;
    if (!markers.some((marker) => marker.date === lastDate && marker.kind === "workout")) {
      markers.push({
        date: lastDate,
        kind: "workout",
        label: "Workout logged",
      });
    }
  }

  return markers;
}

export function getStateLabelForScore(score: number, trend: MetabolicTrend): MetabolicStateLabel {
  return deriveEnergyStatus({
    score,
    trend,
    status: getBand(score),
    factors: [],
    recommendations: [],
  })!.metabolicState;
}

export function deriveSmartInsight(input: {
  data: MetabolicData | null;
  streak: number;
  todayCheckedIn: boolean;
  mission: { completed: boolean; progress: number; target: number; title: string };
  yesterdayMuscleGroups: string[];
}): SmartInsightModel | null {
  const { data, streak, todayCheckedIn, mission, yesterdayMuscleGroups } = input;
  if (!data) return null;

  const band = getBand(data.score);
  const nearMission = !mission.completed && mission.target > 0 && mission.progress / mission.target >= 0.7;

  if (data.trend === "up" && streak >= 3) {
    return {
      title: "Seu ritmo está encaixando",
      message: "Sua constância já está empurrando o metabolismo para cima. Vale aproveitar hoje para reforçar esse embalo.",
      tone: "positive",
    };
  }

  if (data.trend === "down" && !todayCheckedIn) {
    return {
      title: "Uma ação leve já muda o amanhã",
      message: "Seu score perdeu tração. Um treino curto ou um check-in de movimento hoje tende a evitar uma queda maior amanhã.",
      tone: "alert",
    };
  }

  if (nearMission) {
    return {
      title: "Você está perto da recompensa",
      message: `Falta pouco para concluir a missão "${mission.title}". Uma última ação hoje fecha XP e ainda melhora sua leitura metabólica.`,
      tone: "positive",
    };
  }

  if (yesterdayMuscleGroups.length >= 2) {
    return {
      title: "Variação vai render mais hoje",
      message: "Como você já exigiu vários grupos ontem, alternar para mobilidade, cardio leve ou outro foco pode subir seu score com menos desgaste.",
      tone: "neutral",
    };
  }

  if (todayCheckedIn) {
    return {
      title: "Agora o melhor é sustentar a energia",
      message: "Você já gerou estímulo hoje. O próximo passo mais inteligente é manter consistência e evitar excesso.",
      tone: "neutral",
    };
  }

  if (band === "low") {
    return {
      title: "Comece pequeno para religar o sistema",
      message: "Seu estado está baixo hoje. Um bloco curto de movimento tende a gerar mais retorno do que esperar por motivação perfeita.",
      tone: "alert",
    };
  }

  return {
    title: "Hoje é um bom dia para agir",
    message: "Seu metabolismo está responsivo o suficiente para transformar uma sessão curta em ganho percebido amanhã.",
    tone: "positive",
  };
}

export function deriveQuickAction(input: {
  data: MetabolicData | null;
  missionId: string;
  todayCheckedIn: boolean;
  isFreePlan: boolean;
}): QuickActionModel {
  const { data, missionId, todayCheckedIn, isFreePlan } = input;
  const band = data ? getBand(data.score) : "moderate";
  const trend = data?.trend ?? "stable";

  if (!todayCheckedIn && missionId === "move_20") {
    return {
      kind: "checkin",
      label: "Fazer check-in leve",
      helper: "Registre um movimento curto e veja o impacto antes de sair da tela.",
    };
  }

  if (band === "low" || trend === "down") {
    return {
      kind: "recovery",
      label: "Movimento de recuperação",
      helper: "Uma sessão leve hoje tende a recuperar energia sem pesar.",
      route: "/app/user/treinos/em-casa",
    };
  }

  if (isFreePlan) {
    return {
      kind: "home_workout",
      label: "Ver treino em casa",
      helper: "A ação mais rápida para transformar energia em treino agora.",
      route: "/app/user/treinos/em-casa",
    };
  }

  return {
    kind: "suggested_training",
    label: "Abrir treino sugerido",
    helper: "Seu próximo melhor passo com base no estado de hoje.",
    route: "/app/user/suggested-training",
  };
}

export function buildForecastHistory(
  history: MetabolicHistory,
  forecast: MetabolicForecast | null
): Array<MetabolicHistoryPoint & { scoreWithActivity?: number | null; scoreWithoutActivity?: number | null; isForecast?: boolean }> {
  if (!forecast || history.length === 0) {
    return history.map((point) => ({ ...point }));
  }

  const last = history[history.length - 1];
  const nextDate = new Date(`${last.date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);

  return [
    ...history.map((point) => ({ ...point })),
    {
      date: nextDate.toISOString().slice(0, 10),
      score: last.score,
      scoreWithActivity: forecast.tomorrowWithActivity,
      scoreWithoutActivity: forecast.tomorrowWithoutActivity,
      isForecast: true,
    },
  ];
}
