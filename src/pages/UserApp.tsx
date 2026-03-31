import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import { useFeatureFlags } from "../auth/FeatureFlagsContext";

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
import MyWorkoutPlansPage from "./user/MyWorkoutPlansPage";

// ✅ ONBOARDING
import OnboardingPage from "./user/OnboardingPage";

// ✅ TREINO SUGERIDO
import SuggestedTrainingPage from "./user/SuggestedTrainingPage";
import ComplianceBanner from "../components/ComplianceBanner";

const USER_BASE = "/app/user" as const;
const USER_DEFAULT = "/app/user/today" as const;

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
  const { logout } = useAuth();
  const { hasFeature, loading } = useFeatureFlags();
  const canTracker = hasFeature("tracker");
  const canMessages = hasFeature("messages");
  const canProfile = hasFeature("profile");
  const canTrainingAi = hasFeature("training_ai");
  const canSuggestedTraining = hasFeature("suggested_training");
  const canWorkouts = hasFeature("workouts");
  const canHomeWorkouts = hasFeature("home_workouts");
  const canSettings = hasFeature("settings");

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
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
              {canWorkouts && <MenuLink to={`${USER_BASE}/treinos`} label="Treinos" icon="🏋️" />}
              {canWorkouts && <MenuLink to={`${USER_BASE}/ficha`} label="Minha ficha" icon="📋" />}
              {canHomeWorkouts && <MenuLink to={`${USER_BASE}/treinos/em-casa`} label="Treinos em casa" icon="🏠" />}
              {canTracker && <MenuLink to={`${USER_BASE}/activities`} label="Tracker" icon="🏃" />}
              {canMessages && <MenuLink to={`${USER_BASE}/messages`} label="Mensagens" icon="💬" />}
              {canProfile && <MenuLink to={`${USER_BASE}/profile`} label="Perfil" icon="👤" />}

              {(canSuggestedTraining || canTrainingAi) && <div style={{ height: 4 }} />}
              {(canSuggestedTraining || canTrainingAi) && <div className="sectionLabel">Treino personalizado</div>}
              {canSuggestedTraining && <MenuLink to={`${USER_BASE}/suggested-training`} label="Treino Sugerido" icon="🎯" />}
              {canTrainingAi && <MenuLink to={`${USER_BASE}/movement-lab`} label="Lab de Movimento" icon="📷" />}

              <div style={{ height: 4 }} />
              {canSettings && <MenuLink to={`${USER_BASE}/settings`} label="Configurações" icon="⚙️" />}
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
            minWidth: 0,
            width: "100%",
          }}
        >
          <div className="pageSurface pageSurfacePad">
            <ComplianceBanner />
            <Routes>
              {/* ✅ INDEX seguro */}
              <Route index element={<RedirectToDefault />} />

              {/* ✅ ROTAS */}
              <Route path="today" element={<TodayPage />} />
              <Route
                path="activities"
                element={
                  <LimitedUserOnly allowed={canTracker}>
                    <ActivityTrackerPage />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="messages"
                element={
                  <LimitedUserOnly allowed={canMessages}>
                    <UserMessagesPage />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="profile"
                element={
                  <LimitedUserOnly allowed={canProfile}>
                    <UserProfilePage onLogout={handleLogout} />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="movement-lab"
                element={
                  <LimitedUserOnly allowed={canTrainingAi}>
                    <MovementLabPage />
                  </LimitedUserOnly>
                }
              />

              {/* ✅ ONBOARDING (blindado: relativa + absoluta) */}
              <Route
                path="onboarding"
                element={
                  <LimitedUserOnly allowed={canTrainingAi}>
                    <OnboardingPage />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="/app/user/onboarding"
                element={
                  <LimitedUserOnly allowed={canTrainingAi}>
                    <OnboardingPage />
                  </LimitedUserOnly>
                }
              />

              {/* ✅ ROTAS antigas (mantidas) */}
              <Route
                path="treinos"
                element={
                  <LimitedUserOnly allowed={canWorkouts}>
                    <TreinosPage />
                  </LimitedUserOnly>
                }
              />
              <Route
                path="ficha"
                element={
                  <LimitedUserOnly allowed={canWorkouts}>
                    <MyWorkoutPlansPage />
                  </LimitedUserOnly>
                }
              />
              <Route path="treinos/em-casa" element={<LimitedUserOnly allowed={canHomeWorkouts}><HomeWorkoutsPage /></LimitedUserOnly>} />
              <Route path="treinos/player/:workoutId" element={<WorkoutPlayerPage />} />
              <Route
                path="upgrade"
                element={
                  <LimitedUserOnly allowed={!loading}>
                    <UpgradePlanPage />
                  </LimitedUserOnly>
                }
              />
              <Route path="settings" element={<LimitedUserOnly allowed={!loading}><AccountSettingsPage /></LimitedUserOnly>} />

              {/* ✅ TREINO SUGERIDO */}
              <Route
                path="suggested-training"
                element={
                  <LimitedUserOnly allowed={canSuggestedTraining}>
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
  );
}
