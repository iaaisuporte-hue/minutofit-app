import type { ReadinessLens } from '../../../services/trainingAdaptiveApi';

const LEVEL_STYLES: Record<string, { background: string; color: string; dot: string }> = {
  green:  { background: 'var(--color-success-soft, #e6f9ef)', color: 'var(--color-success, #1a7a46)', dot: 'var(--color-success, #1a7a46)' },
  yellow: { background: 'var(--color-warn-soft, #fff8e1)',    color: 'var(--color-warn, #b35a00)',    dot: 'var(--color-warn, #b35a00)' },
  red:    { background: 'var(--color-danger-soft, #fff0f0)',  color: 'var(--color-danger, #c0392b)',  dot: 'var(--color-danger, #c0392b)' },
};

interface Props {
  readiness: ReadinessLens;
  style?: React.CSSProperties;
}

export function ReadinessPill({ readiness, style }: Props) {
  const s = LEVEL_STYLES[readiness.level] ?? LEVEL_STYLES.green;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        background: s.background,
        color: s.color,
        ...style,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {readiness.headline}
    </span>
  );
}
