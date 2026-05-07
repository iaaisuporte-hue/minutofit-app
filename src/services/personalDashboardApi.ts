import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";

export type PersonalDashboardPlan = "basic" | "silver" | "gold" | "black";
export type PersonalDashboardRisk = "ok" | "alerta" | "critico";
export type PersonalDashboardGoal = "emagrecimento" | "hipertrofia" | "condicionamento";
export type PersonalDashboardEngagementStatus = "evolving" | "on_track" | "attention" | "fading" | "at_risk";
export type PersonalConsultingStatus = "urgent" | "warning" | "on_track";
export type PersonalConsultingNextAction =
  | "refresh_today"
  | "prepare_update"
  | "review_adherence"
  | "keep_progression";
export type PersonalDashboardAlertType = "attention_load" | "full_adherence" | "silent_disappear" | "overtraining";

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
  engagementStatus: PersonalDashboardEngagementStatus;
  lastCheckinISO: string | null;
  checkins7d: number;
};

export type PersonalDashboardAlert = {
  type: PersonalDashboardAlertType;
  title: string;
  description: string;
  studentId: string | null;
  studentName: string | null;
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
    intelligentAlerts: PersonalDashboardAlert[];
  };
  students: PersonalDashboardStudent[];
  generatedAt: string;
};

export type PersonalStudentSnapshot = {
  id: string;
  name: string;
  plan: PersonalDashboardPlan;
  goal: PersonalDashboardGoal;
  notes: string | null;
  risk: PersonalDashboardRisk;
  engagementStatus: PersonalDashboardEngagementStatus;
  adherencePct: number;
  streakDays: number;
  today: {
    checkedInToday: boolean;
    lastCheckinISO: string | null;
    moodAvailable: boolean;
    metabolism: {
      score: number;
      status: string;
      trend: string;
    } | null;
    latestActivity: {
      type: string;
      distanceKm: number;
      durationMinutes: number;
      intensity: string | null;
      createdAt: string;
    } | null;
    latestWorkout: {
      title: string;
      completedAt: string;
    } | null;
    workoutStatus: "completed" | "not_started";
  };
  week: {
    days: Array<{
      date: string;
      workedOut: boolean;
      hadGps: boolean;
      checkedIn: boolean;
    }>;
    avgFormScore: number | null;
    movementSessions7d: number;
    latestMessagePreview: {
      text: string;
      createdAt: string;
      senderRole: string;
    } | null;
  };
  history: {
    adherence14d: Array<{
      date: string;
      score: number;
    }>;
    formScoreSeries: Array<{
      date: string;
      score: number;
      exerciseLabel: string;
    }>;
    activityTypeCounts: Array<{
      type: string;
      count: number;
    }>;
    xp: number;
  };
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
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/personal/dashboard`);

  if (response.status === 401) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar o dashboard do personal.");
  }

  return (data?.data || null) as PersonalDashboardResponse | null;
}

export async function fetchPersonalConsulting() {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/personal/consulting/students`);

  if (response.status === 401) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar a carteira de consultoria.");
  }

  return (data?.data || null) as PersonalConsultingResponse | null;
}

export async function fetchPersonalStudentSnapshot(studentId: string) {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/personal/students/${studentId}/snapshot`);

  if (response.status === 401) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar o perfil do aluno.");
  }

  return (data?.data || null) as PersonalStudentSnapshot | null;
}
