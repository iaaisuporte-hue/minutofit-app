import { useAuth } from './AuthContext';

export type ClearanceReason =
  | 'ok'
  | 'never_signed'
  | 'expired'
  | 'incomplete_health_flags'
  /**
   * Respondeu "sim" no PAR-Q ou declarou uma condição de saúde. Não é bloqueio
   * definitivo: o aluno declara a liberação médica obtida e segue.
   */
  | 'medical_clearance_required'
  | 'not_applicable';

export interface PhysicalActivityClearance {
  valid: boolean;
  signedAt: string | null;
  expiresAt: string | null;
  reason: ClearanceReason;
}

/**
 * Returns the physical-activity clearance for the current user.
 *
 * - For non-user roles (personal, nutri, admin): always valid (not_applicable).
 * - Combines server-provided clearance with a client-side expiry guard so that
 *   a session that crosses the expiry boundary detects it without a refresh.
 */
export function usePhysicalActivityClearance(): PhysicalActivityClearance {
  const { user, role } = useAuth();

  if (!user || role !== 'user') {
    return { valid: true, signedAt: null, expiresAt: null, reason: 'not_applicable' };
  }

  const server = user.physicalActivityClearance;
  if (!server) {
    return { valid: false, signedAt: null, expiresAt: null, reason: 'never_signed' };
  }

  // Client-side expiry guard: if the session is still alive but the token has
  // crossed the expiry boundary, treat it as expired without waiting for a re-fetch.
  if (server.valid && server.expiresAt && new Date(server.expiresAt) <= new Date()) {
    return { ...server, valid: false, reason: 'expired' };
  }

  return server as PhysicalActivityClearance;
}
