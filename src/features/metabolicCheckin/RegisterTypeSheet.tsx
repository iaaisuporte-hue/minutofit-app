import { useNavigate } from 'react-router-dom';
import type { MetabolicCheckinInput } from './types';

// Seletor único de tipo de registro (Fase 1) — resolve o conflito de CTAs.
// Tipos métricos abrem o MetabolicCheckinModal já focado; "Carga de treino"
// roteia para o treino do dia (carga NÃO é campo deste modal); "Foto" em breve.

type RegisterField = keyof MetabolicCheckinInput;

interface Option {
  key: string;
  label: string;
  desc: string;
  field?: RegisterField;
  route?: string;
  soon?: boolean;
}

const OPTIONS: Option[] = [
  { key: 'peso', label: 'Peso', desc: 'Acompanhe a tendência da balança', field: 'weightKg' },
  { key: 'medidas', label: 'Medidas', desc: 'Cintura e % de gordura', field: 'waistCm' },
  { key: 'pressao', label: 'Pressão', desc: 'Sistólica e diastólica', field: 'systolicMmhg' },
  { key: 'glicemia', label: 'Glicemia', desc: 'Glicemia em jejum', field: 'fastingGlucoseMgdl' },
  { key: 'obs', label: 'Observação corporal', desc: 'Uma nota sobre como você está', field: 'notes' },
  { key: 'carga', label: 'Carga de treino', desc: 'Registre no treino do dia', route: '/app/user/today' },
  { key: 'foto', label: 'Foto', desc: 'Em breve', soon: true },
];

export function RegisterTypeSheet({ open, onClose, onPick }: {
  open: boolean;
  onClose: () => void;
  onPick: (field: RegisterField) => void;
}) {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div className="metabolic-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="register-type-title" onClick={onClose}>
      <div className="metabolic-sheet-panel" onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
          <div className="metabolic-eyebrow">Registrar evolução</div>
          <h2 id="register-type-title" className="metabolic-section-title">O que você quer registrar?</h2>
        </div>

        <div className="metabolic-sheet-options">
          {OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className="metabolic-sheet-option"
              disabled={option.soon}
              onClick={() => {
                if (option.soon) return;
                if (option.field) {
                  onPick(option.field);
                } else if (option.route) {
                  onClose();
                  navigate(option.route);
                }
              }}
            >
              <span className="metabolic-sheet-option-label">
                {option.label}
                {option.soon && <span className="metabolic-sheet-soon">em breve</span>}
              </span>
              <span className="metabolic-sheet-option-desc">{option.desc}</span>
            </button>
          ))}
        </div>

        <div className="metabolic-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
