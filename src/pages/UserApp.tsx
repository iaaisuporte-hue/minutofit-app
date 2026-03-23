import { useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";

import AccountSettingsPage from "./user/AccountSettingsPage";
import TreinosPage from "./user/TreinosPage";
import HomeWorkoutsPage from "./user/HomeWorkoutsPage";
import UpgradePlanPage from "./user/UpgradePlanPage";
import WorkoutPlayerPage from "./user/WorkoutPlayerPage";
import ActivityTrackerPage from "./user/ActivityTrackerPage";

// ✅ NOVAS PÁGINAS
import TodayPage from "./user/TodayPage";
import UserMessagesPage from "./user/UserMessagesPage";
import UserProfilePage from "./user/UserProfilePage";
import MovementLabPage from "./user/MovementLabPage";

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
      className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
    >
      <span style={{ width: 18, textAlign: "center" }}>{icon ?? "•"}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function RedirectToDefault() {
  return <Navigate to={USER_DEFAULT} replace />;
}

function LimitedUserOnly({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  if (!allowed) return <Navigate to={USER_DEFAULT} replace />;
  return <>{children}</>;
}

export default function UserApp() {
  const navigate = useNavigate();
  const { logout, accessProfile, email } = useAuth();
  const [selectedTraining, setSelectedTraining] = useState<"chest" | "leg" | null>(null);
  const isLimitedUser = useMemo(() => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    return accessProfile === "clientes_sb" || normalizedEmail === "teste1@treinai.com";
  }, [accessProfile, email]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <AppShell
        sidebar={
          <>
            <div className="heroPanel" style={{ padding: 18 }}>
              <div className="shellTitle">Painel do Aluno</div>
              <div className="shellSubtitle" style={{ marginTop: 8 }}>
                Treino, constância e progresso em um ambiente mais limpo e orientado a resultado.
              </div>
            </div>

            <div className="navStack">
              <MenuLink to={`${USER_BASE}/today`} label="Hoje" icon="🏠" />
              {isLimitedUser ? (
                <MenuLink to={`${USER_BASE}/treinos/em-casa`} label="Treinos em casa" icon="🏠" />
              ) : (
                <>
                  <MenuLink to={`${USER_BASE}/treinos`} label="Treinos" icon="🏋️" />
                  <MenuLink to={`${USER_BASE}/activities`} label="Tracker" icon="🏃" />
                  <MenuLink to={`${USER_BASE}/messages`} label="Mensagens" icon="💬" />
                  <MenuLink to={`${USER_BASE}/profile`} label="Perfil" icon="👤" />

                  <div style={{ height: 4 }} />

                  <div className="sectionLabel">Treino personalizado</div>
                  <MenuLink to={`${USER_BASE}/suggested-training`} label="Treino Sugerido" icon="🎯" />
                  <MenuLink to={`${USER_BASE}/movement-lab`} label="Lab de Movimento" icon="📷" />

                  <div style={{ height: 4 }} />

                  <div className="sectionLabel">Atalhos</div>
                  <MenuLink to={`${USER_BASE}/upgrade`} label="Evoluir plano" icon="⭐" />
                  <MenuLink to={`${USER_BASE}/settings`} label="Configurações" icon="⚙️" />
                </>
              )}
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ borderTop: "1px solid rgba(124,255,107,.14)", paddingTop: 12, display: "grid", gap: 10 }}>
              <div className="sectionLabel">Conta</div>
              <button type="button" onClick={handleLogout} className="logoutButton">
                Sair
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
          <div className="pageSurface pageSurfacePad">
            <Routes>
              {/* ✅ INDEX seguro */}
              <Route index element={<RedirectToDefault />} />

              {/* ✅ ROTAS */}
              <Route path="today" element={<TodayPage />} />
              <Route
                path="activities"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <ActivityTrackerPage />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="messages"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <UserMessagesPage />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="profile"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <UserProfilePage onLogout={handleLogout} />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="movement-lab"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <MovementLabPage />
                  </LimitedUserOnly>
                }
              />

              {/* ✅ ONBOARDING (blindado: relativa + absoluta) */}
              <Route
                path="onboarding"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <OnboardingPage />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="/app/user/onboarding"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <OnboardingPage />
                  </LimitedUserOnly>
                }
              />

              {/* ✅ ROTAS antigas (mantidas) */}
              <Route
                path="treinos"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <TreinosPage />
                  </LimitedUserOnly>
                }
              />
              <Route path="treinos/em-casa" element={<HomeWorkoutsPage />} />
              <Route path="treinos/player/:workoutId" element={<WorkoutPlayerPage />} />
              <Route
                path="upgrade"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <UpgradePlanPage />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="settings"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <AccountSettingsPage />
                  </LimitedUserOnly>
                }
              />

              {/* ✅ TREINO SUGERIDO */}
              <Route
                path="suggested-training"
                element={
                  <LimitedUserOnly allowed={!isLimitedUser}>
                    <SuggestedTrainingPage />
                  </LimitedUserOnly>
                }
              />

              {/* ✅ FALLBACK seguro */}
              <Route path="*" element={<RedirectToDefault />} />
            </Routes>
          </div>
        </div>
      </AppShell>

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
              background: "#161916",
              borderRadius: 24,
              padding: 24,
              maxWidth: 700,
              maxHeight: "80vh",
              overflow: "auto",
              border: "1px solid rgba(124,255,107,.16)",
              boxShadow: "0 24px 60px rgba(0,0,0,.4)",
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
                    background: "rgba(29,185,84,.08)",
                    border: "1px solid rgba(29,185,84,.24)",
                    borderRadius: 12,
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(29,185,84,.16)";
                    e.currentTarget.style.borderColor = "rgba(124,255,107,.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(29,185,84,.08)";
                    e.currentTarget.style.borderColor = "rgba(29,185,84,.24)";
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
    </>
  );
}
