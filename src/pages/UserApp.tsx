import { useState } from "react";
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

// ✅ TREINO SUGERIDO
import SuggestedTrainingPage from "./user/SuggestedTrainingPage";

const USER_BASE = "/app/user" as const;
const USER_DEFAULT = "/app/user/today" as const;

const TRAINING_VIDEOS = {
  chest: [
    { title: "Chest Workout for Beginners", url: "https://www.youtube.com/watch?v=tgPRuPJ7j0U", duration: "15 min" },
    { title: "Complete Chest Workout", url: "https://www.youtube.com/watch?v=jT5d-4hCL6o", duration: "20 min" },
    { title: "Chest and Triceps", url: "https://www.youtube.com/watch?v=y5Vy-qI5xyk", duration: "25 min" },
    { title: "Upper Chest Focus", url: "https://www.youtube.com/watch?v=3AJtJ5_dVrY", duration: "18 min" },
  ],
  leg: [
    { title: "Leg Workout for Beginners", url: "https://www.youtube.com/watch?v=ZY9f8pDAzLg", duration: "20 min" },
    { title: "Full Leg Day Workout", url: "https://www.youtube.com/watch?v=8Rg2N_g186s", duration: "30 min" },
    { title: "Legs and Glutes", url: "https://www.youtube.com/watch?v=1yMiSwzWU2Y", duration: "25 min" },
    { title: "Lower Body Strength", url: "https://www.youtube.com/watch?v=l49kJPBJEfE", duration: "22 min" },
  ],
};

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
  const [selectedTraining, setSelectedTraining] = useState<"chest" | "leg" | null>(null);

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

          {/* ✅ Treino Sugerido */}
          <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,.55)" }}>TREINO PERSONALIZADO</div>
          <MenuLink to={`${USER_BASE}/suggested-training`} label="Treino Sugerido" icon="🎯" />

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

            {/* ✅ TREINO SUGERIDO */}
            <Route path="suggested-training" element={<SuggestedTrainingPage />} />

            {/* ✅ FALLBACK seguro */}
            <Route path="*" element={<RedirectToDefault />} />
          </Routes>
        </div>
      </main>

      {/* ✅ MODAL DE VÍDEOS DE TREINO */}
      {selectedTraining && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,.70)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedTraining(null)}
        >
          <div
            style={{
              background: "#171717",
              borderRadius: 16,
              padding: 24,
              maxWidth: 700,
              maxHeight: "80vh",
              overflow: "auto",
              border: "1px solid rgba(255,255,255,.10)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {selectedTraining === "chest" ? "🏋️ Treino de Peito" : "🦵 Treino de Perna"}
              </div>
              <button
                onClick={() => setSelectedTraining(null)}
                style={{
                  background: "rgba(255,255,255,.10)",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {TRAINING_VIDEOS[selectedTraining].map((video, idx) => (
                <a
                  key={idx}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    background: "rgba(255,106,0,.08)",
                    border: "1px solid rgba(255,106,0,.20)",
                    borderRadius: 12,
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,106,0,.15)";
                    e.currentTarget.style.borderColor = "rgba(255,106,0,.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,106,0,.08)";
                    e.currentTarget.style.borderColor = "rgba(255,106,0,.20)";
                  }}
                >
                  <div style={{ fontSize: 32 }}>▶️</div>
                  <div>
                    <div style={{ fontWeight: 900, color: "#FFFFFF" }}>{video.title}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.60)", marginTop: 4 }}>{video.duration}</div>
                  </div>
                </a>
              ))}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.10)", fontSize: 12, color: "rgba(255,255,255,.60)" }}>
              Clique em qualquer vídeo para assistir no YouTube
            </div>
          </div>
        </div>
      )}
    </div>
  );
}