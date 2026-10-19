/**
 * Spec 040 — suplementação nutricional. Orientação (nutri) e uso (aluno)
 * são entidades separadas; o uso não tem nutrientes e não toca o diário.
 */
import { API_URL, parseJson } from './apiBase';
import { authFetch } from './apiClient';
import { NutriApiError } from './nutriApi';

export type DoseUnit = 'g' | 'mg' | 'mcg' | 'ml' | 'ui' | 'capsule' | 'tablet' | 'scoop' | 'drops' | 'sachet' | 'dose';
export type SupplementFrequency = 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'as_needed' | 'other';
export type SupplementStatus = 'active' | 'suspended' | 'ended';

export interface SupplementFields {
  name: string;
  doseAmount: number;
  doseUnit: DoseUnit;
  frequency: SupplementFrequency;
  frequencyDetail: string | null;
  timing: string | null;
  purpose: string | null;
  notes: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface Supplement extends SupplementFields {
  id: number;
  status: SupplementStatus;
  statusChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
}

export interface NutriSupplement extends Supplement {
  usage: { lastUsedAt: string | null; count7d: number };
}

export interface StudentSupplement extends Supplement {
  usedTodayCount: number;
}

export interface SupplementUsageLog {
  id: number;
  supplementId: number;
  supplementName: string;
  dateKey: string;
  takenAt: string;
  note: string | null;
}

/** 400 nomeia o campo; o editor destaca exatamente ele. */
export class SupplementApiError extends NutriApiError {
  field: string | null;

  constructor(status: number, code: string, field: string | null) {
    super(status, code);
    this.name = 'SupplementApiError';
    this.field = field;
  }
}

type Envelope<T> = { success?: boolean; error?: unknown; field?: unknown; data?: T };

async function read<T>(res: Response): Promise<T> {
  const json = (await parseJson(res)) as Envelope<T> | null;
  if (!res.ok || json?.success === false) {
    const code = typeof json?.error === 'string' ? json.error : `http_${res.status}`;
    throw new SupplementApiError(res.status, code, typeof json?.field === 'string' ? json.field : null);
  }
  if (json?.data === undefined) throw new SupplementApiError(res.status, 'empty_response', null);
  return json.data;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ── Nutri ────────────────────────────────────────────────────────────────

export async function fetchPatientSupplements(patientId: number): Promise<NutriSupplement[]> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/supplements`);
  return (await read<{ supplements: NutriSupplement[] }>(res)).supplements;
}

export async function createPatientSupplement(patientId: number, fields: SupplementFields): Promise<Supplement> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/supplements`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(fields),
  });
  return (await read<{ supplement: Supplement }>(res)).supplement;
}

export async function updatePatientSupplement(
  patientId: number,
  supplementId: number,
  patch: Partial<SupplementFields> & { status?: SupplementStatus },
): Promise<Supplement> {
  const res = await authFetch(`${API_URL}/nutri/patients/${patientId}/supplements/${supplementId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(patch),
  });
  return (await read<{ supplement: Supplement }>(res)).supplement;
}

// ── Aluno ────────────────────────────────────────────────────────────────

export async function getMySupplements(): Promise<{ supplements: StudentSupplement[]; recentLogs: SupplementUsageLog[] }> {
  const res = await authFetch(`${API_URL}/user/supplements`);
  return read(res);
}

export async function logMySupplementUsage(supplementId: number, clientKey: string): Promise<SupplementUsageLog> {
  const res = await authFetch(`${API_URL}/user/supplements/${supplementId}/usage`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ clientKey }),
  });
  return (await read<{ log: SupplementUsageLog }>(res)).log;
}

export async function undoMySupplementUsage(logId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/user/supplements/usage/${logId}`, { method: 'DELETE' });
  const json = (await parseJson(res)) as Envelope<unknown> | null;
  if (!res.ok || json?.success === false) {
    throw new SupplementApiError(res.status, typeof json?.error === 'string' ? json.error : `http_${res.status}`, null);
  }
}
