import { useCallback, useEffect, useState } from 'react';
import { dayKey } from '../../lib/appDay';

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

// Dia do aluno, não dia UTC — ver lib/appDay.ts. Com toISOString() a condição
// diária "expirava" às 21h (BRT) e o app pedia um novo check-in no mesmo dia.
function todayISO(): string {
  return dayKey();
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

/**
 * Resposta do servidor → `DailyCondition`, com validação.
 *
 * Vem de `gamification.todayCondition` (JSON não tipado): se o formato mudar ou
 * vier lixo, devolvemos `null` e o app segue com o estado local em vez de
 * quebrar a Home.
 */
export function parseRemoteCondition(raw: unknown): DailyCondition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const feeling = r.feeling;
  if (feeling !== 'tired' && feeling !== 'normal' && feeling !== 'energized') return null;
  if (typeof r.date !== 'string') return null;
  const d = (r.details ?? null) as Record<string, unknown> | null;
  return {
    date: r.date,
    feeling,
    details: d
      ? {
          sleptWell: d.sleptWell === true,
          inPain: d.inPain === true,
          stressed: d.stressed === true,
          ...(typeof d.hydrationOk === 'boolean' ? { hydrationOk: d.hydrationOk } : {}),
          ...(d.nutritionLevel === 'poor' || d.nutritionLevel === 'ok' || d.nutritionLevel === 'good'
            ? { nutritionLevel: d.nutritionLevel }
            : {}),
          ...(d.mentalLoadLevel === 'low' || d.mentalLoadLevel === 'medium' || d.mentalLoadLevel === 'high'
            ? { mentalLoadLevel: d.mentalLoadLevel }
            : {}),
        }
      : null,
  };
}

/**
 * Condição do dia do aluno.
 *
 * `remote` é a resposta já gravada no servidor (`gamification.todayCondition`).
 * Sem ela o estado era SÓ localStorage, e o check-in reaparecia no mesmo dia em
 * qualquer contexto sem aquele storage: outro aparelho, aba anônima, dados do
 * app limpos, reinstalação — e, no app empacotado, sempre que o WebView
 * descartava o storage. O servidor é a fonte da verdade; o storage vira cache
 * (mantém a resposta à vista offline e antes do fetch chegar).
 *
 * Só o servidor DIZENDO que respondeu sobrescreve o local. O contrário não:
 * quem responde offline tem a resposta preservada até a escrita subir, em vez
 * de ver a pergunta voltar porque o servidor ainda não sabe.
 */
export function useDailyCondition(remote?: unknown) {
  const [condition, setConditionState] = useState<DailyCondition | null>(() => readFromStorage());

  // Serializado de propósito: o valor cru vem de um objeto de estado e trocaria
  // de identidade a cada render se fosse comparado por referência.
  const remoteKey = remote == null ? null : JSON.stringify(remote);
  useEffect(() => {
    if (!remoteKey) return;
    const vinda = parseRemoteCondition(JSON.parse(remoteKey));
    if (!vinda || vinda.date !== todayISO()) return;
    setConditionState((atual) => {
      if (atual && atual.date === vinda.date && atual.feeling === vinda.feeling) return atual;
      writeToStorage(vinda);
      return vinda;
    });
  }, [remoteKey]);

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
