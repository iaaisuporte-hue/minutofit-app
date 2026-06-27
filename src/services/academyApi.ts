import { API_URL, parseJson } from './apiBase';
import { authFetch } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  userId: number;
  name: string;
  email: string;
  phone?: string;
  roleSlug: string;
  roleLabel: string;
  isActive: boolean;
  status: string;
  joinedAt: string | null;
}

export interface PendingInvitation {
  id: number;
  email: string;
  roleSlug: string;
  roleLabel: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface AcademyBranding {
  logoUrl?: string;
  bannerUrl?: string;
  displayName?: string;
  primaryColor?: string;
  primaryHover?: string;
  primarySoft?: string;
  secondaryColor?: string;
  accentColor?: string;
  ctaTextColor?: string;
  welcomeMessage?: string;
  theme?: string;
}

export interface AcademyDashboardRetention {
  totalStudents: number;
  studentsActive: number;
  studentsAtRisk: number;
  noWorkout14d: number;
  adherence7dPct: number | null;
}

export interface AcademyDashboardAtRiskStudent {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  lastCheckin: string | null;
  lastWorkout: string | null;
  daysInactive: number;
}

export interface AcademyCommercialSignals {
  upgradeCandidates: number;
  noWorkoutPlan: number;
  externalPersonal: number;
}

export interface AcademyTopPersonal {
  userId: number;
  name: string;
  studentsCount: number;
  adherenceRate: number | null;
}

export interface AcademyAdoption {
  labAdoptionPct: number | null;
  trackerAdoptionPct: number | null;
  netGrowth: number;
}

export interface AcademyFrequency {
  checkinsToday: number;
  checkinsMonth: number;
  /** Hora (0–23) com mais presenças físicas nos últimos 30d; null se sem dados. */
  peakHour: number | null;
}

export interface AcademyDashboard {
  academy: {
    display_name: string;
    slug: string;
    status: string;
    created_at: string;
  } | null;
  branding: {
    logo_url?: string;
    display_name?: string;
    primary_color?: string;
  } | null;
  membersByRole: Record<string, number>;
  totalMembers: number;
  professionalsActive: number;
  retention: AcademyDashboardRetention;
  atRiskStudents: AcademyDashboardAtRiskStudent[];
  averageMetabolismScore: number | null;
  topPersonals: AcademyTopPersonal[];
  adoption: AcademyAdoption;
  commercialSignals?: AcademyCommercialSignals;
  frequency?: AcademyFrequency;
  /** true → academia no Free; bloco de inteligência travado (upsell para Pro). */
  intelligenceLocked?: boolean;
}

// ─── Plano SaaS da academia (Spec 015) ─────────────────────────────────────────

export type AcademySaasPlan = "free" | "pro";

export interface AcademySubscription {
  plan: AcademySaasPlan;
  status: string;
  intelligenceEnabled: boolean;
  studentCap: number | null;
  currentPeriodEnd: string | null;
  trialUntil: string | null;
}

export async function fetchAcademyPlan(): Promise<AcademySubscription> {
  const data = await authFetch(`${API_URL}/academy/plan`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

/** Inicia o checkout do Pro (MP pre-approval) e retorna a initPoint para redirect. */
export async function startAcademyCheckout(): Promise<string> {
  const data = await authFetch(`${API_URL}/academy/plan/checkout`, { method: "POST" }).then(parseJson);
  if (!data.success) throw new Error(data.error || "Checkout indisponível no momento");
  return data.data.initPoint;
}

/**
 * Registra o touchpoint de cobrança (régua observável — feature Pro). O envio em si
 * é manual via wa.me no front; aqui só auditamos a ação. 403 PRO_REQUIRED se Free.
 */
export async function sendBillingReminder(userId: number): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}/billing-reminder`, {
    method: "POST",
  }).then(parseJson);
  if (!data.success) throw new Error(data.error || "Não foi possível registrar a cobrança");
}

// ─── Unidades / Filiais (Spec 017) ─────────────────────────────────────────────

export interface AcademyUnit {
  id: number;
  academyId: number;
  name: string;
  address: string | null;
  status: "active" | "inactive";
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchUnits(includeInactive = false): Promise<AcademyUnit[]> {
  const qs = includeInactive ? "?includeInactive=1" : "";
  const data = await authFetch(`${API_URL}/academy/units${qs}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function createUnit(params: { name: string; address?: string | null }): Promise<AcademyUnit> {
  const data = await authFetch(`${API_URL}/academy/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateUnit(id: number, params: { name?: string; address?: string | null }): Promise<AcademyUnit> {
  const data = await authFetch(`${API_URL}/academy/units/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function setUnitStatus(id: number, status: "active" | "inactive"): Promise<AcademyUnit> {
  const data = await authFetch(`${API_URL}/academy/units/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function setUnitPrimary(id: number): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/units/${id}/primary`, { method: "POST" }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

export interface AcademyAuditRow {
  id: number;
  user_id: number | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface AcademyPaymentRow {
  id: number;
  user_id: number;
  student_name: string | null;
  student_email: string;
  plan_name: string | null;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface AcademyFinanceKPIs {
  totalPaid: number;
  totalPending: number;
  totalFailed: number;
  countPaid: number;
  countPending: number;
  countFailed: number;
}

export interface InvitationInfo {
  id: number;
  email: string;
  academyName: string;
  academySlug: string;
  roleSlug: string;
  roleLabel: string;
  userExists: boolean;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export async function fetchTeam(): Promise<TeamMember[]> {
  const data = await authFetch(`${API_URL}/academy/team`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data.members;
}

export async function addMemberDirect(params: {
  roleSlug: string;
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
}): Promise<{ member: TeamMember; tempPassword?: string }> {
  const data = await authFetch(`${API_URL}/academy/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'direct', ...params }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function inviteMember(params: {
  roleSlug: string;
  email: string;
}): Promise<{ invitation: PendingInvitation; inviteUrl: string }> {
  const data = await authFetch(`${API_URL}/academy/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'invite', ...params }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateMember(
  userId: number,
  params: { roleSlug?: string; isActive?: boolean }
): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/team/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export async function fetchInvitations(): Promise<PendingInvitation[]> {
  const data = await authFetch(`${API_URL}/academy/invitations`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data.invitations;
}

export async function revokeInvitation(id: number): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/invitations/${id}`, {
    method: 'DELETE',
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

// ─── Branding ─────────────────────────────────────────────────────────────────

export async function fetchBranding(): Promise<AcademyBranding | null> {
  const data = await authFetch(`${API_URL}/academy/branding`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data.branding;
}

export async function saveBranding(params: AcademyBranding): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/branding`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function fetchAcademyDashboard(): Promise<AcademyDashboard> {
  const data = await authFetch(`${API_URL}/academy/dashboard`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// ─── Public: invitation token ─────────────────────────────────────────────────

export async function fetchInvitationInfo(token: string): Promise<InvitationInfo> {
  const res = await fetch(`${API_URL}/auth/invitations/${token}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function acceptInvitation(params: {
  token: string;
  password?: string;
  name?: string;
  cpf?: string;
  phone?: string;
}): Promise<{ user: any; accessToken: string; refreshToken: string }> {
  const res = await fetch(`${API_URL}/auth/accept-invitation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// ─── Students ─────────────────────────────────────────────────────────────────

export type StudentStatus = 'lead' | 'active' | 'overdue' | 'paused' | 'cancelled';

export interface Student {
  userId: number;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  birthDate?: string | null;
  avatarUrl?: string | null;
  studentStatus: StudentStatus | null;
  unitId?: number | null;
  isActive: boolean;
  joinedAt: string | null;
  paymentMethod?: string | null;
  mainGoal?: string | null;
  medicalRestrictions?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  acceptedTermsAt?: string | null;
  acceptedLgpdAt?: string | null;
  activePlan: { id: number; name: string; monthlyPrice: number; startDate: string } | null;
  hasUsedLab?: boolean;
  hasUsedTracker?: boolean;
  hasApp?: boolean;
  hasPersonal?: boolean;
  hasNutri?: boolean;
}

export interface Enrollment {
  id: number;
  academyId: number;
  userId: number;
  planId: number | null;
  planName?: string;
  monthlyPrice?: number;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'paused' | 'cancelled';
  notes: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  userId: number | null;
  entityType: string | null;
  entityId: number | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface StudentsStats {
  active: number;
  leads: number;
  overdue: number;
  paused: number;
  cancelled: number;
  total: number;
}

export interface StudentsListResult {
  students: Student[];
  total: number;
  stats: StudentsStats;
}

export interface StudentActivity {
  /** true → bloco sensível blindado por falta de vínculo profissional. */
  restricted?: boolean;
  lastPhysicalPresence?: string | null;  // operacional — sempre visível
  lastWorkout: string | null;
  lastCheckin: string | null;
  workouts30d: number | null;
  checkins30d: number | null;
  adherence30dPct: number | null;
  adherence7dPct?: number | null;
}

export interface StudentMemberships {
  hasApp: boolean;
  hasPersonal: boolean;
  hasNutri: boolean;
}

export interface StudentDetail extends Student {
  enrollments: Enrollment[];
  auditHistory: AuditEntry[];
  activity?: StudentActivity;
  memberships?: StudentMemberships;
}

export async function fetchStudents(params?: {
  status?: string;
  q?: string;
  unitId?: number;
  page?: number;
  pageSize?: number;
  /** Sem check-in nos últimos 14 dias (alinhado ao dashboard) */
  atRisk?: boolean;
}): Promise<StudentsListResult> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  if (params?.unitId) qs.set('unitId', String(params.unitId));
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params?.atRisk) qs.set('atRisk', '1');
  const data = await authFetch(`${API_URL}/academy/students?${qs}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function fetchStudent(userId: number): Promise<StudentDetail> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function addStudentDirect(params: {
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  birthDate?: string;
  avatarUrl?: string;
  unitId?: number;
  planId?: number;
  startDate?: string;
  paymentMethod?: string;
  mainGoal?: string;
  medicalRestrictions?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  acceptedTerms?: boolean;
  acceptedLgpd?: boolean;
  /** Conceder App como bônus ao aluno (default `true` no backend). */
  giveAppBonus?: boolean;
}): Promise<{ student: Partial<Student>; tempPassword?: string }> {
  const data = await authFetch(`${API_URL}/academy/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'direct', ...params }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function inviteStudent(params: {
  email: string;
}): Promise<{ student: Partial<Student>; inviteUrl?: string }> {
  const data = await authFetch(`${API_URL}/academy/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'invite', ...params }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function patchStudent(userId: number, params: {
  studentStatus?: StudentStatus;
  unitId?: number | null;
}): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

export async function enrollStudentInPlan(userId: number, params: {
  planId: number;
  startDate?: string;
  notes?: string;
}): Promise<Enrollment> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function pauseStudentApi(userId: number): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}/pause`, { method: 'POST' }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

export async function cancelStudentApi(userId: number): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}/cancel`, { method: 'POST' }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

export async function reactivateStudentApi(userId: number): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}/reactivate`, { method: 'POST' }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

export async function resetStudentPasswordApi(userId: number): Promise<string> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}/reset-password`, { method: 'POST' }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.tempPassword as string;
}

// ─── Recepção ─────────────────────────────────────────────────────────────────

export interface ReceptionStudent {
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  avatarUrl: string | null;
  studentStatus: StudentStatus | null;
  activePlan: { id: number; name: string; monthlyPrice: number } | null;
  lastAccessAt: string | null;
  daysOverdue?: number | null;
  lastStaffNote?: { from: string; sentAt: string } | null;
}

export interface ReceptionAccessEvent {
  id: number;
  eventType: 'checkin' | 'exception' | 'denied' | 'visitor';
  source: 'manual' | 'qr' | 'facial' | 'catraca_vendor_webhook';
  reason: string | null;
  createdAt: string;
  student: {
    userId: number | null;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    studentStatus: StudentStatus | null;
  };
  visitor: {
    id: number | null;
    name: string | null;
    type: string | null;
  };
  actorName: string | null;
}

export interface ReceptionDashboardStudent {
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  studentStatus: StudentStatus | null;
  joinedAt: string | null;
  activePlan: { id: number; name: string; monthlyPrice: number } | null;
  lastAccessAt: string | null;
}

export interface ReceptionDashboard {
  kpis: {
    occupancyNow: number;
    accessToday: number;
    exceptionsToday: number;
    deniedToday: number;
    overdueStudents: number;
    newStudents7d: number;
    activeStudents: number;
    birthdaysToday: number;
  };
  status: {
    catraca: 'manual_only' | string;
    facial: 'planned' | string;
    partners: 'planned' | string;
  };
  recentEvents: ReceptionAccessEvent[];
  exceptions: ReceptionAccessEvent[];
  related?: {
    occupancyNow: ReceptionAccessEvent[];
    accessToday: ReceptionAccessEvent[];
    exceptionsToday: ReceptionAccessEvent[];
    deniedToday: ReceptionAccessEvent[];
    overdueStudents: ReceptionDashboardStudent[];
    newStudents7d: ReceptionDashboardStudent[];
    birthdaysToday: ReceptionDashboardStudent[];
  };
}

export async function fetchReceptionDashboard(): Promise<ReceptionDashboard> {
  const data = await authFetch(`${API_URL}/academy/recepcao/dashboard`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as ReceptionDashboard;
}

export type ReceptionPanelApiKey =
  | "occupancyNow"
  | "accessToday"
  | "overdueStudents"
  | "birthdaysToday"
  | "exceptionsToday"
  | "deniedToday"
  | "newStudents7d";

export async function fetchReceptionPanel(
  key: ReceptionPanelApiKey,
  page: number,
  pageSize: number,
  q?: string
): Promise<{ total: number; events: ReceptionAccessEvent[]; students: ReceptionDashboardStudent[] }> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q?.trim()) qs.set("q", q.trim());
  const data = await authFetch(`${API_URL}/academy/recepcao/panel/${key}?${qs}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as { total: number; events: ReceptionAccessEvent[]; students: ReceptionDashboardStudent[] };
}

export interface ReceptionStudentContext {
  adherence7dPct: number;
  streakDays: number;
  lastWorkoutAt: string | null;
  productMaaSActive: boolean;
  unreadStaffMessageCount: number;
  welcomeContext: string | null;
  staffMessages: Array<{
    id: number;
    text: string;
    fromName: string;
    senderRole: string;
    createdAt: string;
  }>;
}

export async function fetchReceptionStudentContext(userId: number): Promise<ReceptionStudentContext> {
  const data = await authFetch(`${API_URL}/academy/students/${userId}/reception-context`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as ReceptionStudentContext;
}

export async function postReceptionStudentNotesAudit(studentUserId: number): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/recepcao/student-notes-audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentUserId }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

export interface AcademyAuditLogRow {
  id: number;
  academy_id: number | null;
  user_id: number | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchAcademyAuditLog(params: {
  limit?: number;
  offset?: number;
  actorUserId?: number;
  actionPrefix?: string;
}): Promise<AcademyAuditLogRow[]> {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.actorUserId != null) qs.set("actor_user_id", String(params.actorUserId));
  if (params.actionPrefix) qs.set("action_prefix", params.actionPrefix);
  const data = await authFetch(`${API_URL}/academy/audit-log?${qs}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as AcademyAuditLogRow[];
}

export async function searchReceptionStudents(q: string, limit = 8): Promise<ReceptionStudent[]> {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  const data = await authFetch(`${API_URL}/academy/students/search?${qs}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data.students as ReceptionStudent[];
}

export type ReceptionCheckinResult = {
  duplicate?: boolean;
  event: { id: number; eventType: string; source: string; reason: string | null; createdAt: string };
  student: ReceptionStudent;
};

export async function registerReceptionCheckin(userId: number): Promise<ReceptionCheckinResult> {
  const data = await authFetch(`${API_URL}/academy/checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as ReceptionCheckinResult;
}

export async function registerReceptionException(
  userId: number,
  reason: string
): Promise<ReceptionCheckinResult> {
  const data = await authFetch(`${API_URL}/academy/checkins/exception`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, reason }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as ReceptionCheckinResult;
}

export async function registerReceptionDenied(userId: number, reason: string): Promise<ReceptionCheckinResult> {
  const data = await authFetch(`${API_URL}/academy/checkins/deny`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, reason }),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as ReceptionCheckinResult;
}

export async function registerReceptionVisitor(params: {
  name: string;
  document?: string;
  visitorType?: 'visitor' | 'external_personal' | 'prospect' | 'trial_class';
  phone?: string;
  referredBy?: string;
  validUntil?: string;
  reason?: string;
}): Promise<{ duplicate?: boolean; visitor: unknown; event: unknown }> {
  const data = await authFetch(`${API_URL}/academy/visitors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as { duplicate?: boolean; visitor: unknown; event: unknown };
}

// ─── Plans ─────────────────────────────────────────────────────────────────────

export interface AcademyPlan {
  id: number;
  academyId: number;
  name: string;
  description: string | null;
  monthlyPrice: number;
  billingCycleDays: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export async function fetchPlans(includeArchived = false): Promise<AcademyPlan[]> {
  const data = await authFetch(
    `${API_URL}/academy/plans${includeArchived ? '?includeArchived=true' : ''}`
  ).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data.plans;
}

export async function createPlan(params: {
  name: string;
  description?: string;
  monthlyPrice: number;
  billingCycleDays?: number;
}): Promise<AcademyPlan> {
  const data = await authFetch(`${API_URL}/academy/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data.plan;
}

export async function updatePlan(planId: number, params: {
  name?: string;
  description?: string;
  monthlyPrice?: number;
  billingCycleDays?: number;
}): Promise<AcademyPlan> {
  const data = await authFetch(`${API_URL}/academy/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data.plan;
}

export async function archivePlan(planId: number): Promise<void> {
  const data = await authFetch(`${API_URL}/academy/plans/${planId}`, {
    method: 'DELETE',
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
}

// ─── Admin: search users + assign owner ──────────────────────────────────────

export async function searchUsers(q: string): Promise<{ id: number; name: string; email: string; role: string }[]> {
  const data = await authFetch(`${API_URL}/admin/users/search?q=${encodeURIComponent(q)}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data.users;
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export async function fetchAcademyAudit(limit = 50, offset = 0): Promise<AcademyAuditRow[]> {
  const data = await authFetch(`${API_URL}/academy/audit-log?limit=${limit}&offset=${offset}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as AcademyAuditRow[];
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export async function fetchAcademyPayments(params?: {
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AcademyPaymentRow[]; total: number; kpis: AcademyFinanceKPIs }> {
  const qs = new URLSearchParams();
  if (params?.from)   qs.set('from',   params.from);
  if (params?.to)     qs.set('to',     params.to);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit)  qs.set('limit',  String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const data = await authFetch(`${API_URL}/academy/payments${query}`).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data as { rows: AcademyPaymentRow[]; total: number; kpis: AcademyFinanceKPIs };
}

export async function assignAcademyOwner(
  academyId: number,
  params: {
    mode: 'existing' | 'new';
    userId?: number;
    email?: string;
    name?: string;
    cpf?: string;
    phone?: string;
  }
): Promise<{ id: number; name: string; email: string; tempPassword?: string }> {
  const data = await authFetch(`${API_URL}/admin/academies/${academyId}/assign-owner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(parseJson);
  if (!data.success) throw new Error(data.error);
  return data.data;
}
