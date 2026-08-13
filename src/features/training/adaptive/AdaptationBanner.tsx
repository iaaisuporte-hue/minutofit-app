import { useRef, useState } from 'react';
import type { AdaptationChange, RecoverySuggestion } from '../../../services/trainingAdaptiveApi';
import { trackAdaptationBannerViewed } from '../../../services/trainingAdaptiveApi';
import "./adaptation.css";

interface Props {
  changes: AdaptationChange[];
  recoverySuggestion: RecoverySuggestion | null;
  /** Names keyed by exerciseId, for readable display */
  exerciseNames?: Record<string, string>;
}

const FIELD_LABEL: Record<string, string> = {
  sets: 'Séries',
  reps: 'Reps',
  rest: 'Descanso',
  rpe: 'Intensidade (RPE)',
  technique: 'Técnica',
};

export function AdaptationBanner({
  changes,
  recoverySuggestion,
  exerciseNames = {},
  usingOriginal = false,
  onToggleOriginal,
}: Props & { usingOriginal?: boolean; onToggleOriginal?: (usar: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const trackedRef = useRef(false);

  if (changes.length === 0 && !recoverySuggestion) return null;

  // Group changes by exerciseId for display
  const byExercise = new Map<string, AdaptationChange[]>();
  for (const c of changes) {
    const list = byExercise.get(c.exerciseId) ?? [];
    list.push(c);
    byExercise.set(c.exerciseId, list);
  }

  function handleToggle() {
    if (!expanded && !trackedRef.current) {
      trackedRef.current = true;
      void trackAdaptationBannerViewed({ changesCount: changes.length });
    }
    setExpanded(v => !v);
  }

  return (
    <div style={{
      background: 'var(--color-warn-soft, #fff8e1)',
      border: '1px solid var(--color-warn, #f0a500)',
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {/* O título segue a escolha do aluno. Anunciar "ajustado" para quem
            optou pelo original é o app afirmar o que não fez. */}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-warn, #b35a00)' }}>
          {usingOriginal ? 'Você está seguindo o treino original' : 'Treino ajustado para hoje'}
        </span>
        {changes.length > 0 && (
          <button
            onClick={handleToggle}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-warn, #b35a00)', padding: 0, fontWeight: 500 }}
          >
            {expanded ? 'Ocultar' : `Ver ${changes.length} ajuste${changes.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {expanded && changes.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {Array.from(byExercise.entries()).map(([exId, chs]) => (
            <div key={exId} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary, #555)', marginBottom: 4 }}>
                {exerciseNames[exId] ?? chs[0].exerciseId.slice(0, 8) + '…'}
              </div>
              {chs.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.6, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--color-text-secondary, #888)', minWidth: 100 }}>
                    {FIELD_LABEL[c.field] ?? c.field}
                  </span>
                  <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{c.original}</span>
                  <span>→</span>
                  <span style={{ fontWeight: 600 }}>{c.adapted}</span>
                  <span style={{ color: 'var(--color-text-secondary, #888)', fontSize: 11 }}>({c.reason})</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {recoverySuggestion && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(0,0,0,0.08)',
          fontSize: 12, color: 'var(--color-text-secondary, #555)',
          lineHeight: 1.5,
        }}>
          <strong>Alternativa de recuperação:</strong> {recoverySuggestion.microcopy}
        </div>
      )}

      {/*
        Override do aluno.

        O ajuste é uma sugestão, não uma tutela: quem sabe se hoje dá para
        puxar mais é quem está no aparelho. A opção fica DENTRO do banner que
        explica o ajuste, para que a escolha seja informada — e o texto diz o
        que muda, em vez de perguntar "tem certeza?".

        O original nunca deixou de existir: ele chega do servidor em
        `originalPlanDay` e é a prescrição do personal, intocada.
      */}
      {onToggleOriginal ? (
        <button
          type="button"
          className="adapt-original-toggle"
          aria-pressed={usingOriginal}
          onClick={() => onToggleOriginal(!usingOriginal)}
        >
          {usingOriginal
            ? 'Voltar ao treino ajustado de hoje'
            : 'Prefiro seguir o treino original'}
        </button>
      ) : null}
    </div>
  );
}
