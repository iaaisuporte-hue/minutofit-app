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
  lastCheckin: string | null;
  lastWorkout: string | null;
  daysInactive: number;
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
  lastWorkout: string | null;
  lastCheckin: string | null;
  workouts30d: number;
  checkins30d: number;
  adherence30dPct: number | null;
}

export interface StudentDetail extends Student {
  enrollments: Enrollment[];
  auditHistory: AuditEntry[];
  activity?: StudentActivity;
}

export async function fetchStudents(params?: {
  status?: string;
  q?: string;
  unitId?: number;
  page?: number;
  pageSize?: number;
}): Promise<StudentsListResult> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  if (params?.unitId) qs.set('unitId', String(params.unitId));
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
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
