import { useCallback, useState } from 'react';

export type DailyFeeling = 'tired' | 'normal' | 'energized';
export type NutritionLevel = 'poor' | 'ok' | 'good';
export type MentalLoadLevel = 'low' | 'medium' | 'high';

export interface DailyConditionDetails {
  sleptWell: boolean;
  inPain: boolean;
  stressed: boolean;
  /** Onda 4 MaaS — sinais secundários opt-in (undefined = não respondido) */
  hydrationOk?: boolean;
  nutritionLevel?: NutritionLevel;
  mentalLoadLevel?: MentalLoadLevel;
}

export interface DailyCondition {
  date: string;
  feeling: DailyFeeling;
  details: DailyConditionDetails | null;
}

export interface DailyConditionState {
  energyLevel: 'low' | 'medium' | 'high';
  recommendedTraining: string;
  messagingTone: 'recovery' | 'steady' | 'push';
}

const STORAGE_KEY = 'daily_condition_v1';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function readFromStorage(): DailyCondition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyCondition;
    if (parsed.date !== todayISO()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(condition: DailyCondition): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(condition));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function useDailyCondition() {
  const [condition, setConditionState] = useState<DailyCondition | null>(() => readFromStorage());

  const setCondition = useCallback((feeling: DailyFeeling, details?: DailyConditionDetails) => {
    const next: DailyCondition = {
      date: todayISO(),
      feeling,
      details: details ?? null,
    };
    writeToStorage(next);
    setConditionState(next);
  }, []);

  const clearCondition = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setConditionState(null);
  }, []);

  return { condition, setCondition, clearCondition };
}

export function getDailyConditionState(condition: DailyCondition | null): DailyConditionState {
  if (!condition) {
    return { energyLevel: 'medium', recommendedTraining: 'treino moderado no plano', messagingTone: 'steady' };
  }

  const { feeling, details } = condition;

  // Adjust based on details when present
  const hasPain = details?.inPain ?? false;
  const isStressed = details?.stressed ?? false;
  const sleptPoorly = details ? !details.sleptWell : false;
  // Onda 4 MaaS — sinais secundários opt-in. Só contam quando respondidos (undefined ≠ "tudo bem").
  const dehydrated = details?.hydrationOk === false;
  const poorNutrition = details?.nutritionLevel === 'poor';
  const highMentalLoad = details?.mentalLoadLevel === 'high';
  const recoverySignals = [
    hasPain, isStressed, sleptPoorly,
    dehydrated, poorNutrition, highMentalLoad,
  ].filter(Boolean).length;

  if (feeling === 'tired' || (feeling === 'normal' && recoverySignals >= 2)) {
    return { energyLevel: 'low', recommendedTraining: 'treino leve ou descanso ativo', messagingTone: 'recovery' };
  }

  if (feeling === 'energized' && recoverySignals === 0) {
    return { energyLevel: 'high', recommendedTraining: 'aproveite para ir além do plano', messagingTone: 'push' };
  }

  return { energyLevel: 'medium', recommendedTraining: 'treino moderado no plano', messagingTone: 'steady' };
}
