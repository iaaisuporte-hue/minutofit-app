import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSportProfile } from '../hooks/useSportProfile';
import { useSportHasPersonal } from '../hooks/useSportHasPersonal';
import { getRegisteredSports } from '../engine';
import type { SportLevel, SportGoal } from '../engine/sportConfig.types';
import { SportConsentPromptModal } from './SportConsentPromptModal';

const LEVELS: { value: SportLevel; label: string }[] = [
  { value: 'beginner', label: 'Iniciante' },
  { value: 'intermediate', label: 'Intermediário' },
  { value: 'advanced', label: 'Avançado' },
  { value: 'competitor', label: 'Competidor' },
];

const GOALS: { value: SportGoal; label: string }[] = [
  { value: 'performance', label: 'Performance' },
  { value: 'competition', label: 'Competição' },
  { value: 'strength', label: 'Força' },
  { value: 'endurance', label: 'Resistência' },
  { value: 'weight_loss', label: 'Emagrecimento' },
  { value: 'recovery', label: 'Recuperação' },
  { value: 'health', label: 'Saúde geral' },
];

export function SportProfileSection() {
  const { profile, loading, isSportActive, save, deactivate } = useSportProfile();
  const { hasPersonal, personalId, loading: personalLoading } = useSportHasPersonal();
  const navigate = useNavigate();
  const sports = getRegisteredSports();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    if (loading || personalLoading) return;
    if (isSportActive && hasPersonal && personalId !== null) {
      setShowConsentModal(true);
    }
  }, [loading, personalLoading, isSportActive, hasPersonal, personalId]);
  const [primarySport, setPrimarySport] = useState('jiu_jitsu');
  const [sportLevel, setSportLevel] = useState<SportLevel>('intermediate');
  const [graduationRank, setGraduationRank] = useState('');
  const [weeklyFrequency, setWeeklyFrequency] = useState(3);
  const [competes, setCompetes] = useState(false);
  const [primaryGoal, setPrimaryGoal] = useState<SportGoal>('performance');

  function openEditor() {
    if (profile) {
      setPrimarySport(profile.primary_sport);
      setSportLevel(profile.sport_level);
      setGraduationRank(profile.graduation_rank ?? '');
      setWeeklyFrequency(profile.weekly_frequency);
      setCompetes(profile.competes);
      setPrimaryGoal(profile.primary_goal);
    }
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        primary_sport: primarySport,
        sport_level: sportLevel,
        graduation_rank: graduationRank || null,
        weekly_frequency: weeklyFrequency,
        competes,
        primary_goal: primaryGoal,
      });
      setEditing(false);
      if (hasPersonal && personalId !== null) {
        setShowConsentModal(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!window.confirm('Desativar Fight Intelligence? Seu histórico será preservado.')) return;
    await deactivate();
  }

  const selectedSport = sports.find((s) => s.key === primarySport);
  const gradOptions = selectedSport?.graduationOptions ?? [];

  if (loading) return null;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {showConsentModal && personalId !== null && (
        <SportConsentPromptModal
          personalId={personalId}
          onAccept={() => setShowConsentModal(false)}
          onDecline={() => setShowConsentModal(false)}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)' }}>
            Fight Intelligence
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {isSportActive ? 'Área esportiva ativa' : 'Ative para acessar a área esportiva'}
          </div>
        </div>
        {isSportActive && !editing && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)' }} onClick={() => navigate('/app/user/sport')}>
              Ir para esporte →
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)' }} onClick={openEditor}>
              Editar
            </button>
          </div>
        )}
      </div>

      {!isSportActive && !editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)', margin: 0 }}>
            Configure seu esporte principal e desbloqueie readiness contextual, check-ins pré-treino e Camp Mode.
          </p>
          <button type="button" className="btn btn-primary" onClick={openEditor}>
            Ativar Fight Intelligence
          </button>
        </div>
      )}

      {isSportActive && !editing && profile && (
        <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <DataRow label="Esporte" value={sports.find((s) => s.key === profile.primary_sport)?.labelPt ?? profile.primary_sport} />
          <DataRow label="Nível" value={LEVELS.find((l) => l.value === profile.sport_level)?.label ?? profile.sport_level} />
          {profile.graduation_rank && <DataRow label="Graduação" value={profile.graduation_rank} />}
          <DataRow label="Frequência" value={`${profile.weekly_frequency}x/sem`} />
          <DataRow label="Compete?" value={profile.competes ? 'Sim' : 'Não'} />
          <DataRow label="Objetivo" value={GOALS.find((g) => g.value === profile.primary_goal)?.label ?? profile.primary_goal} />
        </div>
      )}

      {editing && (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <FormRow label="Esporte principal">
            <select
              className="input"
              value={primarySport}
              onChange={(e) => { setPrimarySport(e.target.value); setGraduationRank(''); }}
            >
              {sports.map((s) => <option key={s.key} value={s.key}>{s.labelPt}</option>)}
            </select>
          </FormRow>

          <FormRow label="Nível">
            <select className="input" value={sportLevel} onChange={(e) => setSportLevel(e.target.value as SportLevel)}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </FormRow>

          {gradOptions.length > 0 && (
            <FormRow label="Graduação">
              <select className="input" value={graduationRank} onChange={(e) => setGraduationRank(e.target.value)}>
                <option value="">— selecionar —</option>
                {gradOptions.map((g) => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </FormRow>
          )}

          <FormRow label="Frequência semanal">
            <input
              type="number"
              className="input"
              min={1}
              max={14}
              value={weeklyFrequency}
              onChange={(e) => setWeeklyFrequency(Number(e.target.value))}
            />
          </FormRow>

          <FormRow label="Objetivo">
            <select className="input" value={primaryGoal} onChange={(e) => setPrimaryGoal(e.target.value as SportGoal)}>
              {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </FormRow>

          <FormRow label="Compete?">
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={competes} onChange={(e) => setCompetes(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Sim, participo de competições</span>
            </label>
          </FormRow>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            {isSportActive && (
              <button type="button" className="btn btn-ghost" style={{ marginLeft: 'auto', color: 'var(--color-danger)' }} onClick={handleDeactivate}>
                Desativar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-text)', fontWeight: 'var(--font-medium)' }}>{value}</span>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-medium)' }}>{label}</label>
      {children}
    </div>
  );
}
