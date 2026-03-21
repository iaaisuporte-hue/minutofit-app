import { API_URL, handleUnauthorizedResponse } from "./apiBase";

function getToken() {
  return localStorage.getItem("minutofit_token");
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export type PersonalDashboardPlan = "basic" | "silver" | "gold" | "black";
export type PersonalDashboardRisk = "ok" | "alerta" | "critico";
export type PersonalDashboardGoal = "emagrecimento" | "hipertrofia" | "condicionamento";
export type PersonalConsultingStatus = "urgent" | "warning" | "on_track";
export type PersonalConsultingNextAction =
  | "refresh_today"
  | "prepare_update"
  | "review_adherence"
  | "keep_progression";

export type PersonalDashboardStudent = {
  id: string;
  name: string;
  plan: PersonalDashboardPlan;
  workouts7d: number;
  workouts30d: number;
  streakDays: number;
  lastWorkoutISO: string | null;
  adherencePct: number;
  risk: PersonalDashboardRisk;
  goal: PersonalDashboardGoal;
  notes?: string | null;
};

export type PersonalDashboardResponse = {
  summary: {
    totalStudents: number;
    total7d: number;
    total30d: number;
    avg7d: number;
    avg30d: number;
    okCount: number;
    alertCount: number;
    criticalCount: number;
    most: PersonalDashboardStudent | null;
    least: PersonalDashboardStudent | null;
    needsFollowUp: PersonalDashboardStudent[];
  };
  students: PersonalDashboardStudent[];
  generatedAt: string;
};

export type PersonalConsultingStudent = {
  id: string;
  name: string;
  plan: PersonalDashboardPlan;
  planExpiresAt: string;
  lastWorkoutUpdateAt: string;
  workoutsDoneInCurrentPlan: number;
  workoutsPlannedInCurrentPlan: number;
  status: PersonalConsultingStatus;
  nextAction: PersonalConsultingNextAction;
};

export type PersonalConsultingResponse = {
  summary: {
    total: number;
    urgent: number;
    warning: number;
    onTrack: number;
  };
  students: PersonalConsultingStudent[];
  generatedAt: string;
};

export async function fetchPersonalDashboard() {
  const token = getToken();
  if (!token) return null;

  const response = await fetch(`${API_URL}/personal/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (handleUnauthorizedResponse(response)) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar o dashboard do personal.");
  }

  return (data?.data || null) as PersonalDashboardResponse | null;
}

export async function fetchPersonalConsulting() {
  const token = getToken();
  if (!token) return null;

  const response = await fetch(`${API_URL}/personal/consulting/students`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (handleUnauthorizedResponse(response)) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar a carteira de consultoria.");
  }

  return (data?.data || null) as PersonalConsultingResponse | null;
}
