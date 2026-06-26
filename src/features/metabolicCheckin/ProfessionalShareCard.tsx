import { useNavigate } from 'react-router-dom';
import { useProfessionalContext } from '../professionalVoice';

// Transparência (Spec 014) — mostra ao aluno quem o acompanha e leva ao
// gerenciamento de consent. Pacto de dados: o aluno controla o que cada
// profissional vê. Só aparece quando há profissional vinculado.
export function ProfessionalShareCard() {
  const { data } = useProfessionalContext();
  const navigate = useNavigate();

  const personal = data?.personal ?? null;
  const nutri = data?.nutri ?? null;
  if (!personal && !nutri) return null;

  let who: string;
  if (personal && nutri) who = `Seu personal ${personal.name} e sua nutricionista ${nutri.name} acompanham você.`;
  else if (personal) who = `Seu personal ${personal.name} acompanha você.`;
  else who = `Sua nutricionista ${nutri!.name} acompanha você.`;

  return (
    <section className="metabolic-history-page" style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <div className="metabolic-eyebrow">Acompanhamento</div>
      <h2 className="metabolic-section-title">Quem acompanha sua evolução</h2>
      <p className="metabolic-section-copy">{who} Você controla o que cada profissional vê.</p>
      <button type="button" className="metabolic-summary-link" onClick={() => navigate('/app/user/equipe')}>
        Gerenciar acesso <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
