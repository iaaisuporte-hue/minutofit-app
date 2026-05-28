import { API_URL, parseJson } from './apiBase';
import { authFetch } from './apiClient';

export type PublicationStatus = 'draft' | 'pending_review' | 'approved' | 'disabled';
export type CredentialStatus = 'pending_review' | 'approved' | 'rejected';
export type Modality = 'in_person' | 'online' | 'hybrid';
export type AvailabilityStatus = 'available' | 'limited' | 'unavailable';

export interface NetworkProfile {
  professionalId: number;
  professionalRole: 'personal' | 'nutri';
  credentialCode: string;
  credentialStatus: CredentialStatus;
  publicationStatus: PublicationStatus;
  adminEnabled: boolean;
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  specialties: string[];
  metabolicFocus: string | null;
  modality: Modality | null;
  city: string | null;
  stateUf: string | null;
  availabilityStatus: AvailabilityStatus;
  updatedAt: string;
}

export async function getMyNetworkProfile(): Promise<NetworkProfile | null> {
  const res = await authFetch(`${API_URL}/professional/network-profile`);
  const json = await parseJson(res);
  return json.data ?? null;
}

export async function saveMyNetworkProfile(data: {
  credentialCode: string;
  displayName: string;
  bio?: string | null;
  specialties?: string[];
  metabolicFocus?: string | null;
  modality?: Modality | null;
  city?: string | null;
  stateUf?: string | null;
  availabilityStatus?: AvailabilityStatus;
}): Promise<NetworkProfile> {
  const res = await authFetch(`${API_URL}/professional/network-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await parseJson(res);
  if (!json.success) throw Object.assign(new Error(json.error ?? 'save_failed'), { details: json.details });
  return json.data;
}

export async function publishMyNetworkProfile(): Promise<NetworkProfile> {
  const res = await authFetch(`${API_URL}/professional/network-profile/publish`, {
    method: 'POST',
  });
  const json = await parseJson(res);
  if (!json.success) throw Object.assign(new Error(json.error ?? 'publish_failed'), { details: json.details });
  return json.data;
}

export async function unpublishMyNetworkProfile(): Promise<NetworkProfile> {
  const res = await authFetch(`${API_URL}/professional/network-profile/unpublish`, {
    method: 'POST',
  });
  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error ?? 'unpublish_failed');
  return json.data;
}

// ─── Ofertas comerciais (US4) ──────────────────────────────────────────────

export type OfferingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type OfferingStatus = 'active' | 'archived';

export interface ProfessionalOffering {
  id: string;
  professionalId: number;
  professionalRole: 'personal' | 'nutri';
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  period: OfferingPeriod;
  status: OfferingStatus;
  createdAt: string;
  updatedAt: string;
}

export async function listMyOfferings(): Promise<ProfessionalOffering[]> {
  const res = await authFetch(`${API_URL}/professional/offerings`);
  const json = await parseJson(res);
  return Array.isArray(json.data) ? json.data : [];
}

export async function createOffering(input: {
  title: string;
  description?: string | null;
  priceCents: number;
  period: OfferingPeriod;
}): Promise<ProfessionalOffering> {
  const res = await authFetch(`${API_URL}/professional/offerings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await parseJson(res);
  if (!json.success) throw Object.assign(new Error(json.error ?? 'create_failed'), { details: json.details });
  return json.data;
}

export async function updateOffering(
  id: string,
  input: { title?: string; description?: string | null; priceCents?: number; period?: OfferingPeriod }
): Promise<ProfessionalOffering> {
  const res = await authFetch(`${API_URL}/professional/offerings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await parseJson(res);
  if (!json.success) throw Object.assign(new Error(json.error ?? 'update_failed'), { details: json.details });
  return json.data;
}

export async function archiveOffering(id: string): Promise<ProfessionalOffering> {
  const res = await authFetch(`${API_URL}/professional/offerings/${id}/archive`, {
    method: 'POST',
  });
  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error ?? 'archive_failed');
  return json.data;
}

// ─── Assinaturas — visão do profissional (US4) ─────────────────────────────

export type SubscriptionStatus = 'pending_payment' | 'active' | 'paused' | 'cancelled' | 'expired';

export interface ProfessionalSubscription {
  id: string;
  studentId: number;
  professionalId: number;
  professionalRole: 'personal' | 'nutri';
  offeringId: string;
  priceCentsSnapshot: number;
  periodSnapshot: OfferingPeriod;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextChargeAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listMySubscriptionsAsPro(): Promise<ProfessionalSubscription[]> {
  const res = await authFetch(`${API_URL}/professional/subscriptions`);
  const json = await parseJson(res);
  return Array.isArray(json.data) ? json.data : [];
}

export async function cancelSubscriptionAsPro(id: string): Promise<ProfessionalSubscription> {
  const res = await authFetch(`${API_URL}/professional/subscriptions/${id}/cancel`, {
    method: 'POST',
  });
  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error ?? 'cancel_failed');
  return json.data;
}
