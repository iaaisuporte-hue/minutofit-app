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
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
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
