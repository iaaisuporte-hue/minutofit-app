export interface MetabolicCheckinRecord {
  id: string;
  userId: number;
  academyId: number | null;
  recordedAt: string;
  weightKg: number | null;
  waistCm: number | null;
  bodyFatPct: number | null;
  systolicMmhg: number | null;
  diastolicMmhg: number | null;
  fastingGlucoseMgdl: number | null;
  notes: string | null;
  source: 'onboarding' | 'self_report' | 'professional' | 'imported';
  createdAt: string;
}

export interface MetabolicCheckinInput {
  weightKg?: number | null;
  waistCm?: number | null;
  bodyFatPct?: number | null;
  systolicMmhg?: number | null;
  diastolicMmhg?: number | null;
  fastingGlucoseMgdl?: number | null;
  notes?: string | null;
}

export interface MetabolicTrendItem {
  key: 'weight' | 'waist' | 'bodyFat' | 'pressure' | 'glucose';
  label: string;
  value: string;
  tone: 'positive' | 'neutral' | 'attention';
  sinceLabel: string;
}

export type MetabolicNudgeReason = 'first' | 'weight' | 'waist' | null;

export interface MetabolicNudgeState {
  shouldShow: boolean;
  reason: MetabolicNudgeReason;
  title: string;
  description: string;
}
