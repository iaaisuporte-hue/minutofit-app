import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import '../../../styles/sport.css';
import { useSportProfile } from '../../../features/sport/hooks/useSportProfile';
import { useSportReadiness } from '../../../features/sport/hooks/useSportReadiness';
import { SportReadinessCard } from '../../../features/sport/components/SportReadinessCard';
import { CampTimeline } from '../../../features/sport/components/CampTimeline';
import { PreWorkoutCheckinSheet } from '../../../features/sport/components/PreWorkoutCheckinSheet';
import { SportDashboard } from './SportDashboard';

const BASE = '/app/user/sport';

const TAB = ({ isActive }: { isActive: boolean }) =>
  `navLink${isActive ? ' navLinkActive' : ''}`;

function SportNav() {
  return (
    <nav style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
      <NavLink to={BASE} end className={TAB} style={{ fontSize: 'var(--text-sm)' }}>Dashboard</NavLink>
      <NavLink to={`${BASE}/readiness`} className={TAB} style={{ fontSize: 'var(--text-sm)' }}>Prontidão</NavLink>
      <NavLink to={`${BASE}/checkins`} className={TAB} style={{ fontSize: 'var(--text-sm)' }}>Check-ins</NavLink>
      <NavLink to={`${BASE}/camps`} className={TAB} style={{ fontSize: 'var(--text-sm)' }}>Camp Mode</NavLink>
    </nav>
  );
}

function SportReadinessView() {
  const { readiness, loading } = useSportReadiness();

  if (loading) return <div style={{ color: 'var(--color-text-muted)' }}>Carregando…</div>;

  if (!readiness) {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)', margin: 0 }}>Prontidão de hoje</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>Faça o check-in pré-treino para ver sua prontidão contextual.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)', margin: 0 }}>Prontidão de hoje</h2>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: 'var(--space-5)', background: 'var(--color-surface)' }}>
        <SportReadinessCard />
      </div>
      <div>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>Fatores esportivos</h3>
        {readiness.sport_factors.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Nenhum fator significativo hoje.</p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {readiness.sport_factors.map((f) => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}>{f.label}</div>
                  {f.hint && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{f.hint}</div>}
                </div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: f.delta < 0 ? 'var(--color-danger)' : 'var(--color-success)', flexShrink: 0, marginLeft: 'var(--space-3)' }}>
                  {f.delta > 0 ? '+' : ''}{f.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SportCheckinsView() {
  const [showCheckin, setShowCheckin] = useState(false);

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)', margin: 0 }}>Check-ins pré-treino</h2>
        <button type="button" className="btn btn-primary" style={{ fontSize: 'var(--text-sm)' }} onClick={() => setShowCheckin(true)}>
          Novo check-in
        </button>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
        Histórico detalhado em breve. Faça seu check-in de hoje para registrar seus sinais.
      </p>
      {showCheckin && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'var(--space-4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCheckin(false); }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card) var(--radius-card) 0 0', padding: 'var(--space-6)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <PreWorkoutCheckinSheet onClose={() => setShowCheckin(false)} onSuccess={() => setShowCheckin(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SportHomePage() {
  const { loading, isSportActive } = useSportProfile();

  if (loading) {
    return <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>Carregando…</div>;
  }

  if (!isSportActive) {
    return <Navigate to="/app/user/profile" replace />;
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <SportNav />
      <Routes>
        <Route index element={<SportDashboard />} />
        <Route path="readiness" element={<SportReadinessView />} />
        <Route path="checkins" element={<SportCheckinsView />} />
        <Route path="camps" element={<CampTimeline />} />
        <Route path="*" element={<Navigate to={BASE} replace />} />
      </Routes>
    </div>
  );
}
