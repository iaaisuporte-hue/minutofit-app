import { useState } from 'react';
import type { CampWithDerived, CampPhase } from '../engine/sportConfig.types';
import { useCamp } from '../hooks/useCamp';

const PHASE_ORDER: CampPhase[] = ['base', 'specific', 'peak', 'taper'];
const PHASE_LABELS: Record<CampPhase, string> = {
  base: 'Base',
  specific: 'Específica',
  peak: 'Peak',
  taper: 'Taper',
};
const STATUS_LABELS: Record<string, string> = {
  planning: 'Planejando',
  active: 'Ativo',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

function CampCard({ camp, onUpdate }: { camp: CampWithDerived; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [targetWeight, setTargetWeight] = useState(String(camp.target_weight_kg ?? ''));
  const { update } = useCamp();

  const activePhaseIdx = PHASE_ORDER.indexOf(camp.camp_phase);
  const totalDays = (camp.weeks_planned ?? 8) * 7;
  const elapsed = totalDays - camp.days_remaining;
  const progress = totalDays > 0 ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : 0;

  async function handleSave() {
    await update(camp.id, { target_weight_kg: targetWeight ? parseFloat(targetWeight) : undefined });
    setEditing(false);
    onUpdate();
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text)' }}>
            {camp.event_name}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {new Date(camp.event_date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {camp.category && ` · ${camp.category}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: camp.status === 'active' ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
            color: camp.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)',
            fontWeight: 'var(--font-medium)',
          }}>
            {STATUS_LABELS[camp.status] ?? camp.status}
          </span>
          {camp.status === 'active' && (
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-primary)' }}>
              {camp.days_remaining}d
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {camp.status === 'active' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
            <span>Progresso do camp</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-primary)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Phase timeline */}
      {camp.status === 'active' && (
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {PHASE_ORDER.map((phase, idx) => (
            <div key={phase} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 4,
                borderRadius: 2,
                background: idx <= activePhaseIdx ? 'var(--color-primary)' : 'var(--color-border)',
                marginBottom: 4,
              }} />
              <span style={{
                fontSize: 'var(--text-xs)',
                color: idx === activePhaseIdx ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: idx === activePhaseIdx ? 'var(--font-semibold)' : undefined,
              }}>
                {PHASE_LABELS[phase]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Weight tracking */}
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        {camp.current_weight_kg && (
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Peso atual</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)' }}>
                {Number(camp.current_weight_kg).toFixed(1)} kg
              </div>
            </div>
            {camp.target_weight_kg && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Alvo</div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-primary)' }}>
                  {Number(camp.target_weight_kg).toFixed(1)} kg
                </div>
              </div>
            )}
            {camp.target_weight_kg && camp.current_weight_kg && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>A perder</div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-warn)' }}>
                  {Math.max(0, Number(camp.current_weight_kg) - Number(camp.target_weight_kg)).toFixed(1)} kg
                </div>
              </div>
            )}
          </div>
        )}

        {!editing ? (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', alignSelf: 'flex-start' }} onClick={() => setEditing(true)}>
            {camp.target_weight_kg ? 'Editar peso alvo' : 'Definir peso alvo'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              type="number"
              className="input"
              step="0.1"
              placeholder="Peso alvo (kg)"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              style={{ maxWidth: 140 }}
            />
            <button type="button" className="btn btn-primary" style={{ fontSize: 'var(--text-sm)' }} onClick={handleSave}>Salvar</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)' }} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CampTimeline() {
  const { camps, loading, create, reload } = useCamp();
  const [creating, setCreating] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [weeksPlanned, setWeeksPlanned] = useState('8');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Carregando…</div>;

  async function handleCreate() {
    if (!eventName || !eventDate) return;
    setSubmitting(true);
    try {
      await create({ event_name: eventName, event_date: eventDate, weeks_planned: parseInt(weeksPlanned) || 8 });
      setCreating(false);
      setEventName('');
      setEventDate('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text)', margin: 0 }}>
          Camp Mode
        </h2>
        {!creating && (
          <button type="button" className="btn btn-primary" style={{ fontSize: 'var(--text-sm)' }} onClick={() => setCreating(true)}>
            Nova competição
          </button>
        )}
      </div>

      {creating && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text)' }}>Nova competição</h3>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Nome da competição</label>
              <input type="text" className="input" placeholder="Ex: Copa Regional de JJ" value={eventName} onChange={(e) => setEventName(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Data da competição</label>
              <input type="date" className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Semanas de preparação</label>
              <input type="number" className="input" min="2" max="24" value={weeksPlanned} onChange={(e) => setWeeksPlanned(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" className="btn btn-primary" disabled={submitting || !eventName || !eventDate} onClick={handleCreate}>
              {submitting ? 'Criando…' : 'Criar camp'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {camps.length === 0 && !creating && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Nenhuma competição registrada. Crie um camp para acompanhar sua preparação.
        </div>
      )}

      {camps.map((camp) => (
        <CampCard key={camp.id} camp={camp} onUpdate={reload} />
      ))}
    </div>
  );
}
