import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import CoreFitLogo from "../components/CoreFitLogo";
import AdminDashboardPage from "./admin/AdminDashboardPage";
import AdminUsersPage from "./admin/AdminUsersPage";
import AdminUserDetailsPage from "./admin/AdminUserDetailsPage";
import AdminPersonalsPage from "./admin/AdminPersonalsPage";
import AdminPersonalDetailsPage from "./admin/AdminPersonalDetailsPage";
import AdminNutrisPage from "./admin/AdminNutrisPage";
import AdminProfessionalCreatePage from "./admin/AdminProfessionalCreatePage";
import AdminFinancePage from "./admin/AdminFinancePage";
import AdminNutriDetailsPage from "./admin/AdminNutriDetailsPage";
import type { AppPermission } from "../auth/accessControl";
import AdminAccessProfilesPage from "./admin/AdminAccessProfilesPage";
import AdminAcademiesPage from "./admin/AdminAcademiesPage";
import AdminAcademyDetailPage from "./admin/AdminAcademyDetailPage";
import AcademyBrandingSettingsPage from "./academy/AcademyBrandingSettingsPage";
import AdminWorkoutProtocolsPage from "./admin/AdminWorkoutProtocolsPage";
import AdminAuditPage from "./admin/AdminAuditPage";
import AdminCredentialQueuePage from "./admin/AdminCredentialQueuePage";

function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
      {label}
    </NavLink>
  );
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div className="sectionLabel" style={{ padding: "var(--space-2) 4px var(--space-1)" }}>{label}</div>
      {children}
    </div>
  );
}

function RedirectToDashboard() {
  return <Navigate to="/app/admin/dashboard" replace />;
}

function AdminPermissionRoute({
  permission,
  children,
}: {
  permission: AppPermission;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  if (!auth.hasPermission(permission)) {
    return <Navigate to="/app/admin/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function AdminApp() {
  const auth = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    auth.logout();
    navigate("/login", { replace: true });
  }

  const platformItems: Array<{ to: string; label: string; permission: AppPermission }> = [
    { to: "/app/admin/dashboard",       label: "Visão geral",       permission: "admin.dashboard" },
    { to: "/app/admin/workout-protocols", label: "Protocolos treino", permission: "admin.dashboard" },
    { to: "/app/admin/users",           label: "Alunos",            permission: "admin.users" },
    { to: "/app/admin/personals",       label: "Personais",         permission: "admin.personals" },
    { to: "/app/admin/nutris",          label: "Nutricionistas",    permission: "admin.nutris" },
    { to: "/app/admin/access-profiles", label: "Planos e recursos", permission: "admin.accessProfiles" },
  ];

  const operationItems: Array<{ to: string; label: string; permission: AppPermission }> = [
    { to: "/app/admin/finance",    label: "Financeiro",  permission: "admin.finance" },
    { to: "/app/admin/academies",  label: "Academias",   permission: "admin.accessProfiles" },
    { to: "/app/admin/credential-queue", label: "Credenciais",  permission: "admin.personals" },
    { to: "/app/admin/audit",      label: "Auditoria",   permission: "admin.audit" },
  ];

  const visiblePlatform  = platformItems.filter((i) => auth.hasPermission(i.permission));
  const visibleOperation = operationItems.filter((i) => auth.hasPermission(i.permission));

  return (
    <AppShell
      sidebar={
        <>
          <div style={{ padding: "8px 4px 16px" }}>
            <CoreFitLogo width={178} />
          </div>

          <div className="navStack" style={{ gap: "var(--space-4)" }}>
            {visiblePlatform.length > 0 && (
              <SidebarGroup label="Plataforma">
                {visiblePlatform.map((item) => (
                  <MenuLink key={item.to} to={item.to} label={item.label} />
                ))}
              </SidebarGroup>
            )}
            {visibleOperation.length > 0 && (
              <SidebarGroup label="Operação">
                {visibleOperation.map((item) => (
                  <MenuLink key={item.to} to={item.to} label={item.label} />
                ))}
              </SidebarGroup>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <div className="sidebar-footer">
            <button type="button" onClick={handleLogout} className="logoutButton">
              Sair da conta
            </button>
          </div>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}>
          <Routes>
            <Route index element={<RedirectToDashboard />} />
            <Route
              path="access-profiles"
              element={
                <AdminPermissionRoute permission="admin.accessProfiles">
                  <AdminAccessProfilesPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="dashboard"
              element={
                <AdminPermissionRoute permission="admin.dashboard">
                  <AdminDashboardPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="workout-protocols"
              element={
                <AdminPermissionRoute permission="admin.dashboard">
                  <AdminWorkoutProtocolsPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="users"
              element={
                <AdminPermissionRoute permission="admin.users">
                  <AdminUsersPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="users/:userId"
              element={
                <AdminPermissionRoute permission="admin.users.detail">
                  <AdminUserDetailsPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="personals"
              element={
                <AdminPermissionRoute permission="admin.personals">
                  <AdminPersonalsPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="personals/new"
              element={
                <AdminPermissionRoute permission="admin.professionals.create">
                  <AdminProfessionalCreatePage role="personal" />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="personals/:personalId"
              element={
                <AdminPermissionRoute permission="admin.personals.detail">
                  <AdminPersonalDetailsPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="nutris"
              element={
                <AdminPermissionRoute permission="admin.nutris">
                  <AdminNutrisPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="nutris/new"
              element={
                <AdminPermissionRoute permission="admin.professionals.create">
                  <AdminProfessionalCreatePage role="nutri" />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="nutris/:nutriId"
              element={
                <AdminPermissionRoute permission="admin.nutris">
                  <AdminNutriDetailsPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="finance"
              element={
                <AdminPermissionRoute permission="admin.finance">
                  <AdminFinancePage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="academies"
              element={
                <AdminPermissionRoute permission="admin.accessProfiles">
                  <AdminAcademiesPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="academies/:academyId"
              element={
                <AdminPermissionRoute permission="admin.accessProfiles">
                  <AdminAcademyDetailPage />
                </AdminPermissionRoute>
              }
            />
            <Route
              path="academies/:academyId/branding"
              element={
                <AdminPermissionRoute permission="admin.accessProfiles">
                  <AcademyBrandingSettingsPage />
                </AdminPermissionRoute>
              }
            />
            {/* P0-4: Fila de credenciais pendentes */}
            <Route
              path="credential-queue"
              element={
                <AdminPermissionRoute permission="admin.personals">
                  <AdminCredentialQueuePage />
                </AdminPermissionRoute>
              }
            />
            {/* P0-2: Auditoria da plataforma */}
            <Route
              path="audit"
              element={
                <AdminPermissionRoute permission="admin.audit">
                  <AdminAuditPage />
                </AdminPermissionRoute>
              }
            />
            <Route path="*" element={<RedirectToDashboard />} />
          </Routes>
        </div>
      </div>
    </AppShell>
  );
}
