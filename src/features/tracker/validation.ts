/**
 * Validação heurística de sessões de atividade física.
 * Detecta velocidades incomuns, acelerações bruscas e padrões de veículo.
 */
import { type Activity, type ValidationResult } from "./types";
import { SPEED_THRESHOLDS, UNIVERSAL_PEAK_LIMIT, ACCELERATION_LIMIT } from "./constants";

export function analyzeActivityValidity(
  type: Activity["type"],
  speeds: number[]
): ValidationResult {
  if (speeds.length < 3) {
    return { isSuspicious: false, reason: null, avgSpeed: 0, peakSpeed: 0 };
  }

  const avgSpeed = speeds.reduce((s, v) => s + v, 0) / speeds.length;
  const peakSpeed = Math.max(...speeds);
  const thresholds = SPEED_THRESHOLDS[type];

  if (peakSpeed > UNIVERSAL_PEAK_LIMIT) {
    return {
      isSuspicious: true,
      reason: "Velocidade incomum detectada para essa atividade",
      avgSpeed,
      peakSpeed,
    };
  }

  if (avgSpeed > thresholds.avgMax || peakSpeed > thresholds.peakMax) {
    return {
      isSuspicious: true,
      reason: "Velocidade incomum detectada para essa atividade",
      avgSpeed,
      peakSpeed,
    };
  }

  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i] - speeds[i - 1] > ACCELERATION_LIMIT) {
      return {
        isSuspicious: true,
        reason: "Aceleração brusca detectada — padrão incompatível com atividade física",
        avgSpeed,
        peakSpeed,
      };
    }
  }

  return { isSuspicious: false, reason: null, avgSpeed, peakSpeed };
}
