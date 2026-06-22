// src/pages/PersonalApp.tsx
import React, { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import PersonalMobileBottomNav from "../layout/PersonalMobileBottomNav";
import CoreFitLogo from "../components/CoreFitLogo";
import { fetchChatConversations } from "../services/messagesApi";
import "./personal/personalPremium.css";
import { PlanBadge } from "../features/personalPlan/PlanBadge";

import DashboardPage from "./personal/DashboardPage";
import StudentsListPage from "./personal/StudentsListPage";
import MessagesPage from "./personal/MessagesPage";
import ReviewWorkoutsPage from "./personal/ReviewWorkoutsPage";
import WorkoutLibraryPage from "./personal/WorkoutLibraryPage";
import StudentProfilePage from "./personal/StudentProfilePage";
import NetworkProfilePage from "./professional/NetworkProfilePage";

// ✅ BUILDER REAL
import WorkoutBuilderPage from "./personal/WorkoutBuilderPage";

const PERSONAL_DASHBOARD = "/app/personal/dashboard";

function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
    >
      {label}
    </NavLink>
  );
}

function RedirectToDashboard() {
  return <Navigate to={PERSONAL_DASHBOARD} replace />;
}

function RedirectToBuilder() {
  const { studentId } = useParams();
  if (!studentId) return <Navigate to="/app/personal/students" replace />;
  return <Navigate to={`/app/personal/students/${studentId}/workouts/builder`} replace />;
}

/** ✅ Placeholder do builder (mantido como fallback de segurança) */
function WorkoutBuilderPlaceholder() {
  const { studentId } = useParams();
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 16,
        background: "#171717",
        padding: 16,
        color: "#1F2937",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18 }}>Workout Builder</div>
      <div style={{ marginTop: 8, color: "#6B7280", fontSize: 13, lineHeight: 1.35 }}>
        {studentId ? (
          <>
            Aluno selecionado: <b style={{ color: "#1F2937" }}>{studentId}</b>
          </>
        ) : (
          <>
            Nenhum aluno selecionado. Vá em <b>Ver alunos</b> e clique em <b>Criar ficha</b>.
          </>
        )}
      </div>
    </div>
  );
}

/** ✅ Error Boundary simples pra evitar "tela branca" */
class SafeBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error("PersonalApp SafeBoundary:", err);
  }

  render() {
    if (this.state.hasError) return <WorkoutBuilderPlaceholder />;
    return this.props.children;
  }
}

/** Ícone SVG de mensagens */
function MessagesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function PersonalApp() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchChatConversations()
      .then((convs) => {
        const total = convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
        setUnreadCount(total);
      })
      .catch(() => {/* silencioso — badge simplesmente não aparece */});
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const mobileMessagesIcon = (
    <NavLink
      to="/app/personal/messages"
      style={{ position: "relative", display: "flex", alignItems: "center", padding: 8, borderRadius: 8, color: "var(--color-text-muted)", textDecoration: "none" }}
      title="Mensagens"
    >
      {({ isActive }) => (
        <>
          <span style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)", display: "flex" }}>
            <MessagesIcon />
          </span>
          {unreadCount > 0 && (
            <span style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 999, background: "var(--color-primary)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1 }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <AppShell
      bottomNav={<PersonalMobileBottomNav onLogout={handleLogout} />}
      mobileHeader={mobileMessagesIcon}
      sidebar={
        <>
          {/* Cabeçalho da sidebar: logo + ícone de mensagens */}
          <div style={{ padding: "8px 4px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <CoreFitLogo width={148} />
              <div className="shellSubtitle" style={{ marginTop: 8 }}>Personal</div>
            </div>

            {/* Ícone de mensagens com badge */}
            <NavLink
              to="/app/personal/messages"
              style={{ position: "relative", display: "flex", alignItems: "center", marginTop: 6, padding: "6px", borderRadius: 8, color: "var(--color-text-muted)", textDecoration: "none", flexShrink: 0 }}
              title="Mensagens"
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)", display: "flex" }}>
                    <MessagesIcon />
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 999,
                        background: "var(--color-primary)",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 3px",
                        lineHeight: 1,
                      }}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </div>

          {/* destinos principais — regra 4+1: apenas os 4 destinos de topo */}
          <div className="navStack">
            <MenuLink to="/app/personal/dashboard" label="Hoje" />
            <MenuLink to="/app/personal/students" label="Alunos" />
            <MenuLink to="/app/personal/review" label="Revisões" />
            <MenuLink to="/app/personal/library" label="Programas" />
          </div>

          <div style={{ flex: 1 }} />

          <div className="sidebar-footer">
            <div style={{ marginBottom: 6 }}>
              <PlanBadge />
            </div>
            <NavLink
              to="/app/personal/meu-perfil"
              className={({ isActive }) => `navLink navLink--sm ${isActive ? "navLinkActive" : ""}`}
            >
              Meu perfil
            </NavLink>
            <button type="button" onClick={handleLogout} className="logoutButton">
              Sair da conta
            </button>
          </div>
        </>
      }
    >
      <div className="personal-app-canvas" style={{ display: "grid", gap: 16 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}>
          <Routes>
            <Route index element={<RedirectToDashboard />} />

            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentsListPage />} />
            <Route path="consulting" element={<Navigate to="/app/personal/students" replace />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="review" element={<ReviewWorkoutsPage />} />
            <Route path="library" element={<WorkoutLibraryPage />} />
            <Route path="videos" element={<Navigate to="/app/personal/library" replace />} />

            {/* BUILDER standalone (sem aluno pré-selecionado) */}
            <Route
              path="builder"
              element={
                <SafeBoundary>
                  <WorkoutBuilderPage />
                </SafeBoundary>
              }
            />

            {/* BUILDER (com aluno via rota de estudante) */}
            <Route
              path="students/:studentId/workouts/builder"
              element={
                <SafeBoundary>
                  <WorkoutBuilderPage />
                </SafeBoundary>
              }
            />

            <Route path="workout-builder" element={<Navigate to="/app/personal/students" replace />} />

            {/* compatibilidade com rotas antigas */}
            <Route path="students/:studentId/workouts/new" element={<RedirectToBuilder />} />

            <Route path="students/:studentId" element={<StudentProfilePage />} />

            <Route path="meu-perfil" element={<NetworkProfilePage />} />

            <Route path="*" element={<RedirectToDashboard />} />
          </Routes>
        </div>
      </div>
    </AppShell>
  );
}
