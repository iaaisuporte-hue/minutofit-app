import * as Sentry from "@sentry/react";
import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";

export async function persistGamificationCheckin(payload: {
  source: "workout" | "activity" | "wellbeing";
  workout?: {
    workoutId: string;
    title: string;
    muscleGroups: string[];
  };
  activity?: {
    type: "walk" | "run" | "cycling";
    durationSeconds: number;
    distanceKm: number;
    pace: number;
  };
  signals?: {
    feeling?: "tired" | "neutral" | "energized" | "normal";
    sleptWell?: boolean;
    inPain?: boolean;
    stressed?: boolean;
    /** Onda 4 MaaS — sinais secundários opt-in */
    hydrationOk?: boolean;
    nutritionLevel?: "poor" | "ok" | "good";
    mentalLoadLevel?: "low" | "medium" | "high";
    notes?: string;
  };
}) {
  if (!getAccessToken()) {
    // Telemetria: o check-in seria perdido por falta de token. Antes era um
    // no-op totalmente silencioso — impossível medir a taxa de perda do sinal.
    Sentry.captureMessage("checkin.dropped.no_token", {
      level: "warning",
      tags: { feature: "checkin", source: payload.source },
    });
    return null;
  }

  let response: Response;
  try {
    response = await authFetch(`${API_URL}/gamification/checkins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Desde a Onda C0 (Spec 034) o cliente relata FATOS; quanto cada fato
      // vale é decisão do servidor (xpLedgerService). Nenhum `xp` viaja aqui.
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Offline / falha de rede: antes a perda só ia para console.error.
    Sentry.captureException(err, {
      tags: { feature: "checkin", source: payload.source, reason: "network" },
    });
    throw err;
  }

  if (response.status === 401) {
    Sentry.captureMessage("checkin.dropped.unauthorized", {
      level: "warning",
      tags: { feature: "checkin", source: payload.source },
    });
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    Sentry.captureMessage("checkin.failed.http", {
      level: "error",
      tags: { feature: "checkin", source: payload.source, status: String(response.status) },
    });
    throw new Error(data?.error || "Nao foi possivel persistir a gamificacao.");
  }

  return data?.data || null;
}

export async function persistWellbeingCheckin(signals: {
  feeling: "tired" | "normal" | "energized";
  sleptWell: boolean;
  inPain: boolean;
  stressed: boolean;
  /** Onda 4 MaaS — opt-in (undefined = não respondido, não enviado ao backend) */
  hydrationOk?: boolean;
  nutritionLevel?: "poor" | "ok" | "good";
  mentalLoadLevel?: "low" | "medium" | "high";
  notes?: string;
}) {
  return persistGamificationCheckin({
    source: "wellbeing",
    signals: {
      feeling: signals.feeling === "normal" ? "neutral" : signals.feeling,
      sleptWell: signals.sleptWell,
      inPain: signals.inPain,
      stressed: signals.stressed,
      hydrationOk: signals.hydrationOk,
      nutritionLevel: signals.nutritionLevel,
      mentalLoadLevel: signals.mentalLoadLevel,
      notes: signals.notes,
    },
  });
}

export async function fetchGamificationSummary() {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/gamification/summary`);

  if (response.status === 401) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar o resumo de gamificacao.");
  }

  return data?.data || null;
}
