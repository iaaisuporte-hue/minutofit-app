import { useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { DailyCondition, DailyConditionDetails, DailyFeeling } from './useDailyCondition';

interface Props {
  condition: DailyCondition | null;
  setCondition: (feeling: DailyFeeling, details?: DailyConditionDetails) => void;
  clearCondition: () => void;
  onConditionSet?: () => void;
}

const FEELING_META: Record<DailyFeeling, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  tired:    { label: 'Cansado',  emoji: '😴', color: 'var(--color-warn)',         bg: 'var(--color-warn-soft)',         border: 'var(--color-warn-border)' },
  normal:   { label: 'Normal',   emoji: '😐', color: 'var(--color-accent-hover)', bg: 'var(--color-accent-soft)',       border: 'var(--color-accent-border)' },
  energized:{ label: 'Disposto', emoji: '⚡', color: 'var(--color-success-text)', bg: 'var(--color-success-soft)',      border: 'var(--color-success-border)' },
};

const FEELINGS: DailyFeeling[] = ['tired', 'normal', 'energized'];

const detailExpandVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  show:   { height: 'auto', opacity: 1, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const } },
  exit:   { height: 0, opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } },
};

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {([true, false] as const).map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: '4px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${value === opt ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: value === opt ? 'var(--color-accent-soft)' : 'transparent',
              color: value === opt ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            {opt ? 'Sim' : 'Não'}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DailyCheckin({ condition, setCondition, clearCondition, onConditionSet }: Props) {
  const [pendingFeeling, setPendingFeeling] = useState<DailyFeeling | null>(null);
  const [details, setDetails] = useState<DailyConditionDetails>({
    sleptWell: true,
    inPain: false,
    stressed: false,
  });

  function handleFeelingSelect(feeling: DailyFeeling) {
    setPendingFeeling(feeling);
  }

  function handleConfirm() {
    if (!pendingFeeling) return;
    setCondition(pendingFeeling, details);
    onConditionSet?.();
  }

  function handleChange() {
    clearCondition();
    setPendingFeeling(null);
    setDetails({ sleptWell: true, inPain: false, stressed: false });
  }

  // Completed state — compact badge row
  if (condition) {
    const meta = FEELING_META[condition.feeling];
    return (
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Como você está
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: meta.bg,
              border: `1px solid ${meta.border}`,
              color: meta.color,
            }}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>
        <button
          type="button"
          onClick={handleChange}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            padding: '4px 8px',
            borderRadius: 8,
          }}
        >
          Alterar
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 20,
        padding: '18px 20px',
        boxShadow: 'var(--shadow-md)',
        display: 'grid',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'grid', gap: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Check-in diário
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
          Como está seu corpo hoje?
        </span>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Toque para adaptar sua missão
        </span>
      </div>

      {/* Feeling buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {FEELINGS.map((feeling) => {
          const meta = FEELING_META[feeling];
          const selected = pendingFeeling === feeling;
          return (
            <motion.button
              key={feeling}
              type="button"
              onClick={() => handleFeelingSelect(feeling)}
              whileTap={{ scale: 0.96 }}
              style={{
                padding: '12px 8px',
                borderRadius: 14,
                border: `1.5px solid ${selected ? meta.border : 'var(--color-border)'}`,
                background: selected ? meta.bg : 'transparent',
                color: selected ? meta.color : 'var(--color-text-muted)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
              }}
            >
              <span style={{ fontSize: 20 }}>{meta.emoji}</span>
              {meta.label}
            </motion.button>
          );
        })}
      </div>

      {/* Collapsible detail section */}
      <AnimatePresence>
        {pendingFeeling && (
          <motion.div
            key="details"
            variants={detailExpandVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'grid',
                gap: 10,
                paddingTop: 4,
                borderTop: '1px solid var(--color-border-subtle)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', paddingTop: 8 }}>
                Detalhes (opcional)
              </span>
              <ToggleRow
                label="Dormiu bem?"
                value={details.sleptWell}
                onChange={(v) => setDetails((d) => ({ ...d, sleptWell: v }))}
              />
              <ToggleRow
                label="Está com dor?"
                value={details.inPain}
                onChange={(v) => setDetails((d) => ({ ...d, inPain: v }))}
              />
              <ToggleRow
                label="Dia estressante?"
                value={details.stressed}
                onChange={(v) => setDetails((d) => ({ ...d, stressed: v }))}
              />
              <motion.button
                type="button"
                onClick={handleConfirm}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                style={{
                  marginTop: 4,
                  padding: '12px 16px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'var(--gradient-primary)',
                  color: 'var(--color-white)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                  letterSpacing: '0.02em',
                }}
              >
                Confirmar check-in
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
