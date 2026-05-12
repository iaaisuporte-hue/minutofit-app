import React from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import MinutoFitLogo from "../components/MinutoFitLogo";
import { ProductGate } from "../components/ProductGate";
import { EmptyState } from "../components/EmptyState";
import type { AppPermission } from "../auth/accessControl";
import { extractTenantSlug } from "../services/tenantHost";

import AcademyDashboardPage       from "./academy/AcademyDashboardPage";
import AcademyTeamPage            from "./academy/AcademyTeamPage";
import AcademyBrandingSettingsPage from "./academy/AcademyBrandingSettingsPage";
import AcademyStudentsPage        from "./academy/AcademyStudentsPage";
import AcademyStudentDetailPage   from "./academy/AcademyStudentDetailPage";
import AcademyPlansPage           from "./academy/AcademyPlansPage";
import AcademyFinancePage         from "./academy/AcademyFinancePage";
import { academyFallbackLogoUrl } from "./academy/academyFallbackLogo";

function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink end to={to} className={({ isActive }) => `navLink${isActive ? " navLinkActive" : ""}`}>
      {label}
    </NavLink>
  );
}

/** Primeira rota de academia que o usuário pode abrir (evita redirect para dashboard sem permissão). */
const ACADEMY_DEFAULT_ROUTE_ORDER: Array<{ to: string; permission: AppPermission }> = [
  { to: "/app/academy/dashboard", permission: "academy.dashboard" },
  { to: "/app/academy/students", permission: "academy.students.read" },
  { to: "/app/academy/plans", permission: "academy.plans.read" },
  { to: "/app/academy/finance", permission: "academy.finance.read" },
  { to: "/app/academy/team", permission: "academy.invitations.write" },
  { to: "/app/academy/branding", permission: "academy.branding" },
];

function RedirectToFirstAcademyRoute() {
  const auth = useAuth();
  const dest =
    ACADEMY_DEFAULT_ROUTE_ORDER.find((r) => auth.hasPermission(r.permission))?.to ?? "/app";
  return <Navigate to={dest} replace />;
}

function AcademyPermissionRoute({
  permission,
  children,
  fallbackTo = "/app",
}: {
  permission: AppPermission;
  children: React.ReactNode;
  /** Destino quando o usuário não tem a permissão (não use a mesma URL da rota atual). */
  fallbackTo?: string;
}) {
  const auth = useAuth();
  if (!auth.hasPermission(permission)) {
    return <Navigate to={fallbackTo} replace />;
  }
  return <>{children}</>;
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
  const isTenantSubdomain = !!slug;
  const tenantFallbackLogo = academyFallbackLogoUrl(slug ?? activeAcademy?.slug);

  function handleLogout() {
    auth.logout();
    navigate("/login", { replace: true });
  }

  const sidebar = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo / wordmark */}
      <div style={{ padding: "var(--space-5) var(--space-4) var(--space-3)" }}>
        {isTenantSubdomain ? (
          auth.branding?.logoUrl ? (
            <img src={auth.branding.logoUrl} alt={academyLabel} className="tenant-logo" />
          ) : tenantFallbackLogo ? (
            <img src={tenantFallbackLogo} alt={academyLabel} className="tenant-logo" />
          ) : (
            <div className="tenant-wordmark" title={academyLabel}>{academyLabel}</div>
          )
        ) : (
          <>
            <MinutoFitLogo />
            <div className="shellSubtitle" title={academyLabel} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{academyLabel}</div>
          </>
        )}
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
        {isTenantSubdomain && (
          <div className="powered-by">powered by MinutoFit</div>
        )}
      </div>
    </div>
  );

  return (
    <ProductGate
      productKey="academia"
      fallback={
        <div className="page-container" style={{ maxWidth: 520, margin: "var(--space-8) auto" }}>
          <EmptyState
            eyebrow="Acesso à academia"
            title="Produto Academia não ativo"
            description="Sua conta ainda não inclui o módulo de gestão da academia. Entre em contato com o administrador da sua unidade ou com o suporte MetaCore para habilitar o acesso."
          />
        </div>
      }
    >
    <AppShell sidebar={sidebar}>
      <Routes>
        <Route index element={<RedirectToFirstAcademyRoute />} />
        <Route
          path="dashboard"
          element={
            <AcademyPermissionRoute permission="academy.dashboard" fallbackTo="/app/academy/students">
              <AcademyDashboardPage />
            </AcademyPermissionRoute>
          }
        />
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
              <AcademyFinancePage />
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
        <Route path="*" element={<RedirectToFirstAcademyRoute />} />
      </Routes>
    </AppShell>
    </ProductGate>
  );
}
