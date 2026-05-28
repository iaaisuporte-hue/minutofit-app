import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReadinessSnapshot, RiskLevel } from '../engine/sportConfig.types';
import { useSportReadiness } from '../hooks/useSportReadiness';
import { PreWorkoutCheckinSheet } from './PreWorkoutCheckinSheet';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'var(--color-success)',
  moderate: 'var(--color-warn)',
  high: 'var(--color-danger)',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Boa prontidão',
  moderate: 'Prontidão moderada',
  high: 'Recuperação recomendada',
};

function ReadinessDisplay({ readiness }: { readiness: ReadinessSnapshot }) {
  const color = RISK_COLORS[readiness.risk_level];
  const factors = readiness.sport_factors ?? [];

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          border: `3px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color }}>
            {readiness.final_score}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color }}>
            {RISK_LABELS[readiness.risk_level]}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {readiness.recommendation}
          </div>
        </div>
      </div>

      {factors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {factors.map((f) => (
            <span
              key={f.id}
              title={f.hint}
              style={{
                fontSize: 'var(--text-xs)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: f.delta < 0 ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)' : 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                color: f.delta < 0 ? 'var(--color-danger)' : 'var(--color-success)',
                fontWeight: 'var(--font-medium)',
                cursor: f.hint ? 'help' : 'default',
              }}
            >
              {f.delta > 0 ? '+' : ''}{f.delta} {f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SportReadinessCard() {
  const { readiness, loading, reload } = useSportReadiness();
  const navigate = useNavigate();
  const [showCheckin, setShowCheckin] = useState(false);

  if (loading) return null;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text)' }}>
          Prontidão esportiva
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {readiness && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }} onClick={() => navigate('/app/user/sport/readiness')}>
              Ver detalhes →
            </button>
          )}
          <button type="button" className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }} onClick={() => setShowCheckin(true)}>
            {readiness ? 'Atualizar' : 'Check-in'}
          </button>
        </div>
      </div>

      {readiness ? (
        <ReadinessDisplay readiness={readiness} />
      ) : (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Faça o check-in pré-treino para ver sua prontidão de hoje.
        </div>
      )}

      {showCheckin && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: 'var(--space-4)',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCheckin(false); }}
        >
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
            padding: 'var(--space-6)',
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <PreWorkoutCheckinSheet
              onClose={() => setShowCheckin(false)}
              onSuccess={async () => {
                setShowCheckin(false);
                await reload();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
