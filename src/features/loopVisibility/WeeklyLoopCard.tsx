import { useMemo } from 'react';
import type { DailyCondition } from '../dailyCheckin/useDailyCondition';
import { buildWeeklyLoopInsights } from './weeklyLoopInsights';

/**
 * Onda 5 MaaS — Loop Visível.
 *
 * Materializa o princípio "cada sinal capturado volta como adaptação visível"
 * (Skill aluno_signal_loop_review). Lê dados que Tracker e Movement Lab já
 * gravam em localStorage e os transforma em micro-insights — o aluno entende
 * que a semana dele alimenta a recomendação de hoje.
 *
 * Anti-escopo: NÃO refatora ActivityTrackerPage nem MovementLabPage. Só
 * consome o que elas já gravam. Quando não há dados, retorna null (sem
 * placeholder vazio). Use `useHasWeeklyLoopInsights` para evitar wrappers
 * vazios no caller.
 */
export function WeeklyLoopCard({ condition }: { condition?: DailyCondition | null }) {
  const insights = useMemo(() => buildWeeklyLoopInsights(condition), [condition]);
  if (insights.length === 0) return null;
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        padding: 18,
        boxShadow: 'var(--shadow-sm)',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'grid', gap: 2 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          Como sua semana impacta hoje
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Sinais que estão alimentando a recomendação do dia
        </span>
      </div>
      <ul style={{ display: 'grid', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
        {insights.map((insight, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--color-text)',
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                fontSize: 16,
                color: 'var(--color-accent-hover)',
                fontWeight: 700,
                width: 20,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              {insight.icon}
            </span>
            <span>{insight.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
