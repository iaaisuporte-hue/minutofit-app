import type { Role } from "./AuthContext";

export type AccessProfile =
  | "admin_owner"
  | "admin_operations"
  | "admin_finance"
  | "admin_support"
  | "clientes_sb"
  | "user_default"
  | "personal_default"
  | "nutri_default";

export type AppPermission =
  | "admin.accessProfiles"
  | "admin.dashboard"
  | "admin.users"
  | "admin.users.detail"
  | "admin.personals"
  | "admin.personals.detail"
  | "admin.nutris"
  | "admin.finance"
  | "admin.professionals.create";

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
];

const PROFILE_PERMISSIONS: Record<AccessProfile, AppPermission[]> = {
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
};

export const ACCESS_PROFILE_META: Record<
  AccessProfile,
  { label: string; roleScope: Role | "mixed"; description: string }
> = {
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
};

export const ACCESS_PROFILE_ORDER: AccessProfile[] = [
  "admin_owner",
  "admin_operations",
  "admin_finance",
  "admin_support",
  "clientes_sb",
  "user_default",
  "personal_default",
  "nutri_default",
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
];

export function getProfilePermissions(profile: AccessProfile) {
  return PROFILE_PERMISSIONS[profile] ?? [];
}

export function defaultAccessProfileByRole(role?: Role | null): AccessProfile | null {
  if (role === "admin") return "admin_owner";
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
