import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

import AccountSettingsPage from "./user/AccountSettingsPage";
import TreinosPage from "./user/TreinosPage";
import HomeWorkoutsPage from "./user/HomeWorkoutsPage";
import UpgradePlanPage from "./user/UpgradePlanPage";
import WorkoutPlayerPage from "./user/WorkoutPlayerPage";

// ✅ NOVAS PÁGINAS
import TodayPage from "./user/TodayPage";
import ProgressPage from "./user/ProgressPage";
import UserMessagesPage from "./user/UserMessagesPage";
import UserProfilePage from "./user/UserProfilePage";

// ✅ ONBOARDING
import OnboardingPage from "./user/OnboardingPage";

const USER_BASE = "/app/user" as const;
const USER_DEFAULT = "/app/user/today" as const;

function MenuLink({ to, label, icon }: { to: string; label: string; icon?: string }) {
  return (
    <NavLink
      to={to} // ✅ ABSOLUTO sempre
      style={({ isActive }) => ({
        padding: "12px 12px",
        borderRadius: 12,
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "#FFFFFF",
        background: isActive ? "rgba(255,106,0,.18)" : "transparent",
        border: isActive ? "1px solid rgba(255,106,0,.35)" : "1px solid rgba(255,255,255,.10)",
        fontWeight: 900,
      })}
    >
      <span style={{ width: 18, textAlign: "center" }}>{icon ?? "•"}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function RedirectToDefault() {
  return <Navigate to={USER_DEFAULT} replace />;
}

export default function UserApp() {
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
        <div style={{ fontWeight: 1000, letterSpacing: 0.2 }}>Painel do Aluno</div>

        <div style={{ display: "grid", gap: 10 }}>
          {/* ✅ MENU */}
          <MenuLink to={`${USER_BASE}/today`} label="Hoje" icon="🏠" />
          <MenuLink to={`${USER_BASE}/treinos`} label="Treinos" icon="🏋️" />
          <MenuLink to={`${USER_BASE}/progress`} label="Progresso" icon="📈" />
          <MenuLink to={`${USER_BASE}/messages`} label="Mensagens" icon="💬" />
          <MenuLink to={`${USER_BASE}/profile`} label="Perfil" icon="👤" />

          <div style={{ height: 8 }} />

          {/* ✅ Atalhos */}
          <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,.55)" }}>ATALHOS</div>
          <MenuLink to={`${USER_BASE}/upgrade`} label="Evoluir plano" icon="⭐" />
          <MenuLink to={`${USER_BASE}/settings`} label="Configurações" icon="⚙️" />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: "1px solid rgba(255,255,255,.10)", paddingTop: 12, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,.65)" }}>CONTA</div>

          <button
            type="button"
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
        </div>
      </aside>

      <main style={{ padding: 22 }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", display: "grid", gap: 14 }}>
          <Routes>
            {/* ✅ INDEX seguro */}
            <Route index element={<RedirectToDefault />} />

            {/* ✅ ROTAS */}
            <Route path="today" element={<TodayPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="messages" element={<UserMessagesPage />} />
            <Route path="profile" element={<UserProfilePage onLogout={handleLogout} />} />

            {/* ✅ ONBOARDING (blindado: relativa + absoluta) */}
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="/app/user/onboarding" element={<OnboardingPage />} />

            {/* ✅ ROTAS antigas (mantidas) */}
            <Route path="treinos" element={<TreinosPage />} />
            <Route path="treinos/em-casa" element={<HomeWorkoutsPage />} />
            <Route path="treinos/player/:workoutId" element={<WorkoutPlayerPage />} />
            <Route path="upgrade" element={<UpgradePlanPage />} />
            <Route path="settings" element={<AccountSettingsPage />} />

            {/* ✅ FALLBACK seguro */}
            <Route path="*" element={<RedirectToDefault />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}