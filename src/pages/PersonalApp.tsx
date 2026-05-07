// src/pages/PersonalApp.tsx
import React from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import PersonalMobileBottomNav from "../layout/PersonalMobileBottomNav";
import MinutoFitLogo from "../components/MinutoFitLogo";

import DashboardPage from "./personal/DashboardPage";
import StudentsListPage from "./personal/StudentsListPage";
import ConsultingStudentsPage from "./personal/ConsultingStudentsPage";
import MessagesPage from "./personal/MessagesPage";
import ReviewWorkoutsPage from "./personal/ReviewWorkoutsPage";
import WorkoutLibraryPage from "./personal/WorkoutLibraryPage";
import VideoLibraryPage from "./personal/VideoLibraryPage";

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

/** ✅ CTA estilo botão (bem visível) */
function MenuCTA({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navLink navLinkCta ${isActive ? "navLinkActive" : ""}`}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700 }}>→</span>
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

/** ✅ Error Boundary simples pra evitar “tela branca” */
class SafeBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    // Loga no console pra você ver o motivo real
    console.error("PersonalApp SafeBoundary:", err);
  }

  render() {
    if (this.state.hasError) return <WorkoutBuilderPlaceholder />;
    return this.props.children;
  }
}

export default function PersonalApp() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <AppShell
      bottomNav={<PersonalMobileBottomNav />}
      sidebar={
        <>
          <div style={{ padding: "8px 4px 16px" }}>
            <MinutoFitLogo width={148} />
            <div className="shellSubtitle" style={{ marginTop: 8 }}>Personal</div>
          </div>

          <div className="navStack">
            <MenuLink to="/app/personal/dashboard" label="Dashboard" />
            <MenuLink to="/app/personal/students" label="Alunos" />
            <MenuLink to="/app/personal/consulting" label="Consultoria" />
            <MenuLink to="/app/personal/messages" label="Mensagens" />
            <MenuLink to="/app/personal/review" label="Revisar treinos" />
            <MenuLink to="/app/personal/library" label="Biblioteca de treinos" />
            <MenuLink to="/app/personal/videos" label="Vídeos" />

            <div style={{ paddingTop: 12, paddingBottom: 4 }}>
              <div className="sectionLabel">Ação rápida</div>
            </div>
            <MenuCTA to="/app/personal/workout-builder" label="Montar treino" />
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
      <div
      style={{
        display: "grid",
        gap: 16,
      }}
    >
        <div style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}>
          <Routes>
            <Route index element={<RedirectToDashboard />} />

            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentsListPage />} />
            <Route path="consulting" element={<ConsultingStudentsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="review" element={<ReviewWorkoutsPage />} />
            <Route path="library" element={<WorkoutLibraryPage />} />
            <Route path="videos" element={<VideoLibraryPage />} />

            {/* ✅ BUILDER (com aluno) */}
            <Route
              path="students/:studentId/workouts/builder"
              element={
                <SafeBoundary>
                  <WorkoutBuilderPage />
                </SafeBoundary>
              }
            />

            {/* ✅ BUILDER (sem aluno) */}
            <Route
              path="workout-builder"
              element={
                <SafeBoundary>
                  <WorkoutBuilderPage />
                </SafeBoundary>
              }
            />

            {/* ✅ compatibilidade antiga */}
            <Route path="students/:studentId/workouts/new" element={<RedirectToBuilder />} />

            <Route path="*" element={<RedirectToDashboard />} />
          </Routes>
        </div>
      </div>
    </AppShell>
  );
}
