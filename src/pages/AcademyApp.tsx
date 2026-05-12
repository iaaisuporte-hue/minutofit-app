import React from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import MinutoFitLogo from "../components/MinutoFitLogo";
import type { AppPermission } from "../auth/accessControl";
import { extractTenantSlug } from "../services/tenantHost";

import AcademyDashboardPage       from "./academy/AcademyDashboardPage";
import AcademyTeamPage            from "./academy/AcademyTeamPage";
import AcademyBrandingSettingsPage from "./academy/AcademyBrandingSettingsPage";
import AcademyStudentsPage        from "./academy/AcademyStudentsPage";
import AcademyStudentDetailPage   from "./academy/AcademyStudentDetailPage";
import AcademyPlansPage           from "./academy/AcademyPlansPage";

function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink end to={to} className={({ isActive }) => `navLink${isActive ? " navLinkActive" : ""}`}>
      {label}
    </NavLink>
  );
}

function RedirectToDashboard() {
  return <Navigate to="/app/academy/dashboard" replace />;
}

function AcademyPermissionRoute({
  permission,
  children,
}: {
  permission: AppPermission;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  if (!auth.hasPermission(permission)) {
    return <Navigate to="/app/academy/dashboard" replace />;
  }
  return <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="section-card">
        <div className="empty-state">
          <p className="empty-state__title">Em desenvolvimento</p>
          <p className="empty-state__body">Esta funcionalidade estará disponível em breve.</p>
        </div>
      </div>
    </div>
  );
}

interface NavItem {
  to:         string;
  label:      string;
  permission?: AppPermission;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { to: "/app/academy/dashboard", label: "Visão geral",       permission: "academy.dashboard"          },
      { to: "/app/academy/students",  label: "Alunos",            permission: "academy.students.read"      },
      { to: "/app/academy/plans",     label: "Planos",            permission: "academy.plans.read"         },
      { to: "/app/academy/finance",   label: "Financeiro",        permission: "academy.finance.read"       },
    ],
  },
  {
    label: "Configuração",
    items: [
      { to: "/app/academy/team",      label: "Equipe",            permission: "academy.invitations.write"  },
      { to: "/app/academy/branding",  label: "Identidade visual", permission: "academy.branding"           },
    ],
  },
];

export default function AcademyApp() {
  const auth     = useAuth();
  const navigate = useNavigate();

  // Display the academy name in the sidebar when available
  const slug = extractTenantSlug();
  const activeAcademy = slug
    ? auth.academies?.find((a) => a.slug === slug)
    : auth.academies?.find((a) => a.id === auth.activeAcademyId);
  const academyLabel = activeAcademy?.displayName ?? "Academia";

  function handleLogout() {
    auth.logout();
    navigate("/login", { replace: true });
  }

  const sidebar = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{ padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
        <MinutoFitLogo />
        <div className="shellSubtitle" title={academyLabel} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{academyLabel}</div>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: "0 var(--space-2)", display: "flex", flexDirection: "column", gap: "var(--space-4)", overflowY: "auto" }}>
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((i) => !i.permission || auth.hasPermission(i.permission));
          if (visible.length === 0) return null;
          return (
            <div key={group.label} className="navStack">
              <div className="sectionLabel" style={{ marginBottom: "var(--space-1)" }}>{group.label}</div>
              {visible.map((item) => (
                <MenuLink key={item.to} to={item.to} label={item.label} />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer" style={{ padding: "var(--space-3) var(--space-2)" }}>
        <button className="logoutButton" onClick={handleLogout}>Sair</button>
      </div>
    </div>
  );

  return (
    <AppShell sidebar={sidebar}>
      <Routes>
        <Route index element={<RedirectToDashboard />} />
        <Route path="dashboard" element={<AcademyDashboardPage />} />
        <Route
          path="students"
          element={
            <AcademyPermissionRoute permission="academy.students.read">
              <AcademyStudentsPage />
            </AcademyPermissionRoute>
          }
        />
        <Route
          path="students/:userId"
          element={
            <AcademyPermissionRoute permission="academy.students.read">
              <AcademyStudentDetailPage />
            </AcademyPermissionRoute>
          }
        />
        <Route
          path="plans"
          element={
            <AcademyPermissionRoute permission="academy.plans.read">
              <AcademyPlansPage />
            </AcademyPermissionRoute>
          }
        />
        <Route
          path="team"
          element={
            <AcademyPermissionRoute permission="academy.invitations.write">
              <AcademyTeamPage />
            </AcademyPermissionRoute>
          }
        />
        <Route
          path="finance"
          element={
            <AcademyPermissionRoute permission="academy.finance.read">
              <PlaceholderPage title="Financeiro" />
            </AcademyPermissionRoute>
          }
        />
        <Route
          path="branding"
          element={
            <AcademyPermissionRoute permission="academy.branding">
              <AcademyBrandingSettingsPage />
            </AcademyPermissionRoute>
          }
        />
        <Route path="*" element={<RedirectToDashboard />} />
      </Routes>
    </AppShell>
  );
}
