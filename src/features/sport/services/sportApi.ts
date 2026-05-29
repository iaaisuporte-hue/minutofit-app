import { authFetch } from '../../../services/apiClient';
import { API_URL } from '../../../services/apiBase';
import type {
  SportProfile,
  PreWorkoutCheckinData,
  ReadinessSnapshot,
  CompetitionCamp,
  CampWithDerived,
  SportDashboard,
  PostWorkoutCheckinData,
  PostWorkoutCheckin,
  Fatigue7dResult,
} from '../engine/sportConfig.types';

const BASE = `${API_URL}/sport`;

// ── Profile ───────────────────────────────────────────────────────────────────

export async function fetchSportProfile(): Promise<SportProfile | null> {
  const res = await authFetch(`${BASE}/profile`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load sport profile');
  const data = await res.json();
  return data.profile;
}

export async function saveSportProfile(
  body: Partial<Omit<SportProfile, 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<SportProfile> {
  const res = await authFetch(`${BASE}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to save sport profile');
  }
  const data = await res.json();
  return data.profile;
}

export async function deactivateSportProfile(): Promise<void> {
  const res = await authFetch(`${BASE}/profile`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to deactivate sport profile');
}

// ── Pre-workout check-in ───────────────────────────────────────────────────────

export async function submitPreWorkoutCheckin(
  body: PreWorkoutCheckinData,
): Promise<PreWorkoutCheckinData & { checkin_date: string }> {
  const res = await authFetch(`${BASE}/checkins/pre-workout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to submit check-in');
  }
  const data = await res.json();
  return data.checkin;
}

export async function fetchPreWorkoutCheckins(params?: {
  from?: string;
  to?: string;
}): Promise<(PreWorkoutCheckinData & { checkin_date: string })[]> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const res = await authFetch(`${BASE}/checkins/pre-workout?${qs}`);
  if (!res.ok) throw new Error('Failed to load check-ins');
  const data = await res.json();
  return data.checkins;
}

// ── Post-workout check-in ─────────────────────────────────────────────────────

export async function submitPostWorkoutCheckin(body: PostWorkoutCheckinData): Promise<PostWorkoutCheckin> {
  const res = await authFetch(`${BASE}/checkins/post-workout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to submit post-workout check-in');
  }
  const data = await res.json();
  return data.checkin;
}

export async function fetchPostWorkoutCheckins(params?: {
  from?: string;
  to?: string;
}): Promise<PostWorkoutCheckin[]> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const res = await authFetch(`${BASE}/checkins/post-workout?${qs}`);
  if (!res.ok) throw new Error('Failed to load post-workout check-ins');
  const data = await res.json();
  return data.checkins;
}

export async function fetchSportFatigue(): Promise<Fatigue7dResult> {
  const res = await authFetch(`${BASE}/fatigue`);
  if (!res.ok) throw new Error('Failed to load fatigue data');
  const data = await res.json();
  return data.fatigue;
}

export async function fetchSportHasPersonal(): Promise<{ has_personal: boolean; personal_id: number | null }> {
  const res = await authFetch(`${BASE}/has-personal`);
  if (!res.ok) throw new Error('Failed to check personal link');
  return res.json();
}

export async function grantSportConsent(personalId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/consent/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'sports', professionalId: personalId, role: 'personal' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to grant sport consent');
  }
}

// ── Coach View (personal reading athlete data) ─────────────────────────────

export interface StudentFightIntelData {
  sport: {
    profile: SportProfile;
    readiness_today: ReadinessSnapshot | null;
    last_recovery_gap: number | null;
    fatigue_7d: number | null;
    fatigue_level: import('../engine/sportConfig.types').FatigueLevel | null;
    sessions_7d: number;
    active_camp: CampWithDerived | null;
  } | null;
}

export async function fetchStudentFightIntel(studentId: number): Promise<StudentFightIntelData | null> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/sport`);
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load student fight intel');
  return res.json();
}

// ── Readiness ─────────────────────────────────────────────────────────────────

export async function fetchReadinessToday(): Promise<ReadinessSnapshot | null> {
  const res = await authFetch(`${BASE}/readiness/today`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load readiness');
  const data = await res.json();
  return data.readiness;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function fetchSportDashboard(): Promise<SportDashboard> {
  const res = await authFetch(`${BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to load sport dashboard');
  const data = await res.json();
  return data.dashboard;
}

// ── Competition Camps ─────────────────────────────────────────────────────────

export async function fetchCamps(status?: string): Promise<CampWithDerived[]> {
  const qs = status ? `?status=${status}` : '';
  const res = await authFetch(`${BASE}/camps${qs}`);
  if (!res.ok) throw new Error('Failed to load camps');
  const data = await res.json();
  return data.camps;
}

export async function createCamp(
  body: Pick<CompetitionCamp, 'event_name' | 'event_date'> & Partial<CompetitionCamp>,
): Promise<CampWithDerived> {
  const res = await authFetch(`${BASE}/camps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to create camp');
  }
  const data = await res.json();
  return data.camp;
}

export async function updateCamp(
  id: number,
  body: Partial<Pick<CompetitionCamp, 'status' | 'target_weight_kg' | 'event_name' | 'event_date' | 'category' | 'weeks_planned'>>,
): Promise<CampWithDerived> {
  const res = await authFetch(`${BASE}/camps/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to update camp');
  }
  const data = await res.json();
  return data.camp;
}
