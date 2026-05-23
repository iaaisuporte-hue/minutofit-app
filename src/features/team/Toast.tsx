import { useEffect } from 'react';
import { COLORS } from '../../styles/colors';

interface Props {
  message: string;
  kind?: 'success' | 'error' | 'info';
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, kind = 'info', onDismiss, durationMs = 3200 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  const bg =
    kind === 'success' ? COLORS.successBg :
    kind === 'error' ? COLORS.dangerSoft :
    COLORS.blueBg;
  const border =
    kind === 'success' ? COLORS.successBorder :
    kind === 'error' ? COLORS.dangerBorder :
    COLORS.blueBorder;
  const color =
    kind === 'error' ? COLORS.danger : COLORS.text;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: '10px 16px',
        fontSize: 13,
        color,
        fontWeight: 500,
        zIndex: 1200,
        boxShadow: 'var(--shadow-md)',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {message}
    </div>
  );
}
