import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type WorkoutReviewStatus = "pending" | "changes_requested" | "approved" | "archived";
export type WorkoutReviewRisk = "low" | "medium" | "high";
export type WorkoutReviewPriority = "low" | "normal" | "high";

export type WorkoutReview = {
  id: string;
  personalId: string;
  studentId: string;
  studentName: string | null;
  workoutPlanId: string | null;
  title: string;
  goal: string;
  status: WorkoutReviewStatus;
  risk: WorkoutReviewRisk;
  priority: WorkoutReviewPriority;
  internalNotes: string | null;
  studentFeedback: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};

async function jsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || fallback);
  }
  return (data?.data ?? null) as T;
}

export async function fetchWorkoutReviews(): Promise<WorkoutReview[]> {
  const response = await authFetch(`${API_URL}/personal/reviews`);
  return (await jsonOrThrow<WorkoutReview[]>(response, "Nao foi possivel carregar a fila de revisoes.")) ?? [];
}

export async function createWorkoutReview(input: {
  studentId: string;
  title: string;
  goal?: string;
  risk?: WorkoutReviewRisk;
  priority?: WorkoutReviewPriority;
  workoutPlanId?: string | null;
  internalNotes?: string | null;
}): Promise<WorkoutReview> {
  const response = await authFetch(`${API_URL}/personal/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<WorkoutReview>(response, "Nao foi possivel criar a revisao.");
}

export async function updateWorkoutReview(
  reviewId: string,
  patch: { internalNotes?: string; studentFeedback?: string }
): Promise<WorkoutReview> {
  const response = await authFetch(`${API_URL}/personal/reviews/${reviewId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return jsonOrThrow<WorkoutReview>(response, "Nao foi possivel salvar as observacoes.");
}

export async function approveWorkoutReview(reviewId: string, internalNotes?: string): Promise<WorkoutReview> {
  const response = await authFetch(`${API_URL}/personal/reviews/${reviewId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ internalNotes }),
  });
  return jsonOrThrow<WorkoutReview>(response, "Nao foi possivel aprovar a revisao.");
}

export async function requestChangesWorkoutReview(
  reviewId: string,
  studentFeedback: string,
  internalNotes?: string
): Promise<WorkoutReview> {
  const response = await authFetch(`${API_URL}/personal/reviews/${reviewId}/request-changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentFeedback, internalNotes }),
  });
  return jsonOrThrow<WorkoutReview>(response, "Nao foi possivel pedir ajustes.");
}

export async function archiveWorkoutReview(reviewId: string): Promise<WorkoutReview> {
  const response = await authFetch(`${API_URL}/personal/reviews/${reviewId}/archive`, {
    method: "POST",
  });
  return jsonOrThrow<WorkoutReview>(response, "Nao foi possivel arquivar a revisao.");
}
