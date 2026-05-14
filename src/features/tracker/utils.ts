/**
 * Utilitários de formatação e parsing para o Activity Tracker.
 */
import { type Activity } from "./types";

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function formatPace(pace: number): string {
  if (!pace || Number.isNaN(pace) || !Number.isFinite(pace)) return "--";
  return pace.toFixed(2);
}

export function calculatePace(durationSeconds: number, distanceKm: number): number {
  if (!distanceKm) return 0;
  return parseFloat((((durationSeconds / 60) || 0) / distanceKm).toFixed(2));
}

export function parseStoredActivities(raw: string | null): Activity[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Activity[];
    return parsed.map((a) => ({
      ...a,
      startTime: new Date(a.startTime),
      endTime: a.endTime ? new Date(a.endTime) : undefined,
      routeCoordinates: a.routeCoordinates || [],
    }));
  } catch {
    return [];
  }
}
