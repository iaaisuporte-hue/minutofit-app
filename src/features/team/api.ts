import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';
import type {
  ConsentScope,
  ConsentEntry,
  ProfessionalRole,
  ProfessionalRequest,
  RequestedVia,
  ResolvedProfessional,
  ProfessionalNetworkResponse,
  PublicOffering,
  StudentSubscription,
  CheckoutResponse,
} from './types';

const BASE = `${API_URL}/student`;


export async function listProfessionalNetwork(opts: {
  role?: ProfessionalRole;
  limit?: number;
} = {}): Promise<ProfessionalNetworkResponse> {
  const params = new URLSearchParams();
  if (opts.role) params.set('role', opts.role);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await authFetch(`${BASE}/professional-network${qs ? `?${qs}` : ''}`);
  const payload = await parseJson(res);
  if (!res.ok) throw new Error(payload?.error ?? 'network_list_failed');
  return payload.data as ProfessionalNetworkResponse;
}

export async function resolveProfessional(
  identifier: string,
  role: ProfessionalRole
): Promise<ResolvedProfessional> {
  const res = await authFetch(
    `${BASE}/resolve-professional?identifier=${encodeURIComponent(identifier)}&role=${role}`
  );
  const payload = await parseJson(res);
  if (!res.ok) throw new Error(payload?.error ?? 'professional_not_found');
  return payload as ResolvedProfessional;
}

export async function createConnectionRequest(opts: {
  professionalId: number;
  professionalRole: ProfessionalRole;
  requestedVia: RequestedVia;
  message?: string;
  scopes?: ConsentScope[];
}): Promise<ProfessionalRequest> {
  const res = await authFetch(`${BASE}/professional-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const payload = await parseJson(res);
  if (!res.ok) throw new Error(payload?.error ?? 'create_failed');
  return payload.data as ProfessionalRequest;
}

export async function listOutgoingRequests(): Promise<ProfessionalRequest[]> {
  const res = await authFetch(`${BASE}/professional-requests`);
  const payload = await parseJson(res);
  if (!res.ok) throw new Error('list_failed');
  return payload.data as ProfessionalRequest[];
}

export async function cancelRequest(requestId: string): Promise<void> {
  const res = await authFetch(`${BASE}/professional-requests/${requestId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('cancel_failed');
}

export async function revokeConnection(professionalId: number, role: ProfessionalRole): Promise<void> {
  const res = await authFetch(`${BASE}/connections/${professionalId}?role=${role}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('revoke_failed');
}

export async function listConsents(
  professionalId: number,
  role: ProfessionalRole
): Promise<ConsentEntry[]> {
  const res = await authFetch(`${BASE}/consents/${professionalId}?role=${role}`);
  const payload = await parseJson(res);
  if (!res.ok) throw new Error('list_consents_failed');
  return payload.data as ConsentEntry[];
}

export async function revokeConsent(
  professionalId: number,
  role: ProfessionalRole,
  scope: ConsentScope
): Promise<void> {
  const res = await authFetch(`${BASE}/consents/${professionalId}/revoke`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, scope }),
  });
  if (!res.ok) throw new Error('revoke_consent_failed');
}

export async function grantConsent(
  professionalId: number,
  role: ProfessionalRole,
  scope: ConsentScope
): Promise<void> {
  const res = await authFetch(`${BASE}/consents/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ professionalId, role, scope }),
  });
  if (!res.ok) throw new Error('grant_consent_failed');
}

export async function listIncomingRequests(role: ProfessionalRole): Promise<ProfessionalRequest[]> {
  const res = await authFetch(`${BASE}/incoming-requests/${role}`);
  const payload = await parseJson(res);
  if (!res.ok) throw new Error('list_incoming_failed');
  return payload.data as ProfessionalRequest[];
}

export async function acceptRequest(requestId: string): Promise<void> {
  const res = await authFetch(`${BASE}/incoming-requests/${requestId}/accept`, { method: 'POST' });
  if (!res.ok) {
    // Spec 029 — limite de alunos do plano. A solicitação continua `pending`,
    // então basta fazer upgrade e aceitar de novo.
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error === 'student_limit_reached' ? 'student_limit_reached' : 'accept_failed');
  }
}

export async function rejectRequest(requestId: string, reason?: string): Promise<void> {
  const res = await authFetch(`${BASE}/incoming-requests/${requestId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('reject_failed');
}

// ── US4: planos pagos do aluno ────────────────────────────────────────────

export async function listProfessionalOfferings(professionalId: number): Promise<PublicOffering[]> {
  const res = await authFetch(`${BASE}/professionals/${professionalId}/offerings`);
  const payload = await parseJson(res);
  if (!res.ok) throw new Error(payload?.error ?? 'list_offerings_failed');
  return (payload.data ?? []) as PublicOffering[];
}

export async function startCheckout(offeringId: string): Promise<CheckoutResponse> {
  const res = await authFetch(`${BASE}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offeringId }),
  });
  const payload = await parseJson(res);
  if (!res.ok) throw Object.assign(new Error(payload?.error ?? 'checkout_failed'), { details: payload?.details });
  return payload.data as CheckoutResponse;
}

export async function listMySubscriptions(): Promise<StudentSubscription[]> {
  const res = await authFetch(`${BASE}/subscriptions`);
  const payload = await parseJson(res);
  if (!res.ok) throw new Error('list_subscriptions_failed');
  return (payload.data ?? []) as StudentSubscription[];
}

export async function cancelMySubscription(subscriptionId: string): Promise<StudentSubscription> {
  const res = await authFetch(`${BASE}/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  const payload = await parseJson(res);
  if (!res.ok) throw new Error(payload?.error ?? 'cancel_failed');
  return payload.data as StudentSubscription;
}
