import { useMemo, useState } from 'react';
import {
  MetabolicCheckinModal,
  MetabolicIndicators,
  MetabolicInsightList,
  MetabolicSummaryCard,
  RegisterTypeSheet,
  WeightLoadTrendChart,
  deriveIndicators,
  deriveMetabolicNarrative,
  deriveScreenInsights,
  useMetabolicCheckins,
  type MetabolicCheckinRecord,
  type MetabolicCheckinInput,
} from '../../features/metabolicCheckin';
import '../../features/metabolicCheckin/metabolicCheckin.css';
import { WorkoutProgressSection } from './components/WorkoutProgressSection';
import { useWorkoutStats } from './components/useWorkoutStats';
import { useDailyCondition } from '../../features/dailyCheckin/useDailyCondition';

const DAY_MS = 24 * 60 * 60 * 1000;

type PeriodKey = '7' | '30' | '90' | 'all';

const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: '7', label: '7 dias', days: 7 },
  { key: '30', label: '30 dias', days: 30 },
  { key: '90', label: '90 dias', days: 90 },
  { key: 'all', label: 'Tudo', days: null },
];

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

/** Delta de peso de cada registro vs. o registro de peso imediatamente anterior. Tendência, não diagnóstico. */
function buildWeightDeltas(records: MetabolicCheckinRecord[]) {
  const withWeight = records
    .filter((record) => record.weightKg != null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  const map = new Map<string, string>();
  for (let i = 1; i < withWeight.length; i += 1) {
    const delta = Number(withWeight[i].weightKg) - Number(withWeight[i - 1].weightKg);
    if (Math.abs(delta) >= 0.1) {
      const sign = delta > 0 ? '+' : '−';
      map.set(withWeight[i].id, `${sign}${Math.abs(delta).toFixed(1)}kg vs. registro anterior`);
    }
  }
  return map;
}

function spanInDays(records: MetabolicCheckinRecord[]) {
  if (records.length < 2) return 0;
  const times = records.map((record) => new Date(record.recordedAt).getTime());
  return Math.round((Math.max(...times) - Math.min(...times)) / DAY_MS);
}

export default function MetabolicStatePage() {
  const { records, loading, error, saveCheckin } = useMetabolicCheckins(100);
  const { stats, loading: statsLoading } = useWorkoutStats();
  const { condition } = useDailyCondition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalField, setModalField] = useState<keyof MetabolicCheckinInput | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('30');

  const weightDeltas = useMemo(() => buildWeightDeltas(records), [records]);

  const narrative = useMemo(
    () => (loading || statsLoading ? null : deriveMetabolicNarrative({ records, stats, condition })),
    [records, stats, condition, loading, statsLoading],
  );

  const insights = useMemo(
    () => (loading || statsLoading ? [] : deriveScreenInsights({ records, stats })),
    [records, stats, loading, statsLoading],
  );

  const indicators = useMemo(
    () => (loading || statsLoading ? [] : deriveIndicators({ records, stats })),
    [records, stats, loading, statsLoading],
  );

  // Janela de corte do período selecionado (0 = tudo). Governa gráfico e timeline.
  const cutoff = useMemo(() => {
    const days = PERIODS.find((option) => option.key === period)?.days ?? null;
    return days == null ? 0 : Date.now() - days * DAY_MS;
  }, [period]);

  const visibleRecords = useMemo(
    () => (cutoff === 0 ? records : records.filter((record) => new Date(record.recordedAt).getTime() >= cutoff)),
    [records, cutoff],
  );

  // Tendência só é confiável com alguns registros espalhados no tempo — senão é só uma foto do momento.
  const hasTrend = records.length >= 3 && spanInDays(records) >= 7;

  const openRegister = () => setSheetOpen(true);
  const pickType = (field: keyof MetabolicCheckinInput) => {
    setSheetOpen(false);
    setModalField(field);
  };

  async function handleSave(input: MetabolicCheckinInput) {
    await saveCheckin(input);
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <section className="metabolic-history-page" style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 'var(--space-1)', maxWidth: 640 }}>
            <div className="metabolic-eyebrow">Estado metabólico</div>
            <h1 className="metabolic-section-title" style={{ fontSize: 'var(--text-3xl)' }}>Sua evolução metabólica</h1>
            <p className="metabolic-section-copy">Entenda como seu corpo responde aos treinos, à rotina e ao tempo.</p>
          </div>
          <button type="button" className="btn btn-accent" onClick={openRegister}>Registrar evolução</button>
        </div>
      </section>

      {narrative && <MetabolicSummaryCard narrative={narrative} onAction={openRegister} />}

      {records.length > 0 && (
        <div className="metabolic-period-filter" role="group" aria-label="Filtrar período">
          {PERIODS.map((option) => (
            <button
              type="button"
              key={option.key}
              className={`metabolic-period-chip${period === option.key ? ' is-active' : ''}`}
              aria-pressed={period === option.key}
              onClick={() => setPeriod(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <MetabolicIndicators cards={indicators} onRegister={openRegister} />

      <WeightLoadTrendChart records={records} stats={stats} cutoff={cutoff} />

      <MetabolicInsightList insights={insights} />

      <WorkoutProgressSection stats={stats} loading={statsLoading} />

      <section className="metabolic-history-page" style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
          <div className="metabolic-eyebrow">Linha do tempo</div>
          <h2 className="metabolic-section-title">Registros recentes</h2>
        </div>

        {error && <div className="badge badge-warn" role="alert">{error}</div>}

        {records.length > 0 && !hasTrend && (
          <p className="metabolic-banner">Ainda é uma foto, não uma tendência. Mais alguns registros e o S2Core começa a enxergar como seu corpo está evoluindo.</p>
        )}

        {loading ? (
          <p className="metabolic-section-copy">Carregando suas atualizações...</p>
        ) : records.length === 0 ? (
          <div className="metabolic-empty">
            <p className="metabolic-section-copy">Seus sinais de tendência aparecem aqui depois do primeiro registro. Comece pelo peso — leva 5 segundos.</p>
            <button type="button" className="btn btn-accent" onClick={openRegister}>Registrar meu primeiro sinal</button>
          </div>
        ) : visibleRecords.length === 0 ? (
          <p className="metabolic-section-copy">Nenhum registro neste período. Experimente um intervalo maior.</p>
        ) : (
          <div className="metabolic-history-list">
            {visibleRecords.map((record) => {
              const chips = metricChips(record);
              const delta = weightDeltas.get(record.id);
              return (
                <article className="metabolic-history-item" key={record.id} style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--color-text)' }}>{formatDate(record.recordedAt)}</strong>
                    <span className="metabolic-eyebrow">{record.source === 'onboarding' ? 'Inicial' : 'Atualização'}</span>
                  </div>
                  <div className="metabolic-history-metrics">
                    {chips.map((chip) => <span className="metabolic-history-chip" key={chip}>{chip}</span>)}
                  </div>
                  {delta && <span className="metabolic-history-delta">{delta}</span>}
                  {record.notes && <p className="metabolic-section-copy">{record.notes}</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <RegisterTypeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onPick={pickType} />
      <MetabolicCheckinModal open={modalField !== null} initialField={modalField} onClose={() => setModalField(null)} onSave={handleSave} />
    </div>
  );
}
