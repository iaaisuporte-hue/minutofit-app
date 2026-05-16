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

export interface MetabolicTrendBlock {
  delta: number;
  direction: 'up' | 'down' | 'stable';
}

export interface MetabolicData {
  score: number;
  status: MetabolicStatus;
  trend: MetabolicTrend;
  factors: MetabolicFactor[];
  recommendations: MetabolicRecommendation[];
  trend7d?: MetabolicTrendBlock;
  trend30d?: MetabolicTrendBlock;
  /**
   * Narrativa contextual gerada por IA — frase curta interpretando o estado
   * atual ("o que isso significa pra você hoje") + ação concreta. Cache 4h
   * por usuário no backend. `null` quando OPENAI indisponível ou rate-limited.
   */
  interpretation?: { hint: string; action: string } | null;
}

export interface MetabolicHistoryPoint {
  date: string; // ISO YYYY-MM-DD
  score: number; // 0-100
}

export type MetabolicHistory = MetabolicHistoryPoint[];
