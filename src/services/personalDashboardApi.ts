import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";

// Tipos canônicos vêm de src/shared/types/personal-dashboard.ts
// (espelha corefit-backend/src/shared/types/personal-dashboard.ts).
// Source-of-truth: /shared/contract-personal-dashboard.md no monorepo parent.
import type {
  PersonalDashboardPlan,
  PersonalDashboardRisk,
  PersonalDashboardGoal,
  PersonalDashboardEngagementStatus,
  PersonalDashboardAlertType,
  PersonalMetabolicBand,
  PersonalMetabolicTrend,
  PersonalDashboardStudent,
  PersonalDashboardAlert,
} from "../shared/types/personal-dashboard";

export type {
  PersonalDashboardPlan,
  PersonalDashboardRisk,
  PersonalDashboardGoal,
  PersonalDashboardEngagementStatus,
  PersonalDashboardAlertType,
  PersonalMetabolicBand,
  PersonalMetabolicTrend,
  PersonalDashboardStudent,
  PersonalDashboardAlert,
};

// Tipos locais ao consumidor (não fazem parte do contrato da API,
// servem para conveniência de UI e estão fora do shared canônico).
export type PersonalConsultingStatus = "urgent" | "warning" | "on_track";
export type PersonalConsultingNextAction =
  | "refresh_today"
  | "prepare_update"
  | "review_adherence"
  | "keep_progression";

export type RetentionInsight = {
  kind: "adherence_correlation" | "individual_drop" | "portfolio_signal";
  title: string;
  body: string;
  studentId: string | null;
};

export type RecognitionMilestone = {
  studentId: string;
  studentName: string;
  milestoneKey: string;
  milestoneLabel: string;
  milestoneDetail: string;
  streakDays: number;
  workouts7d: number;
  workouts30d: number;
  adherencePct: number;
  engagementStatus: PersonalDashboardEngagementStatus;
  lastWorkoutISO: string | null;
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
    metabolismDistribution: { low: number; moderate: number; high: number; unknown: number };
    atRiskTop: PersonalDashboardStudent[];
    insights: RetentionInsight[];
    needsRecognitionTop: RecognitionMilestone[];
    adaptationsThisWeek?: number;
    activationHasPlan?: boolean;
    activationHasCheckin?: boolean;
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
  metabolismDetail: {
    score: number;
    status: "low" | "moderate" | "high";
    trend: "up" | "down" | "stable";
    factors: Array<{ id: string; label: string; delta: number; hint: string }>;
    recommendations: Array<{
      id: string;
      title: string;
      reason: string;
      impact: string;
      cta?: { label: string; route: string };
      priority: number;
    }>;
    trend7d: { delta: number; direction: "up" | "down" | "stable" };
    trend30d: { delta: number; direction: "up" | "down" | "stable" };
  } | null;
  today: {
    checkedInToday: boolean;
    lastCheckinISO: string | null;
    moodAvailable: boolean;
    wellbeing: {
      feeling: string | null;
      sleptWell: boolean | null;
      inPain: boolean | null;
      stressed: boolean | null;
      notes: string | null;
      dateKey: string;
    } | null;
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
      score: number | null;
      caloriesEstimated: number | null;
      validationFlag: boolean;
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
    muscleGroupCounts: Array<{
      group: string;
      count: number;
    }>;
    xp: number;
    wellbeingHistory14d: Array<{
      dateKey: string;
      feeling: string | null;
      sleptWell: boolean | null;
      inPain: boolean | null;
      stressed: boolean | null;
    }>;
  };
  technical?: {
    highlights: Array<{
      exerciseName: string;
      kind: string;
      count: number;
      lastNoteAt: string;
    }>;
    recentNotes: Array<{
      id: number;
      exerciseName: string;
      exerciseKey: string | null;
      kind: string;
      note: string;
      recordedAt: string;
      loadKg: number | null;
      reps: string | null;
      sets: string | null;
      severity: number | null;
      personalId: number;
    }>;
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

export type PersonalStudentActivity = {
  id: number;
  activityType: string;
  durationSeconds: number;
  distanceKm: number;
  caloriesEstimated: number;
  avgPace: number | null;
  intensity: string | null;
  score: number | null;
  validationFlag: boolean;
  createdAt: string;
};

export async function fetchPersonalStudentActivities(studentId: string, limit = 10) {
  if (!getAccessToken()) return null;

  const q = Number.isFinite(limit) ? `?limit=${limit}` : "";
  const response = await authFetch(`${API_URL}/personal/students/${studentId}/activities${q}`);

  if (response.status === 401) {
    return null;
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar as sessoes de atividade.");
  }

  return (data?.data || []) as PersonalStudentActivity[];
}

export type AddStudentDirectResult = {
  student: { id: number; name: string; email: string };
  isNew: boolean;
  matchedBy: "email" | "cpf" | "phone" | null;
  tempPassword?: string;
  mustChangePassword?: boolean;
};

export type StudentAiSummaryResult = {
  summary: string;
  disclaimer: string;
};

export async function fetchStudentAiSummary(studentId: string): Promise<StudentAiSummaryResult | null> {
  if (!getAccessToken()) return null;

  const response = await authFetch(`${API_URL}/personal/students/${studentId}/ai-summary`);

  if (response.status === 401) return null;

  const data = await parseJson(response);
  if (!response.ok) {
    const err: Error & { code?: string } = new Error(data?.error || "Não foi possível gerar o resumo IA.");
    if (response.status === 429) err.code = "RATE_LIMITED";
    if (response.status === 503) err.code = "AI_UNAVAILABLE";
    throw err;
  }

  return data?.data ?? null;
}

export async function removeStudentFromPortfolio(studentId: string): Promise<void> {
  const response = await authFetch(`${API_URL}/personal/students/${studentId}`, {
    method: "DELETE",
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível remover o aluno da carteira.");
  }
}

export async function addStudentDirect(input: {
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
}): Promise<AddStudentDirectResult> {
  const response = await authFetch(`${API_URL}/personal/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    const err: Error & { code?: string; data?: unknown } = new Error(
      data?.error || "Não foi possível cadastrar o aluno."
    );
    err.code = data?.code;
    err.data = data?.data;
    throw err;
  }

  return data.data as AddStudentDirectResult;
}
