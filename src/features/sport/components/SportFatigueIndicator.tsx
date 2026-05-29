import type { FatigueLevel } from '../engine/sportConfig.types';

interface Props {
  fatigue7d: number | null;
  level: FatigueLevel | null;
  sessions7d: number;
}

const LEVEL_COLOR: Record<FatigueLevel, string> = {
  low: 'var(--color-success)',
  moderate: 'var(--color-warn)',
  high: 'var(--color-danger)',
};

const LEVEL_LABEL: Record<FatigueLevel, string> = {
  low: 'Baixa',
  moderate: 'Moderada',
  high: 'Alta',
};

export function SportFatigueIndicator({ fatigue7d, level, sessions7d }: Props) {
  if (fatigue7d === null || level === null) {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>
            Fadiga 7d
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-border)' }} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Nenhum treino registrado.
        </span>
      </div>
    );
  }

  const color = LEVEL_COLOR[level];
  const pct = Math.min(100, Math.max(0, fatigue7d));

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>
          Fadiga 7d
        </span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color, background: `color-mix(in srgb, ${color} 12%, transparent)`, padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
          {LEVEL_LABEL[level]}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-pill)', background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        {sessions7d === 1 ? '1 sessão' : `${sessions7d} sessões`} nos últimos 7 dias
      </span>
    </div>
  );
}
