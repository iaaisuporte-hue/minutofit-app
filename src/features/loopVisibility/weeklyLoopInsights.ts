import { useMemo } from 'react';
import type { DailyCondition } from '../dailyCheckin/useDailyCondition';

/**
 * Helpers da Onda 5 MaaS — Loop Visível.
 *
 * Lê dados que ActivityTrackerPage e MovementLabPage já gravam em
 * localStorage (sem refatorá-las) e transforma em micro-insights derivados.
 * Quando o aluno ainda não usou Tracker ou Lab, retorna lista vazia — o
 * card consumidor não renderiza placeholder.
 */

export interface LoopInsight {
  icon: string;
  text: string;
}

const TRACKER_KEY = 'activities';
const MOVEMENT_KEY = 'corefit:movement:sessions';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function readActivitiesLast7d(): { totalMinutes: number; cardioSessions: number } {
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    if (!raw) return { totalMinutes: 0, cardioSessions: 0 };
    const activities = JSON.parse(raw) as Array<{
      duration: number;
      type: 'walk' | 'run' | 'cycling';
      startTime: string;
    }>;
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const recent = activities.filter((a) => new Date(a.startTime).getTime() >= cutoff);
    const totalMinutes = recent.reduce((s, a) => s + Math.round(a.duration / 60), 0);
    const cardioSessions = recent.filter((a) => a.type === 'run' || a.type === 'cycling').length;
    return { totalMinutes, cardioSessions };
  } catch {
    return { totalMinutes: 0, cardioSessions: 0 };
  }
}

function readMovementLast7d(): {
  latest: { exerciseLabel: string; avgFormScore: number; timestamp: number } | null;
} {
  try {
    const raw = localStorage.getItem(MOVEMENT_KEY);
    if (!raw) return { latest: null };
    const sessions = JSON.parse(raw) as Array<{
      exerciseLabel: string;
      avgFormScore: number;
      timestamp: number;
    }>;
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const recent = sessions
      .filter((s) => s.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (recent.length === 0) return { latest: null };
    return {
      latest: {
        exerciseLabel: recent[0].exerciseLabel,
        avgFormScore: recent[0].avgFormScore,
        timestamp: recent[0].timestamp,
      },
    };
  } catch {
    return { latest: null };
  }
}

export function buildWeeklyLoopInsights(condition?: DailyCondition | null): LoopInsight[] {
  const activity = readActivitiesLast7d();
  const movement = readMovementLast7d();
  const insights: LoopInsight[] = [];

  // 0) Check-in de hoje — prioridade sobre Tracker e Lab
  if (condition) {
    const details = condition.details;
    const hasAttentionSignal = Boolean(
      details?.inPain ||
      details?.stressed ||
      (details && !details.sleptWell) ||
      details?.hydrationOk === false ||
      details?.nutritionLevel === "poor" ||
      details?.mentalLoadLevel === "high"
    );
    const isPositive = condition.feeling === "energized" && !hasAttentionSignal;

    if (hasAttentionSignal) {
      const negativeSignals: string[] = [];
      if (details?.inPain) negativeSignals.push("dor");
      if (details && !details.sleptWell) negativeSignals.push("sono curto");
      if (details?.stressed) negativeSignals.push("estresse");
      if (details?.hydrationOk === false) negativeSignals.push("pouca hidratação");
      if (details?.nutritionLevel === "poor") negativeSignals.push("alimentação fraca");
      if (details?.mentalLoadLevel === "high") negativeSignals.push("carga mental alta");
      const signalList = negativeSignals.slice(0, 3).join(", ");
      insights.push({
        icon: "◐",
        text: `Check-in de hoje (${signalList}) já entrou na sua leitura semanal — recomendação ajustada para recuperação.`,
      });
    } else if (isPositive) {
      insights.push({
        icon: "✓",
        text: "Check-in positivo hoje — semana segue em ritmo saudável.",
      });
    }
  }

  // 1) Atividade — intensidade da semana
  if (activity.totalMinutes > 0) {
    if (activity.totalMinutes >= 90) {
      insights.push({
        icon: '↗',
        text: `${activity.totalMinutes} min de atividade nessa semana. Sua base aeróbica está sólida — hoje pode focar em força sem cardio extra.`,
      });
    } else if (activity.totalMinutes >= 30) {
      insights.push({
        icon: '→',
        text: `${activity.totalMinutes} min nessa semana. Bom ritmo — manter movimento hoje sustenta o estado metabólico.`,
      });
    } else {
      insights.push({
        icon: '◌',
        text: 'Pouco movimento na semana. Começar leve hoje (caminhada ou mobilidade) aquece sem sobrecarga.',
      });
    }
  }

  // 2) Movement Lab — qualidade da última sessão
  if (movement.latest) {
    const daysAgo = Math.max(
      0,
      Math.floor((Date.now() - movement.latest.timestamp) / (1000 * 60 * 60 * 24))
    );
    const when = daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : `há ${daysAgo} dias`;
    const formScore = Math.round(movement.latest.avgFormScore);
    if (formScore >= 80) {
      insights.push({
        icon: '✓',
        text: `Forma de ${movement.latest.exerciseLabel} ${when} sólida (${formScore}/100). Pode aumentar carga com segurança.`,
      });
    } else if (formScore >= 60) {
      insights.push({
        icon: '◐',
        text: `Forma de ${movement.latest.exerciseLabel} ${when} razoável (${formScore}/100). Hoje vale priorizar técnica sobre carga.`,
      });
    } else {
      insights.push({
        icon: '◯',
        text: `Forma de ${movement.latest.exerciseLabel} ${when} caiu (${formScore}/100). Reduzir carga e revisar movimento hoje protege contra lesão.`,
      });
    }
  }

  return insights.slice(0, 3);
}

/**
 * Hook utilitário: permite ao caller evitar wrappers vazios (motion.div
 * em grid com gap) quando não há insights a mostrar.
 */
export function useHasWeeklyLoopInsights(condition?: DailyCondition | null): boolean {
  return useMemo(() => buildWeeklyLoopInsights(condition).length > 0, [condition]);
}
