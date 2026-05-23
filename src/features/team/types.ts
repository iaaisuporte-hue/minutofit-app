export type ConsentScope =
  | 'profile'
  | 'workouts'
  | 'daily_checkins'
  | 'metabolic'
  | 'sleep'
  | 'body_metrics'
  | 'body_photos'
  | 'nutrition'
  | 'parq_anamnese'
  | 'activity_logs'
  | 'chat_history';

export type ProfessionalRole = 'personal' | 'nutri';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type RequestedVia = 'email' | 'code' | 'link';

export const SCOPE_LABELS: Record<ConsentScope, string> = {
  profile: 'Perfil básico',
  workouts: 'Treinos',
  daily_checkins: 'Check-ins diários',
  metabolic: 'Estado metabólico',
  sleep: 'Sono',
  body_metrics: 'Medidas corporais',
  body_photos: 'Fotos de evolução',
  nutrition: 'Plano alimentar',
  parq_anamnese: 'Anamnese e PAR-Q',
  activity_logs: 'Atividades físicas',
  chat_history: 'Histórico de mensagens',
};

export const DEFAULT_SCOPES_PERSONAL: ConsentScope[] = ['profile', 'workouts', 'daily_checkins'];
export const DEFAULT_SCOPES_NUTRI: ConsentScope[] = ['profile', 'daily_checkins', 'nutrition'];

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
