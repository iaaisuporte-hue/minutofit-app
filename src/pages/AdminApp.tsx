import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import AdminDashboardPage from "./admin/AdminDashboardPage";
import AdminUsersPage from "./admin/AdminUsersPage";
import AdminUserDetailsPage from "./admin/AdminUserDetailsPage";
import AdminPersonalsPage from "./admin/AdminPersonalsPage";
import AdminPersonalDetailsPage from "./admin/AdminPersonalDetailsPage";
import AdminNutrisPage from "./admin/AdminNutrisPage";
import AdminProfessionalCreatePage from "./admin/AdminProfessionalCreatePage";
import AdminFinancePage from "./admin/AdminFinancePage";
import type { AppPermission } from "../auth/accessControl";
import AdminAccessProfilesPage from "./admin/AdminAccessProfilesPage";

function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
      {label}
    </NavLink>
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

  const menuItems: Array<{ to: string; label: string; permission: AppPermission }> = [
    { to: "/app/admin/dashboard", label: "Visão geral", permission: "admin.dashboard" },
    { to: "/app/admin/access-profiles", label: "Perfis de acesso", permission: "admin.accessProfiles" },
    { to: "/app/admin/users", label: "Alunos", permission: "admin.users" },
    { to: "/app/admin/personals", label: "Personals", permission: "admin.personals" },
    { to: "/app/admin/nutris", label: "Nutris", permission: "admin.nutris" },
    { to: "/app/admin/finance", label: "Financeiro", permission: "admin.finance" },
  ];

  return (
    <AppShell
      sidebar={
        <>
          <div className="heroPanel" style={{ padding: 18 }}>
            <div className="shellTitle">Painel Admin</div>
            <div className="shellSubtitle" style={{ marginTop: 8 }}>
              Operação da plataforma, leitura rápida de saúde do negócio e gestão de usuários, personals e nutris.
            </div>
          </div>

          <div className="navStack">
            {menuItems
              .filter((item) => auth.hasPermission(item.permission))
              .map((item) => (
                <MenuLink key={item.to} to={item.to} label={item.label} />
              ))}
          </div>

          <div style={{ flex: 1 }} />

          <button onClick={handleLogout} className="logoutButton">
            Sair
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div className="pageSurface pageSurfacePad" style={{ maxWidth: 1180, margin: "0 auto" }}>
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
              path="finance"
              element={
                <AdminPermissionRoute permission="admin.finance">
                  <AdminFinancePage />
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
