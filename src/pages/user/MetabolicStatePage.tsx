import { useState } from 'react';
import {
  MetabolicCheckinModal,
  MetabolicTrendStrip,
  useMetabolicCheckins,
  type MetabolicCheckinRecord,
  type MetabolicCheckinInput,
} from '../../features/metabolicCheckin';
import '../../features/metabolicCheckin/metabolicCheckin.css';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function metricChips(record: MetabolicCheckinRecord) {
  const chips: string[] = [];
  if (record.weightKg != null) chips.push(`Peso ${record.weightKg.toFixed(1)}kg`);
  if (record.waistCm != null) chips.push(`Cintura ${record.waistCm.toFixed(1)}cm`);
  if (record.bodyFatPct != null) chips.push(`Gordura ${record.bodyFatPct.toFixed(1)}%`);
  if (record.systolicMmhg != null || record.diastolicMmhg != null) chips.push(`Pressão ${record.systolicMmhg ?? '-'} / ${record.diastolicMmhg ?? '-'}`);
  if (record.fastingGlucoseMgdl != null) chips.push(`Glicemia ${record.fastingGlucoseMgdl}mg/dL`);
  return chips;
}

export default function MetabolicStatePage() {
  const { records, loading, error, saveCheckin } = useMetabolicCheckins(100);
  const [modalOpen, setModalOpen] = useState(false);

  async function handleSave(input: MetabolicCheckinInput) {
    await saveCheckin(input);
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <section className="metabolic-history-page" style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 'var(--space-1)', maxWidth: 640 }}>
            <div className="metabolic-eyebrow">Estado metabólico</div>
            <h1 className="metabolic-section-title" style={{ fontSize: 'var(--text-3xl)' }}>Histórico de atualizações</h1>
            <p className="metabolic-section-copy">Acompanhe mudanças de composição, pressão e glicemia em uma linha do tempo simples. A tendência importa mais do que qualquer número isolado.</p>
          </div>
          <button type="button" className="btn btn-accent" onClick={() => setModalOpen(true)}>Nova atualização</button>
        </div>
      </section>

      <MetabolicTrendStrip records={records} loading={loading} />

      <section className="metabolic-history-page" style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
          <div className="metabolic-eyebrow">Linha do tempo</div>
          <h2 className="metabolic-section-title">Registros recentes</h2>
        </div>

        {error && <div className="badge badge-warn" role="alert">{error}</div>}

        {loading ? (
          <p className="metabolic-section-copy">Carregando suas atualizações...</p>
        ) : records.length === 0 ? (
          <p className="metabolic-section-copy">Seus sinais de tendência aparecerão aqui depois do primeiro check-in metabólico.</p>
        ) : (
          <div className="metabolic-history-list">
            {records.map((record) => {
              const chips = metricChips(record);
              return (
                <article className="metabolic-history-item" key={record.id} style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--color-text)' }}>{formatDate(record.recordedAt)}</strong>
                    <span className="metabolic-eyebrow">{record.source === 'onboarding' ? 'Inicial' : 'Atualização'}</span>
                  </div>
                  <div className="metabolic-history-metrics">
                    {chips.map((chip) => <span className="metabolic-history-chip" key={chip}>{chip}</span>)}
                  </div>
                  {record.notes && <p className="metabolic-section-copy">{record.notes}</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <MetabolicCheckinModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}
