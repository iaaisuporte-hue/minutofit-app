import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import { getAccessToken } from "./authTokens";

export const STUDENT_NOTE_KINDS = [
  "technique",
  "pain",
  "load",
  "progression",
  "cue",
  "rom",
  "breathing",
  "cadence",
  "general",
] as const;

export type StudentNoteKind = (typeof STUDENT_NOTE_KINDS)[number];

export type StudentExerciseNote = {
  id: number;
  personalId: number;
  studentId: number;
  academyId: number | null;
  exerciseKey: string | null;
  exerciseName: string;
  kind: StudentNoteKind;
  note: string;
  severity: number | null;
  loadKg: number | null;
  reps: string | null;
  sets: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateStudentNotePayload = {
  exerciseKey?: string | null;
  exerciseName: string;
  kind: StudentNoteKind;
  note: string;
  severity?: number | null;
  loadKg?: number | null;
  reps?: string | null;
  sets?: string | null;
  recordedAt?: string | null;
};

export async function createStudentNote(studentId: string, payload: CreateStudentNotePayload) {
  if (!getAccessToken()) throw new Error("Sessão expirada.");

  const response = await authFetch(`${API_URL}/personal/students/${studentId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel salvar a nota.");
  }
  return data?.data as StudentExerciseNote;
}

export async function listStudentNotes(
  studentId: string,
  filters?: { kind?: string; exerciseKey?: string; since?: string; limit?: number }
) {
  if (!getAccessToken()) return [];

  const params = new URLSearchParams();
  if (filters?.kind) params.set("kind", filters.kind);
  if (filters?.exerciseKey) params.set("exerciseKey", filters.exerciseKey);
  if (filters?.since) params.set("since", filters.since);
  if (filters?.limit != null) params.set("limit", String(filters.limit));

  const qs = params.toString();
  const response = await authFetch(
    `${API_URL}/personal/students/${studentId}/notes${qs ? `?${qs}` : ""}`
  );
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel listar as notas.");
  }
  return (data?.data || []) as StudentExerciseNote[];
}

export async function updateStudentNote(
  studentId: string,
  noteId: number,
  payload: Partial<CreateStudentNotePayload>
) {
  if (!getAccessToken()) throw new Error("Sessão expirada.");

  const response = await authFetch(`${API_URL}/personal/students/${studentId}/notes/${noteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel atualizar a nota.");
  }
  return data?.data as StudentExerciseNote;
}

export async function deleteStudentNote(studentId: string, noteId: number) {
  if (!getAccessToken()) throw new Error("Sessão expirada.");

  const response = await authFetch(`${API_URL}/personal/students/${studentId}/notes/${noteId}`, {
    method: "DELETE",
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel excluir a nota.");
  }
}
