/**
 * Constantes de domínio do Activity Tracker.
 */
import { type Activity } from "./types";

export const ACTIVITY_META = {
  walk: { label: "Caminhada", helper: "Baixo impacto" },
  run: { label: "Corrida", helper: "Alta intensidade" },
  cycling: { label: "Ciclismo", helper: "Cardio contínuo" },
} satisfies Record<Activity["type"], { label: string; helper: string }>;

/** MET values per activity type (metabolic equivalent of task) */
export const ACTIVITY_MET: Record<Activity["type"], number> = {
  walk: 3.8,
  run: 10.0,
  cycling: 6.8,
};

/** Speed thresholds (km/h) per activity type for heuristic validation */
export const SPEED_THRESHOLDS: Record<Activity["type"], { avgMax: number; peakMax: number }> = {
  walk: { avgMax: 7, peakMax: 15 },
  run: { avgMax: 20, peakMax: 30 },
  cycling: { avgMax: 35, peakMax: 50 },
};

/** Above this for any activity type → vehicle signal */
export const UNIVERSAL_PEAK_LIMIT = 50; // km/h

/** km/h delta in one segment → suspicious acceleration */
export const ACCELERATION_LIMIT = 20;
