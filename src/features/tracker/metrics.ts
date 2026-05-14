/**
 * Funções de métricas de atividade física.
 * Cálculos de calorias, intensidade, prontidão e score de performance.
 */
import { type Activity } from "./types";
import { ACTIVITY_MET } from "./constants";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Estimativa conservadora de calorias baseada em MET + distância */
export function estimateCalories(
  type: Activity["type"],
  durationSeconds: number,
  distanceKm: number
): number {
  const durationHours = durationSeconds / 3600;
  const met = ACTIVITY_MET[type];
  const byMet = met * 70 * durationHours; // 70 kg default body weight
  const byDist = distanceKm * 60; // ~60 kcal/km average
  const cal = Math.round(Math.min(byMet, byDist) || byMet);
  return Math.max(0, cal);
}

export function classifyIntensity(
  type: Activity["type"],
  pace: number // min/km
): "low" | "moderate" | "high" {
  if (!pace || !Number.isFinite(pace) || pace <= 0) return "low";

  if (type === "walk") {
    if (pace > 15) return "low";
    if (pace >= 10) return "moderate";
    return "high";
  }
  if (type === "run") {
    if (pace > 7) return "low";
    if (pace >= 4.5) return "moderate";
    return "high";
  }
  // cycling
  if (pace > 6) return "low";
  if (pace >= 3) return "moderate";
  return "high";
}

export const INTENSITY_LABELS: Record<"low" | "moderate" | "high", string> = {
  low: "Leve",
  moderate: "Moderado",
  high: "Intenso",
};

/** Métricas de estado do dia baseadas no histórico recente */
export function getTodayStatus(activities: Activity[]) {
  const recent = activities.slice(0, 5);
  const totalDuration = recent.reduce((sum, item) => sum + item.duration, 0);
  const avgDurationMin = recent.length > 0 ? totalDuration / recent.length / 60 : 0;
  const lastActivity = recent[0];
  const hoursSinceLast = lastActivity
    ? (Date.now() - new Date(lastActivity.startTime).getTime()) / 3_600_000
    : 72;

  const energy = clamp(Math.round(62 + Math.min(avgDurationMin, 40) * 0.35), 45, 92);
  const recovery = clamp(Math.round(84 - Math.min(hoursSinceLast, 72) * 0.45), 48, 90);
  const readiness = clamp(Math.round(energy * 0.4 + recovery * 0.6), 42, 93);
  const metabolism = clamp(Math.round((energy + recovery + readiness) / 3), 45, 92);

  return { energy, recovery, readiness, metabolism };
}

export function getReadinessAdvice(readinessScore: number): string {
  if (readinessScore >= 80) return "Zona verde: sessão intensa liberada";
  if (readinessScore >= 60) return "Moderado sustentável";
  return "Prefira recuperação ativa hoje";
}

/** Score de performance de uma sessão individual (38–96) */
export function getPerformanceSignal(activity: Activity) {
  const durationMin = activity.duration / 60;
  const pace = activity.pace || 0;
  let score = 52;

  if (durationMin >= 30) score += 15;
  else if (durationMin >= 18) score += 8;

  if (activity.distance >= 4) score += 12;
  else if (activity.distance >= 2) score += 6;

  if (activity.type === "run" && pace > 0 && pace <= 6.2) score += 13;
  if (activity.type === "walk" && durationMin >= 35) score += 8;
  if (activity.type === "cycling" && activity.distance >= 6) score += 10;

  score = clamp(score, 38, 96);

  const tag = score >= 80 ? "Intenso" : score >= 62 ? "Bom" : "Leve";
  const insight =
    score >= 80
      ? "Boa consistência para evolução progressiva."
      : score >= 62
        ? "Ritmo estável durante a maior parte da sessão."
        : "Ritmo caiu no final. Mantenha intensidade gradual.";

  return { score, tag, insight };
}
