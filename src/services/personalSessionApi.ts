import { API_URL } from "./apiBase";
import { authFetch } from "./apiClient";

export type SessionStatus = "present" | "absent" | "partial";

export const SESSION_TAGS = [
  { key: "dor", label: "Dor" },
  { key: "cansaco", label: "Cansaço" },
  { key: "desmotivado", label: "Desmotivado" },
  { key: "dificuldade_tecnica", label: "Dificuldade técnica" },
  { key: "evolucao_carga", label: "Evoluiu carga" },
  { key: "precisa_contato", label: "Precisa de contato" },
] as const;

export type SessionTag = (typeof SESSION_TAGS)[number]["key"];

export interface SessionLog {
  id: number;
  personalId: number;
  studentId: number;
  status: SessionStatus;
  sessionAt: string;
  tags: string[];
  note: string | null;
  createdAt: string;
}

export async function createSession(
  studentId: string,
  input: {
    status: SessionStatus;
    tags?: string[];
    note?: string;
    sessionAt?: string;
  }
): Promise<SessionLog> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any)?.error || `Erro ${res.status}`);
  }
  const json = await res.json();
  return json.data as SessionLog;
}

export async function listStudentSessions(
  studentId: string,
  limit = 20
): Promise<SessionLog[]> {
  const res = await authFetch(
    `${API_URL}/personal/students/${studentId}/sessions?limit=${limit}`
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data as SessionLog[]) ?? [];
}
