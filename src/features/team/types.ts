export type ConsentScope =
  | 'profile'
  | 'workouts'
  | 'daily_checkins'
  | 'metabolic'
  | 'sleep'
  | 'body_metrics'
  | 'body_photos'
  | 'nutrition'
  | 'clinical_nutrition'
  | 'parq_anamnese'
  | 'activity_logs'
  | 'chat_history'
  | 'sports';

export type ProfessionalRole = 'personal' | 'nutri';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type RequestedVia = 'email' | 'code' | 'link' | 'discovery';

export const SCOPE_LABELS: Record<ConsentScope, string> = {
  profile: 'Perfil básico',
  workouts: 'Treinos',
  daily_checkins: 'Check-ins diários',
  metabolic: 'Estado metabólico',
  sleep: 'Sono',
  body_metrics: 'Medidas corporais',
  body_photos: 'Fotos de evolução',
  nutrition: 'Plano alimentar',
  clinical_nutrition: 'Perfil clínico-nutricional',
  parq_anamnese: 'Anamnese e PAR-Q',
  activity_logs: 'Atividades físicas',
  chat_history: 'Histórico de mensagens',
  sports: 'Dados esportivos',
};

export const DEFAULT_SCOPES_PERSONAL: ConsentScope[] = ['profile', 'workouts', 'daily_checkins'];
export const DEFAULT_SCOPES_NUTRI: ConsentScope[] = ['profile', 'daily_checkins', 'nutrition'];

// Escopos concedidos automaticamente ao ACEITAR um convite direto (link) de um
// profissional. Espelho de `DIRECT_INVITE_SCOPES_*` em
// `backend/src/services/consentService.ts` — mantê-los em sincronia. Exibidos na
// tela de aceite (consentimento informado, LGPD art. 8º §4); o aluno pode
// revogar qualquer um depois em Perfil → Minha Equipe.
export const DIRECT_INVITE_SCOPES_PERSONAL: ConsentScope[] = [
  'profile', 'workouts', 'daily_checkins', 'metabolic', 'sleep',
  'body_metrics', 'parq_anamnese', 'activity_logs', 'chat_history',
];
export const DIRECT_INVITE_SCOPES_NUTRI: ConsentScope[] = [
  'profile', 'nutrition', 'clinical_nutrition', 'daily_checkins', 'metabolic',
  'body_metrics', 'parq_anamnese', 'chat_history',
];

// Todos os escopos que o aluno PODE conceder a cada papel. Usado pelo gerenciador
// de consentimento para também listar escopos sensíveis que nunca são concedidos
// por padrão (ex.: `body_photos`), permitindo ao aluno ligá-los conscientemente.
// Ordem = ordem de exibição.
export const MANAGEABLE_SCOPES_PERSONAL: ConsentScope[] = [
  'profile', 'workouts', 'daily_checkins', 'metabolic', 'sleep',
  'body_metrics', 'body_photos', 'activity_logs', 'parq_anamnese', 'sports', 'chat_history',
];
export const MANAGEABLE_SCOPES_NUTRI: ConsentScope[] = [
  'profile', 'nutrition', 'clinical_nutrition', 'daily_checkins', 'metabolic',
  'sleep', 'body_metrics', 'body_photos', 'parq_anamnese', 'chat_history',
];

export interface ConsentEntry {
  id: string;
  scope: ConsentScope;
  status: 'granted' | 'revoked' | 'expired';
  grantedAt: string;
  revokedAt: string | null;
}

export interface ProfessionalRequest {
  id: string;
  studentId: number;
  professionalId: number;
  professionalRole: ProfessionalRole;
  requestedVia: RequestedVia;
  message: string | null;
  status: RequestStatus;
  requestedScopes: ConsentScope[];
  expiresAt: string;
  respondedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  professionalName?: string;
  studentName?: string;
  studentEmail?: string;
}

export interface ResolvedProfessional {
  id: number;
  name: string;
}


export interface NetworkProfessional {
  professionalId: number;
  professionalRole: ProfessionalRole;
  displayName: string;
  photoUrl: string | null;
  specialties: string[];
  metabolicFocus: string | null;
  modality: 'in_person' | 'online' | 'hybrid' | null;
  city: string | null;
  stateUf: string | null;
  availabilityStatus: 'available' | 'limited' | 'unavailable';
  credentialCode: string;
  credentialStatus: 'pending_review' | 'approved' | 'rejected';
}

export interface ProfessionalNetworkResponse {
  policy: 'allow' | 'block';
  professionals: NetworkProfessional[];
}

// ── US4: planos comerciais e assinaturas ────────────────────────────────

export type OfferingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type SubscriptionStatus = 'pending_payment' | 'active' | 'paused' | 'cancelled' | 'expired';

export interface PublicOffering {
  id: string;
  professionalId: number;
  professionalRole: ProfessionalRole;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  period: OfferingPeriod;
  status: 'active' | 'archived';
}

export interface StudentSubscription {
  id: string;
  studentId: number;
  professionalId: number;
  professionalRole: ProfessionalRole;
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

export interface CheckoutResponse {
  subscription: StudentSubscription;
  redirectUrl: string;
  expiresAt: string;
}
