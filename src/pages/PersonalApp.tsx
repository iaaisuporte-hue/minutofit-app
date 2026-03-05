// src/pages/PersonalApp.tsx
import React from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

import DashboardPage from "./personal/DashboardPage";
import StudentsListPage from "./personal/StudentsListPage";
import ConsultingStudentsPage from "./personal/ConsultingStudentsPage";
import MessagesPage from "./personal/MessagesPage";
import ReviewWorkoutsPage from "./personal/ReviewWorkoutsPage";
import WorkoutLibraryPage from "./personal/WorkoutLibraryPage";

// ✅ BUILDER REAL
import WorkoutBuilderPage from "./personal/WorkoutBuilderPage";

const PERSONAL_DASHBOARD = "/app/personal/dashboard";

function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        padding: "12px 12px",
        borderRadius: 12,
        textDecoration: "none",
        display: "block",
        color: "#FFFFFF",
        background: isActive ? "rgba(255,106,0,.18)" : "transparent",
        border: isActive ? "1px solid rgba(255,106,0,.35)" : "1px solid rgba(255,255,255,.10)",
        fontWeight: 900,
      })}
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
      style={({ isActive }) => ({
        padding: "12px 12px",
        borderRadius: 12,
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        background: "#FF6A00",
        color: "#0F0F0F",
        border: "1px solid rgba(255,106,0,.45)",
        fontWeight: 1000,
        boxShadow: "0 10px 22px rgba(0,0,0,.35)",
        outline: isActive ? "2px solid rgba(255,255,255,.12)" : "none",
      })}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 1000 }}>→</span>
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
        color: "#FFFFFF",
      }}
    >
      <div style={{ fontWeight: 1000, fontSize: 18 }}>Workout Builder</div>
      <div style={{ marginTop: 8, color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
        {studentId ? (
          <>
            Aluno selecionado: <b style={{ color: "#FFFFFF" }}>{studentId}</b>
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

  componentDidCatch(err: any) {
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        minHeight: "100vh",
        background: "#0F0F0F",
        color: "#FFFFFF",
        width: "100%",
      }}
    >
      <aside
        style={{
          padding: 16,
          borderRight: "1px solid rgba(255,255,255,.10)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "linear-gradient(180deg, #0C0C0C, #111111)",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ fontWeight: 1000, letterSpacing: 0.2 }}>Painel do Personal</div>

        <div style={{ display: "grid", gap: 10 }}>
          <MenuLink to="/app/personal/dashboard" label="Dashboard" />
          <MenuLink to="/app/personal/students" label="Ver alunos" />
          <MenuLink to="/app/personal/consulting" label="Alunos consultoria" />
          <MenuLink to="/app/personal/messages" label="Mensagens" />
          <MenuLink to="/app/personal/review" label="Revisar treinos" />
          <MenuLink to="/app/personal/library" label="Treinos gerais (Netflix)" />

          <div style={{ height: 8 }} />
          <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,.65)" }}>AÇÃO RÁPIDA</div>

          {/* ✅ Mantém a rota "sem aluno" (o builder tem seletor de aluno) */}
          <MenuCTA to="/app/personal/workout-builder" label="Montar treino" />
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleLogout}
          style={{
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.10)",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            fontWeight: 900,
            color: "#FFFFFF",
          }}
        >
          Sair
        </button>
      </aside>

      <main style={{ padding: 22, background: "#0F0F0F", minHeight: "100vh" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <Routes>
            <Route index element={<RedirectToDashboard />} />

            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentsListPage />} />
            <Route path="consulting" element={<ConsultingStudentsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="review" element={<ReviewWorkoutsPage />} />
            <Route path="library" element={<WorkoutLibraryPage />} />

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
      </main>
    </div>
  );
}