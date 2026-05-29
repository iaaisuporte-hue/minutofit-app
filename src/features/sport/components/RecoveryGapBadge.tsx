interface Props {
  gap: number | null;
}

export function RecoveryGapBadge({ gap }: Props) {
  let color: string;
  let label: string;

  if (gap === null || gap === undefined) {
    color = 'var(--color-text-muted)';
    label = 'Sem dado pré';
  } else if (gap > 0) {
    color = 'var(--color-success)';
    label = `+${gap.toFixed(1)} Recuperação positiva`;
  } else {
    color = 'var(--color-danger)';
    label = `${gap.toFixed(1)} Carga excedeu prontidão`;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: '2px 10px',
        borderRadius: 'var(--radius-pill)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-semibold)',
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
