import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhysicalActivityClearance } from '../../../auth/usePhysicalActivityClearance';
import StudentCompliancePanel from './StudentCompliancePanel';

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
