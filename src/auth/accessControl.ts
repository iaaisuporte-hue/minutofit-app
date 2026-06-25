import type { Role } from "./AuthContext";

export type AccessProfile =
  | "admin_owner"
  | "admin_operations"
  | "admin_finance"
  | "admin_support"
  | "clientes_sb"
  | "user_default"
  | "personal_default"
  | "nutri_default"
  // Academy-scoped system roles (slug from academy_roles, used when user is linked to an academy)
  // corefit_admin = platform admin linked via seedDefaultAcademy to the default academy
  | "corefit_admin"
  | "academy_owner"
  | "academy_manager"
  | "academy_finance"
  | "academy_reception"
  | "academy_personal"
  | "academy_nutri"
  | "academy_student";

export type AppPermission =
  | "admin.accessProfiles"
  | "admin.dashboard"
  | "admin.users"
  | "admin.users.detail"
  | "admin.personals"
  | "admin.personals.detail"
  | "admin.nutris"
  | "admin.finance"
  | "admin.professionals.create"
  | "admin.professionals.review"
  | "admin.audit"
  // Academia-scoped permissions
  | "academy.dashboard"
  | "academy.students.read"
  | "academy.students.write"
  | "academy.students.metabolic"
  | "academy.professionals.read"
  | "academy.professionals.write"
  | "academy.plans.read"
  | "academy.plans.write"
  | "academy.finance.read"
  | "academy.finance.write"
  | "academy.finance.dre"
  | "academy.reports.read"
  | "academy.branding"
  | "academy.audit.read"
  | "academy.invitations.write"
  | "academy.recepcao.dashboard"
  | "academy.checkin.write"
  | "academy.billing.operate";

const ALL_ADMIN_PERMISSIONS: AppPermission[] = [
  "admin.accessProfiles",
  "admin.dashboard",
  "admin.users",
  "admin.users.detail",
  "admin.personals",
  "admin.personals.detail",
  "admin.nutris",
  "admin.finance",
  "admin.professionals.create",
  "admin.professionals.review",
  "admin.audit",
];

const ALL_ACADEMY_OWNER_PERMISSIONS: AppPermission[] = [
  "academy.dashboard",
  "academy.students.read",
  "academy.students.write",
  "academy.students.metabolic",
  "academy.professionals.read",
  "academy.professionals.write",
  "academy.plans.read",
  "academy.plans.write",
  "academy.finance.read",
  "academy.finance.write",
  "academy.finance.dre",
  "academy.reports.read",
  "academy.branding",
  "academy.audit.read",
  "academy.invitations.write",
  "academy.recepcao.dashboard",
  "academy.checkin.write",
  "academy.billing.operate",
];

const PROFILE_PERMISSIONS: Record<AccessProfile, AppPermission[]> = {
  // corefit_admin is the academy_roles slug that platform admins receive via seedDefaultAcademy.
  // It carries the same full admin + academy permissions.
  corefit_admin: [...ALL_ADMIN_PERMISSIONS, ...ALL_ACADEMY_OWNER_PERMISSIONS],
  admin_owner: ALL_ADMIN_PERMISSIONS,
  admin_operations: [
    "admin.dashboard",
    "admin.users",
    "admin.users.detail",
    "admin.personals",
    "admin.personals.detail",
    "admin.nutris",
    "admin.professionals.create",
  ],
  admin_finance: [
    "admin.dashboard",
    "admin.finance",
  ],
  admin_support: [
    "admin.dashboard",
    "admin.users",
    "admin.users.detail",
  ],
  clientes_sb: [],
  user_default: [],
  personal_default: [],
  nutri_default: [],
  // Academia profiles — permissions come from server (academy_roles.permissions)
  // Defaults here are used only as fallback when server does not return permissions
  academy_owner: ALL_ACADEMY_OWNER_PERMISSIONS,
  academy_manager: [
    "academy.dashboard",
    "academy.students.read",
    "academy.students.write",
    "academy.professionals.read",
    "academy.plans.read",
    "academy.finance.read",
    "academy.reports.read",
    "academy.invitations.write",
    "academy.recepcao.dashboard",
    "academy.checkin.write",
    "academy.billing.operate",
  ],
  academy_finance: [
    "academy.dashboard",
    "academy.students.read",
    "academy.finance.read",
    "academy.finance.write",
    "academy.finance.dre",
    "academy.reports.read",
  ],
  academy_reception: [
    "academy.students.read",
    "academy.students.write",
    "academy.plans.read",
    "academy.invitations.write",
    "academy.recepcao.dashboard",
    "academy.checkin.write",
    "academy.billing.operate",
    "academy.audit.read",
  ],
  academy_personal: [
    "academy.students.read",
    "academy.students.metabolic",
  ],
  academy_nutri: [
    "academy.students.read",
    "academy.students.metabolic",
  ],
  academy_student: [],
};

export const ACCESS_PROFILE_META: Record<
  AccessProfile,
  { label: string; roleScope: Role | "mixed"; description: string }
> = {
  corefit_admin: {
    label: "Admin S2Core",
    roleScope: "admin",
    description: "Admin da plataforma com acesso total a gestão e academias.",
  },
  admin_owner: {
    label: "Admin Owner",
    roleScope: "admin",
    description: "Controle total da operação, perfis de acesso, financeiro e gestão completa da plataforma.",
  },
  admin_operations: {
    label: "Admin Operações",
    roleScope: "admin",
    description: "Foco em ativação, usuários, profissionais e operação diária sem abrir o financeiro.",
  },
  admin_finance: {
    label: "Admin Financeiro",
    roleScope: "admin",
    description: "Perfil voltado a receita, cobranças, inadimplência e leitura financeira do negócio.",
  },
  admin_support: {
    label: "Admin Suporte",
    roleScope: "admin",
    description: "Ajuda o time a tratar usuários, onboarding e atendimento, com escopo mais restrito.",
  },
  clientes_sb: {
    label: "Clientes SB",
    roleScope: "user",
    description: "Perfil com acesso restrito apenas a Hoje e Treinos em casa.",
  },
  user_default: {
    label: "Aluno padrão",
    roleScope: "user",
    description: "Perfil padrão do aluno no app final.",
  },
  personal_default: {
    label: "Personal padrão",
    roleScope: "personal",
    description: "Perfil padrão do personal trainer dentro da plataforma.",
  },
  nutri_default: {
    label: "Nutri padrão",
    roleScope: "nutri",
    description: "Perfil padrão da área de nutrição.",
  },
  academy_owner: {
    label: "Dono da Academia",
    roleScope: "mixed",
    description: "Acesso total à academia: alunos, financeiro, branding e relatórios.",
  },
  academy_manager: {
    label: "Gestor de Unidade",
    roleScope: "mixed",
    description: "Gestão operacional de uma unidade da academia.",
  },
  academy_finance: {
    label: "Financeiro da Academia",
    roleScope: "mixed",
    description: "Acesso ao financeiro e relatórios da academia.",
  },
  academy_reception: {
    label: "Recepção",
    roleScope: "mixed",
    description: "Operação de balcão, check-in, matrículas rápidas e consulta de alunos.",
  },
  academy_personal: {
    label: "Personal / Professor",
    roleScope: "personal",
    description: "Acesso a alunos vinculados na academia.",
  },
  academy_nutri: {
    label: "Nutricionista da Academia",
    roleScope: "nutri",
    description: "Acesso a alunos vinculados na academia.",
  },
  academy_student: {
    label: "Aluno da Academia",
    roleScope: "user",
    description: "Perfil de aluno em academia parceira.",
  },
};

export const APP_PERMISSION_META: Record<AppPermission, { label: string; group: string; description: string }> = {
  "admin.accessProfiles": {
    label: "Gerência de perfis",
    group: "Admin",
    description: "Visualizar e configurar perfis de acesso e permissões do admin.",
  },
  "admin.dashboard": {
    label: "Visão geral",
    group: "Admin",
    description: "Acessar o cockpit principal do negócio.",
  },
  "admin.users": {
    label: "Lista de alunos",
    group: "Admin",
    description: "Ver a base de alunos e sua situação operacional.",
  },
  "admin.users.detail": {
    label: "Detalhe de aluno",
    group: "Admin",
    description: "Abrir a página detalhada de cada aluno.",
  },
  "admin.personals": {
    label: "Lista de personals",
    group: "Profissionais",
    description: "Ver e gerenciar a base de personais.",
  },
  "admin.personals.detail": {
    label: "Detalhe de personal",
    group: "Profissionais",
    description: "Abrir o detalhe de um personal.",
  },
  "admin.nutris": {
    label: "Lista de nutris",
    group: "Profissionais",
    description: "Ver e gerenciar a base de nutricionistas.",
  },
  "admin.finance": {
    label: "Financeiro",
    group: "Financeiro",
    description: "Acessar receita, MRR, pagamentos e inadimplência.",
  },
  "admin.professionals.create": {
    label: "Cadastro de profissionais",
    group: "Profissionais",
    description: "Criar novos personals e nutris no admin.",
  },
  "admin.professionals.review": {
    label: "Revisão de credenciais",
    group: "Profissionais",
    description: "Aprovar ou rejeitar CREF/CRN de profissionais.",
  },
  "admin.audit": {
    label: "Auditoria da plataforma",
    group: "Admin",
    description: "Ver trilha de ações sensíveis e acessos a dados.",
  },
  "academy.dashboard": { label: "Dashboard da academia", group: "Academia", description: "Visão geral da academia." },
  "academy.students.read": { label: "Ver alunos", group: "Academia", description: "Listar e consultar alunos." },
  "academy.students.write": { label: "Editar alunos", group: "Academia", description: "Criar e editar alunos." },
  "academy.students.metabolic": { label: "Dados metabólicos", group: "Academia", description: "Ver metabolismo dos alunos vinculados." },
  "academy.professionals.read": { label: "Ver profissionais", group: "Academia", description: "Listar profissionais da academia." },
  "academy.professionals.write": { label: "Editar profissionais", group: "Academia", description: "Gerenciar profissionais." },
  "academy.plans.read": { label: "Ver planos", group: "Academia", description: "Consultar planos e matrículas." },
  "academy.plans.write": { label: "Editar planos", group: "Academia", description: "Criar e editar planos." },
  "academy.finance.read": { label: "Ver financeiro", group: "Financeiro Academia", description: "Consultar cobranças e pagamentos." },
  "academy.finance.write": { label: "Editar financeiro", group: "Financeiro Academia", description: "Registrar e editar cobranças." },
  "academy.finance.dre": { label: "DRE / Fluxo de caixa", group: "Financeiro Academia", description: "Acessar demonstrativo de resultados." },
  "academy.reports.read": { label: "Relatórios", group: "Academia", description: "Acessar relatórios de retenção e metabólicos." },
  "academy.branding": { label: "Branding da academia", group: "Academia", description: "Configurar logo, cores e identidade visual." },
  "academy.audit.read": { label: "Auditoria", group: "Academia", description: "Ver trilha de auditoria da academia." },
  "academy.invitations.write": { label: "Enviar convites", group: "Academia", description: "Convidar novos usuários para a academia." },
  "academy.recepcao.dashboard": { label: "Recepção", group: "Academia", description: "Acessar o hub operacional da recepção." },
  "academy.checkin.write": { label: "Check-in operacional", group: "Academia", description: "Registrar entrada, exceções e visitantes." },
  "academy.billing.operate": { label: "Cobrança operacional", group: "Financeiro Academia", description: "Operar cobranças simples sem acesso a DRE." },
};

export const ACCESS_PROFILE_ORDER: AccessProfile[] = [
  "corefit_admin",
  "admin_owner",
  "admin_operations",
  "admin_finance",
  "admin_support",
  "clientes_sb",
  "user_default",
  "personal_default",
  "nutri_default",
  "academy_owner",
  "academy_manager",
  "academy_finance",
  "academy_reception",
  "academy_personal",
  "academy_nutri",
  "academy_student",
];

export const APP_PERMISSION_ORDER: AppPermission[] = [
  "admin.accessProfiles",
  "admin.dashboard",
  "admin.users",
  "admin.users.detail",
  "admin.personals",
  "admin.personals.detail",
  "admin.nutris",
  "admin.finance",
  "admin.professionals.create",
  "admin.professionals.review",
  "admin.audit",
  "academy.dashboard",
  "academy.students.read",
  "academy.students.write",
  "academy.students.metabolic",
  "academy.professionals.read",
  "academy.professionals.write",
  "academy.plans.read",
  "academy.plans.write",
  "academy.finance.read",
  "academy.finance.write",
  "academy.finance.dre",
  "academy.reports.read",
  "academy.branding",
  "academy.audit.read",
  "academy.invitations.write",
  "academy.recepcao.dashboard",
  "academy.checkin.write",
  "academy.billing.operate",
];

export function getProfilePermissions(profile: AccessProfile) {
  return PROFILE_PERMISSIONS[profile] ?? [];
}

export function defaultAccessProfileByRole(role?: Role | null): AccessProfile | null {
  if (role === "admin") return "corefit_admin";
  if (role === "personal") return "personal_default";
  if (role === "nutri") return "nutri_default";
  if (role === "user") return "user_default";
  return null;
}

export function resolvePermissions(
  role?: Role | null,
  accessProfile?: string | null,
  explicitPermissions?: AppPermission[] | null
) {
  const profile = (accessProfile as AccessProfile | null) || defaultAccessProfileByRole(role);
  const profilePermissions = profile ? PROFILE_PERMISSIONS[profile] ?? [] : [];
  const permissions = explicitPermissions?.length ? explicitPermissions : profilePermissions;
  return {
    profile,
    permissions,
  };
}

export function hasPermission(
  permissions: AppPermission[],
  required: AppPermission
) {
  return permissions.includes(required);
}
