import { API_URL, parseJson } from './apiBase';
import { authFetch } from './apiClient';

export type ReadinessLevel = 'green' | 'yellow' | 'red';

export interface ReadinessFactor {
  id: string;
  label: string;
  severity: 'info' | 'caution' | 'block';
}

export interface ReadinessLens {
  level: ReadinessLevel;
  factors: ReadinessFactor[];
  headline: string;
  microcopy: string;
}

export interface AdaptationChange {
  exerciseId: string;
  field: string;
  original: string;
  adapted: string;
  reason: string;
}

export interface RecoverySuggestion {
  kind: 'active_recovery' | 'mobility';
  microcopy: string;
}

export interface WorkoutPlanDayPayload {
  index: number;
  name: string;
  focus: string | null;
  items: Array<{
    exerciseId: string;
    name: string;
    sets: string;
    reps: string;
    rest: string;
    rpe?: string;
    notes?: string;
    technique?: { type: string };
  }>;
}

export interface AdaptiveTodayResponse {
  readiness: ReadinessLens | null;
  adaptationEnabled: boolean;
  originalPlanDay: WorkoutPlanDayPayload;
  adaptedPlanDay: WorkoutPlanDayPayload;
  changes: AdaptationChange[];
  recoverySuggestion: RecoverySuggestion | null;
  policyVersion: number;
}

export interface AdaptationPolicy {
  personalId: number;
  studentId: number;
  academyId: number | null;
  version: number;
  masterEnabled: boolean;
  allowVolumeReduction: boolean;
  allowRestIncrease: boolean;
  allowIntensityReduction: boolean;
  allowActiveRecoverySubstitution: boolean;
  allowMobilitySuggestion: boolean;
  maxSetReductionPct: number;
  maxRestIncreasePct: number;
  minIntensityPct: number;
}

export async function fetchAdaptiveToday(
  params?: { planId?: number; dayIndex?: number },
): Promise<AdaptiveTodayResponse | null> {
  const qs = new URLSearchParams();
  if (params?.planId) qs.set('planId', String(params.planId));
  if (params?.dayIndex) qs.set('dayIndex', String(params.dayIndex));
  const url = `${API_URL}/training/today${qs.toString() ? `?${qs}` : ''}`;
  const res = await authFetch(url);
  const data = await parseJson(res);
  if (!res.ok || !data?.success) return null;
  return data.data as AdaptiveTodayResponse;
}

export async function fetchAdaptationPolicy(studentId: number): Promise<AdaptationPolicy> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/adaptation-policy`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || 'Falha ao carregar política de adaptação.');
  return data.data as AdaptationPolicy;
}

export async function patchAdaptationPolicy(
  studentId: number,
  patch: Partial<AdaptationPolicy>,
): Promise<AdaptationPolicy> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/adaptation-policy`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || 'Falha ao salvar política de adaptação.');
  return data.data as AdaptationPolicy;
}

export async function fetchAdaptationLog(studentId: number, params?: { from?: string; to?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.limit) qs.set('limit', String(params.limit));
  const res = await authFetch(
    `${API_URL}/personal/students/${studentId}/adaptation-log${qs.toString() ? `?${qs}` : ''}`,
  );
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || 'Falha ao carregar histórico de adaptação.');
  return (data.data || []) as unknown[];
}
