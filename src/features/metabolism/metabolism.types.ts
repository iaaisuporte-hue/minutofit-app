export type MetabolicStatus = 'low' | 'moderate' | 'high';
export type MetabolicTrend = 'up' | 'down' | 'stable';

export interface MetabolicFactor {
  id: string;
  label: string;
  delta: number;
  hint: string;
}

export interface MetabolicRecommendation {
  id: string;
  title: string;
  reason: string;
  impact: string;
  cta?: { label: string; route: string };
  priority: number;
}

export interface MetabolicData {
  score: number;
  status: MetabolicStatus;
  trend: MetabolicTrend;
  factors: MetabolicFactor[];
  recommendations: MetabolicRecommendation[];
}

export interface MetabolicHistoryPoint {
  date: string; // ISO YYYY-MM-DD
  score: number; // 0-100
}

export type MetabolicHistory = MetabolicHistoryPoint[];
