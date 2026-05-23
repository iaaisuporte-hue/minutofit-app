import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';
import type {
  ConsentScope,
  ConsentEntry,
  ProfessionalRole,
  ProfessionalRequest,
  RequestedVia,
  ResolvedProfessional,
} from './types';

const BASE = `${API_URL}/student`;

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

export async function listIncomingRequests(role: ProfessionalRole): Promise<ProfessionalRequest[]> {
  const res = await authFetch(`${BASE}/incoming-requests/${role}`);
  const payload = await parseJson(res);
  if (!res.ok) throw new Error('list_incoming_failed');
  return payload.data as ProfessionalRequest[];
}

export async function acceptRequest(requestId: string): Promise<void> {
  const res = await authFetch(`${BASE}/incoming-requests/${requestId}/accept`, { method: 'POST' });
  if (!res.ok) throw new Error('accept_failed');
}

export async function rejectRequest(requestId: string, reason?: string): Promise<void> {
  const res = await authFetch(`${BASE}/incoming-requests/${requestId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('reject_failed');
}
