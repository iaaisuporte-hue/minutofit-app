import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSportDashboard } from '../../../features/sport/hooks/useSportDashboard';
import { SportReadinessCard } from '../../../features/sport/components/SportReadinessCard';
import { CampModeBanner } from '../../../features/sport/components/CampModeBanner';
import { PreWorkoutCheckinSheet } from '../../../features/sport/components/PreWorkoutCheckinSheet';
import { getRegisteredSports } from '../../../features/sport/engine';

const BASE = '/app/user/sport';

const SIGNAL_LABELS: Record<string, string> = {
  sleep_quality: 'Sono',
  energy_level: 'Energia',
  muscle_soreness: 'Dor muscular',
  joint_soreness: 'Dor articular',
  stress_level: 'Estresse',
  motivation: 'Motivação',
  perceived_readiness: 'Prontidão',
};

function MiniCheckinRow({ checkin }: { checkin: { checkin_date?: string; created_at?: string; sleep_quality: number; energy_level: number; motivation: number; perceived_readiness: number } }) {
  const dateStr = checkin.checkin_date ?? checkin.created_at ?? '';
  const date = dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
  const avg = Math.round((checkin.sleep_quality + checkin.energy_level + checkin.motivation + checkin.perceived_readiness) / 4);
  const color = avg >= 4 ? 'var(--color-success)' : avg <= 2 ? 'var(--color-danger)' : 'var(--color-warn)';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{date}</span>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        {(['sleep_quality', 'energy_level', 'motivation'] as const).map((k) => (
          <span key={k} style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
            {SIGNAL_LABELS[k]}: <strong style={{ color: 'var(--color-text)' }}>{(checkin as any)[k]}/5</strong>
          </span>
        ))}
      </div>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color, background: `color-mix(in srgb, ${color} 12%, transparent)`, padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
        {avg}/5
      </span>
    </div>
  );
}

export function SportDashboard() {
  const { dashboard, isLoading, reload } = useSportDashboard();
  const [showCheckin, setShowCheckin] = useState(false);

  const sports = getRegisteredSports();

  if (isLoading) return <div style={{ color: 'var(--color-text-muted)' }}>Carregando…</div>;

  if (!dashboard) return null;

  const { profile, readiness_today, recent_checkins, active_camp } = dashboard;
  const sportLabel = sports.find((s) => s.key === profile.primary_sport)?.labelPt ?? profile.primary_sport;
  const hasCheckinToday = readiness_today?.has_checkin_today ?? false;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)', margin: 0 }}>
            Fight Intelligence
          </h1>
          {sportLabel && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 4 }}>{sportLabel}</p>}
        </div>
        <button type="button" className="btn btn-primary" style={{ fontSize: 'var(--text-sm)' }} onClick={() => setShowCheckin(true)}>
          {hasCheckinToday ? 'Atualizar check-in' : 'Check-in pré-treino'}
        </button>
      </div>

      {/* Camp banner */}
      {active_camp && <CampModeBanner camp={active_camp} />}

      {/* Readiness card */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: 'var(--space-5)', background: 'var(--color-surface)' }}>
        <SportReadinessCard />
      </div>

      {/* Recent check-ins */}
      {recent_checkins.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text)', margin: 0 }}>
              Últimos check-ins
            </h3>
            <Link to={`${BASE}/checkins`} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', textDecoration: 'none' }}>
              Ver todos →
            </Link>
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {recent_checkins.slice(0, 3).map((c, i) => (
              <MiniCheckinRow key={(c as any).id ?? i} checkin={c as any} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no checkin yet */}
      {!hasCheckinToday && recent_checkins.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>
            Faça seu primeiro check-in para ver sua prontidão de hoje.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setShowCheckin(true)}>
            Fazer check-in agora
          </button>
        </div>
      )}

      {/* Check-in sheet overlay */}
      {showCheckin && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'var(--space-4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCheckin(false); }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card) var(--radius-card) 0 0', padding: 'var(--space-6)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <PreWorkoutCheckinSheet
              onClose={() => setShowCheckin(false)}
              onSuccess={async () => { setShowCheckin(false); await reload(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
