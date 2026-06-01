import { apiClient } from './apiClient';

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
  const url = `/training/today${qs.toString() ? `?${qs}` : ''}`;
  const res = await apiClient.get<{ success: boolean; data: AdaptiveTodayResponse; error?: string }>(url);
  if (!res.data.success) return null;
  return res.data.data;
}

export async function fetchAdaptationPolicy(studentId: number): Promise<AdaptationPolicy> {
  const res = await apiClient.get<{ success: boolean; data: AdaptationPolicy }>(
    `/personal/students/${studentId}/adaptation-policy`,
  );
  return res.data.data;
}

export async function patchAdaptationPolicy(
  studentId: number,
  patch: Partial<AdaptationPolicy>,
): Promise<AdaptationPolicy> {
  const res = await apiClient.patch<{ success: boolean; data: AdaptationPolicy }>(
    `/personal/students/${studentId}/adaptation-policy`,
    patch,
  );
  return res.data.data;
}

export async function fetchAdaptationLog(studentId: number, params?: { from?: string; to?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.limit) qs.set('limit', String(params.limit));
  const res = await apiClient.get<{ success: boolean; data: unknown[] }>(
    `/personal/students/${studentId}/adaptation-log${qs.toString() ? `?${qs}` : ''}`,
  );
  return res.data.data;
}
