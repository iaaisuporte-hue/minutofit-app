import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../features/metabolicCheckin/metabolicCheckin.css';
import '../../features/performance/performance.css';
import { postPerformanceEvent } from '../../features/performance/performanceEvents';
import { MedicalDisclaimer } from '../../components/MedicalDisclaimer';

/**
 * Evolução — host das sub-abas (Spec 033, Onda P1).
 *
 * A tela já era o lugar onde o aluno olhava para trás (metabolismo, progressão
 * de carga, histórico, fotos), só que tudo empilhado numa rolagem só. Virou um
 * host de abas para caber o módulo Performance sem criar destino novo: a bottom
 * nav mobile está travada em 5 itens por teste de contrato, e mais um item ali
 * custaria mais do que resolve.
 *
 * A aba fica na URL (`?tab=`) e não no estado local. Isso dá deep link
 * (`/app/user/evolucao?tab=historico`), sobrevive ao F5 e ao botão voltar do
 * Android — que num PWA é o gesto de navegação principal.
 *
 * Cada aba é `lazy`: quem abre a Evolução para ver o metabolismo não baixa o
 * recharts do histórico junto.
 */

const OverviewTab = lazy(() => import('./evolution/OverviewTab'));
const ProgressionTab = lazy(() => import('./evolution/ProgressionTab'));
const HistoryTab = lazy(() => import('./evolution/HistoryTab'));
const ConsistencyTabLazy = lazy(() =>
  import('../../features/performance/ConsistencyTab').then((m) => ({ default: m.ConsistencyTab })),
);
const RecordsTab = lazy(() => import('./evolution/RecordsTab'));
const GoalsTab = lazy(() => import('./evolution/GoalsTab'));

export const EVOLUTION_TABS = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'progressao', label: 'Progressão' },
  { id: 'recordes', label: 'Recordes' },
  { id: 'consistencia', label: 'Consistência' },
  { id: 'metas', label: 'Metas', soon: true },
  { id: 'historico', label: 'Histórico' },
] as const;

export type EvolutionTabId = (typeof EVOLUTION_TABS)[number]['id'];

const DEFAULT_TAB: EvolutionTabId = 'visao-geral';

function isValidTab(value: string | null): value is EvolutionTabId {
  return value != null && EVOLUTION_TABS.some((t) => t.id === value);
}

export default function MetabolicStatePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  // Aba desconhecida (link velho, typo) cai na primeira em vez de tela branca.
  const active: EvolutionTabId = isValidTab(raw) ? raw : DEFAULT_TAB;

  useEffect(() => {
    postPerformanceEvent('performance.opened', { tab: active });
    // Só na montagem: trocar de aba emite `tab_viewed`, não `opened`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTab = useCallback(
    (id: EvolutionTabId) => {
      // `replace` para a Evolução não empilhar uma entrada de histórico por
      // toque: o voltar do Android deve sair da tela, não desfazer 6 abas.
      setSearchParams(id === DEFAULT_TAB ? {} : { tab: id }, { replace: true });
      postPerformanceEvent('performance.tab_viewed', { tab: id });
    },
    [setSearchParams],
  );

  // Máscara da borda direita só enquanto houver aba fora de vista. Sem isto, em
  // 360px o aluno vê 3 das 6 abas e nada indica que dá para arrastar.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const syncScrollEnd = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);
  useEffect(() => {
    syncScrollEnd();
    window.addEventListener('resize', syncScrollEnd);
    return () => window.removeEventListener('resize', syncScrollEnd);
  }, [syncScrollEnd]);

  const panel = useMemo(() => {
    switch (active) {
      case 'progressao':
        return <ProgressionTab />;
      case 'recordes':
        return <RecordsTab />;
      case 'consistencia':
        return <ConsistencyTabLazy />;
      case 'metas':
        return <GoalsTab />;
      case 'historico':
        return <HistoryTab />;
      default:
        return <OverviewTab />;
    }
  }, [active]);

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <h1 className="metabolic-section-title" style={{ fontSize: 'var(--text-3xl)' }}>
          Sua evolução
        </h1>
        <p className="metabolic-section-copy">
          Metabolismo, treino e consistência — o que mudou desde que você começou.
        </p>
      </div>

      <div
        ref={tabsRef}
        onScroll={syncScrollEnd}
        className={`perf-tabs${atEnd ? ' is-scroll-end' : ''}`}
        role="tablist"
        aria-label="Seções da evolução"
      >
        {EVOLUTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`evolution-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls="evolution-panel"
            className={`perf-tab${active === tab.id ? ' is-active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
            {'soon' in tab && tab.soon && <span className="perf-tab-soon">em breve</span>}
          </button>
        ))}
      </div>

      <div id="evolution-panel" role="tabpanel" aria-labelledby={`evolution-tab-${active}`}>
        <Suspense fallback={<p className="metabolic-section-copy">Carregando...</p>}>{panel}</Suspense>
      </div>

      {/* Fica no host, não em uma aba: com o refactor a Evolução virou seis
          telas, e o aviso precisa valer em todas — não só onde ele nasceu. */}
      <section style={{ padding: 'var(--space-4) 0 var(--space-2)' }}>
        <MedicalDisclaimer />
      </section>
    </div>
  );
}
