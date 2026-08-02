import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhysicalActivityClearance } from '../../../auth/usePhysicalActivityClearance';
import { useAuth } from '../../../auth/AuthContext';
import { declareParqMedicalRelease } from '../../../services/authApi';
import StudentCompliancePanel from './StudentCompliancePanel';

/**
 * Estado `medical_clearance_required`: o aluno respondeu "sim" a alguma pergunta
 * do PAR-Q. Antes isso não bloqueava nada — a resposta era gravada como evidência
 * e o treino liberava igual. Agora bloqueia, mas com saída: o aluno procura
 * avaliação médica e volta para declarar que obteve a liberação. Sem essa saída
 * o único caminho seria voltar no formulário e responder "não", que é pior.
 */
function MedicalReleaseBlock() {
  const { getUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleDeclare() {
    setError(null);
    setSaving(true);
    try {
      await declareParqMedicalRelease();
      await getUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: '14px 16px',
        borderRadius: 10,
        background: 'var(--color-warn-soft)',
        border: '1px solid var(--color-warn-border)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        Antes de treinar, converse com um médico
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
        Você respondeu “sim” a pelo menos uma pergunta do PAR-Q. Isso não impede que
        você treine — significa que uma avaliação médica deve vir antes, para que o
        treino seja seguro para o seu caso. Quando tiver a liberação de um
        profissional de saúde, confirme abaixo para continuar.
      </div>
      <label style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 10, alignItems: 'start', fontSize: 13 }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(ev) => setConfirmed(ev.target.checked)}
          disabled={saving}
        />
        <span>
          Declaro que fui avaliado por um profissional de saúde e estou liberado
          para praticar atividade física.
        </span>
      </label>
      {error && (
        <div style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</div>
      )}
      <button
        type="button"
        className="btnPrimary"
        onClick={() => void handleDeclare()}
        disabled={!confirmed || saving}
        style={{ justifySelf: 'start' }}
      >
        {saving ? 'Registrando…' : 'Registrar liberação e continuar'}
      </button>
    </div>
  );
}

/**
 * Focused full-page PAR-Q signing flow.
 *
 * Reached when RequireClearance blocks access to a physical-activity route.
 * After the user signs, StudentCompliancePanel calls getUser() which updates
 * physicalActivityClearance. This page watches that value and redirects back
 * to ?returnTo= (or /app/user/today) as soon as clearance becomes valid.
 */
export default function ParqSigningPage() {
  const clearance = usePhysicalActivityClearance();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (clearance.valid) {
      const returnTo = searchParams.get('returnTo');
      const target = returnTo ? decodeURIComponent(returnTo) : '/app/user/today';
      navigate(target, { replace: true });
    }
  }, [clearance.valid, navigate, searchParams]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px 48px',
        background: 'var(--color-bg, var(--color-surface-raised))',
      }}
    >
      <div style={{ maxWidth: 680, width: '100%' }}>
        <div style={{ marginBottom: 24 }}>
          {/* F3 — chegando do onboarding, este é o passo 2 de 2. Quem cai aqui
              por outro caminho (banner, guard de rota) não vê o contador. */}
          {clearance.reason === 'incomplete_health_flags' && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Passo 2 de 2
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Triagem de saúde e PAR-Q
          </h1>
          <p style={{ marginTop: 8, color: 'var(--color-text-muted, var(--color-text-muted))', fontSize: 14 }}>
            Para usar os recursos de treino, preencha a triagem de saúde e assine o PAR-Q abaixo.
            Isso garante sua segurança e é exigido por boas práticas de atividade física.
          </p>
          {clearance.reason === 'medical_clearance_required' && <MedicalReleaseBlock />}
          {clearance.reason === 'expired' && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--color-danger-soft)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger-text, var(--color-danger))',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Sua liberação PAR-Q expirou. Reassine abaixo para retomar os treinos.
            </div>
          )}
        </div>

        <StudentCompliancePanel />
      </div>
    </div>
  );
}
