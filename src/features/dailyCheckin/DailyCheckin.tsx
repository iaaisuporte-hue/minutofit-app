import { forwardRef, type ReactNode, useImperativeHandle, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Moon, X, Zap } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import type {
  DailyCondition,
  DailyConditionDetails,
  DailyFeeling,
  MentalLoadLevel,
  NutritionLevel,
} from './useDailyCondition';
import { buildCheckinFeedback } from './buildCheckinFeedback';

export interface DailyCheckinHandle {
  openSheet: (feeling?: DailyFeeling) => void;
}

interface Props {
  condition: DailyCondition | null;
  setCondition: (feeling: DailyFeeling, details?: DailyConditionDetails) => void;
  clearCondition: () => void;
  onConditionSet?: () => void;
  onConditionSaved?: (payload: { feeling: DailyFeeling; details: DailyConditionDetails }) => void | Promise<void>;
  /** Presença física registrada hoje na academia — vira gatilho contextual do check-in. */
  academyPresenceToday?: { academyName: string } | null;
}

const FEELING_META: Record<DailyFeeling, { label: string; icon: ReactNode; color: string; bg: string; border: string }> = {
  tired:    { label: 'Cansado',  icon: <Moon size={20} />,  color: 'var(--color-warn)',         bg: 'var(--color-warn-soft)',    border: 'var(--color-warn-border)' },
  normal:   { label: 'Normal',   icon: <Minus size={20} />, color: 'var(--color-accent-hover)', bg: 'var(--color-accent-soft)', border: 'var(--color-accent-border)' },
  energized:{ label: 'Disposto', icon: <Zap size={20} />,   color: 'var(--color-success-text)', bg: 'var(--color-success-soft)',border: 'var(--color-success-border)' },
};

const FEELINGS: DailyFeeling[] = ['tired', 'normal', 'energized'];

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {([true, false] as const).map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
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

function OptionalScaleRow<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T | undefined;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(selected ? undefined : opt.value)}
              style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: selected ? 'var(--color-accent-soft)' : 'transparent',
                color: selected ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const NUTRITION_OPTIONS: ReadonlyArray<{ value: NutritionLevel; label: string }> = [
  { value: 'poor', label: 'Ruim' },
  { value: 'ok',   label: 'OK' },
  { value: 'good', label: 'Bom' },
];

const MENTAL_LOAD_OPTIONS: ReadonlyArray<{ value: MentalLoadLevel; label: string }> = [
  { value: 'low',    label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high',   label: 'Alta' },
];

const HYDRATION_OPTIONS: ReadonlyArray<{ value: 'yes' | 'no'; label: string }> = [
  { value: 'yes', label: 'Sim' },
  { value: 'no',  label: 'Não' },
];

const DEFAULT_DETAILS: DailyConditionDetails = { sleptWell: true, inPain: false, stressed: false };

export const DailyCheckin = forwardRef<DailyCheckinHandle, Props>(function DailyCheckin(
  { condition, setCondition, clearCondition, onConditionSet, onConditionSaved, academyPresenceToday },
  ref,
) {
  const isMobile = useIsMobile(720);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFeeling, setSheetFeeling] = useState<DailyFeeling | null>(null);
  const [details, setDetails] = useState<DailyConditionDetails>({ ...DEFAULT_DETAILS });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');

  useImperativeHandle(ref, () => ({
    openSheet: (feeling?: DailyFeeling) => {
      setSheetFeeling(feeling ?? null);
      setDetails({ ...DEFAULT_DETAILS });
      setSaveState('idle');
      setSheetOpen(true);
    },
  }));

  function openSheet(feeling: DailyFeeling) {
    setSheetFeeling(feeling);
    setDetails({ ...DEFAULT_DETAILS });
    setSaveState('idle');
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setSheetFeeling(null);
    setDetails({ ...DEFAULT_DETAILS });
    setSaveState('idle');
  }

  async function handleConfirm() {
    if (!sheetFeeling) return;
    setSaveState('saving');
    setCondition(sheetFeeling, details);
    onConditionSet?.();
    try {
      await onConditionSaved?.({ feeling: sheetFeeling, details: { ...details } });
      setSaveState('idle');
      closeSheet();
    } catch {
      setSaveState('error');
    }
  }

  function handleChange() {
    clearCondition();
  }

  // ── Estado preenchido: resumo compacto ──────────────────────────────────
  if (condition) {
    const meta = FEELING_META[condition.feeling];
    const feedback = buildCheckinFeedback(condition);
    return (
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '14px 18px',
          display: 'grid',
          gap: 8,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Como você está
            </span>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 999,
                fontSize: 12, fontWeight: 700,
                background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color,
              }}
            >
              {meta.icon} {meta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={handleChange}
            className="hit-target-44"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', padding: '4px 8px', borderRadius: 8 }}
          >
            Alterar
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {feedback}
        </div>
      </div>
    );
  }

  // ── Estado vazio: 3 botões de emoji ───────────────────────────────────
  return (
    <>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: isMobile ? '12px 14px' : '18px 20px',
          boxShadow: 'var(--shadow-md)',
          display: 'grid',
          gap: isMobile ? 10 : 14,
        }}
      >
        <div style={{ display: 'grid', gap: isMobile ? 1 : 3 }}>
          <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Check-in diário
          </span>
          <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--color-text)' }}>
            {academyPresenceToday
              ? `Você treinou na ${academyPresenceToday.academyName} hoje — como está?`
              : 'Como está seu corpo hoje?'}
          </span>
          <span style={{ fontSize: isMobile ? 12 : 13, color: 'var(--color-text-muted)' }}>
            {academyPresenceToday
              ? 'Registramos sua presença. Conte como você se sente para ajustar seu dia.'
              : 'Esses sinais alimentam toda a sua leitura de hoje'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {FEELINGS.map((feeling) => {
            const meta = FEELING_META[feeling];
            return (
              <motion.button
                key={feeling}
                type="button"
                onClick={() => openSheet(feeling)}
                whileTap={{ scale: 0.96 }}
                style={{
                  padding: isMobile ? '9px 6px' : '12px 8px', borderRadius: 14,
                  border: '1.5px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                }}
              >
                {meta.icon}
                {meta.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Sheet/modal de detalhes */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            key="checkin-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: isMobile ? 'flex-end' : 'center',
              justifyContent: 'center',
              padding: isMobile ? '0' : '16px',
            }}
            role="presentation"
          >
            <motion.div
              key="checkin-sheet-panel"
              initial={isMobile ? { y: '100%', opacity: 0 } : { scale: 0.96, opacity: 0 }}
              animate={isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={isMobile ? { y: '100%', opacity: 0 } : { scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              role="dialog"
              aria-modal="true"
              aria-label="Detalhes do check-in"
              style={{
                width: 'min(480px, 100%)',
                maxHeight: isMobile ? '90vh' : '85vh',
                overflowY: 'auto',
                background: 'var(--color-surface)',
                borderRadius: isMobile ? '20px 20px 0 0' : '20px',
                padding: isMobile ? '20px 20px 32px' : '24px 24px 28px',
                display: 'grid',
                gap: 16,
                boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
              }}
            >
              {/* Handle visual — apenas mobile */}
              {isMobile && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: -4 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-strong)' }} />
                </div>
              )}

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'grid', gap: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Check-in diário
                  </span>
                  {sheetFeeling && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '5px 14px', borderRadius: 999,
                          fontSize: 13, fontWeight: 700,
                          background: FEELING_META[sheetFeeling].bg,
                          border: `1px solid ${FEELING_META[sheetFeeling].border}`,
                          color: FEELING_META[sheetFeeling].color,
                        }}
                      >
                        {FEELING_META[sheetFeeling].icon} {FEELING_META[sheetFeeling].label}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {FEELINGS.filter((f) => f !== sheetFeeling).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setSheetFeeling(f)}
                            title={FEELING_META[f].label}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 28, height: 28, borderRadius: 999,
                              border: '1px solid var(--color-border)', background: 'transparent',
                              color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            {FEELING_META[f].icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeSheet}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, borderRadius: 8 }}
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Detalhes */}
              <div style={{ display: 'grid', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Detalhes (opcional)
                </span>
                <ToggleRow label="Dormiu bem?" value={details.sleptWell} onChange={(v) => setDetails((d) => ({ ...d, sleptWell: v }))} />
                <ToggleRow label="Está com dor?" value={details.inPain} onChange={(v) => setDetails((d) => ({ ...d, inPain: v }))} />
                <ToggleRow label="Dia estressante?" value={details.stressed} onChange={(v) => setDetails((d) => ({ ...d, stressed: v }))} />
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Sinais extras (se quiser)
                </span>
                <OptionalScaleRow
                  label="Bem hidratado?"
                  value={details.hydrationOk === true ? 'yes' : details.hydrationOk === false ? 'no' : undefined}
                  options={HYDRATION_OPTIONS}
                  onChange={(v) => setDetails((d) => ({ ...d, hydrationOk: v === 'yes' ? true : v === 'no' ? false : undefined }))}
                />
                <OptionalScaleRow<NutritionLevel>
                  label="Alimentação hoje"
                  value={details.nutritionLevel}
                  options={NUTRITION_OPTIONS}
                  onChange={(v) => setDetails((d) => ({ ...d, nutritionLevel: v }))}
                />
                <OptionalScaleRow<MentalLoadLevel>
                  label="Carga mental"
                  value={details.mentalLoadLevel}
                  options={MENTAL_LOAD_OPTIONS}
                  onChange={(v) => setDetails((d) => ({ ...d, mentalLoadLevel: v }))}
                />
              </div>

              {saveState === 'error' && (
                <div
                  role="alert"
                  style={{ fontSize: 13, color: 'var(--color-danger)', padding: '8px 12px', borderRadius: 8, background: 'var(--color-danger-soft)', border: '1px solid var(--color-danger-border)' }}
                >
                  Não conseguimos salvar. Tente de novo.
                </div>
              )}

              <motion.button
                type="button"
                onClick={handleConfirm}
                disabled={!sheetFeeling || saveState === 'saving'}
                whileHover={saveState !== 'saving' ? { scale: 1.015 } : undefined}
                whileTap={saveState !== 'saving' ? { scale: 0.985 } : undefined}
                style={{
                  padding: '13px 16px', borderRadius: 14, border: 'none',
                  background: saveState === 'saving' ? 'var(--color-border-strong)' : 'var(--gradient-primary)',
                  color: 'var(--color-white)', fontSize: 14, fontWeight: 700, cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                  width: '100%', letterSpacing: '0.02em', transition: 'background 0.2s ease',
                }}
              >
                {saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Tentar de novo' : 'Registrar check-in'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
