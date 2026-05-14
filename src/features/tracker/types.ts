/**
 * Tipos de domínio do Activity Tracker.
 * Extraído de ActivityTrackerPage para isolar domínio de UI.
 */

export interface Activity {
  id: string;
  type: "walk" | "run" | "cycling";
  startTime: Date;
  endTime?: Date;
  distance: number;
  pace: number;
  duration: number;
  routeCoordinates: Array<{ lat: number; lng: number }>;
  calories?: number;
  intensity?: "low" | "moderate" | "high";
  /** true quando salvo apesar de sinais de velocidade suspeitos */
  validationFlag?: boolean;
}

export interface ValidationResult {
  isSuspicious: boolean;
  reason: string | null;
  avgSpeed: number;
  peakSpeed: number;
}
