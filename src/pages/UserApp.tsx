import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import MobileBottomNav from "../layout/MobileBottomNav";
import { useFeatureFlags } from "../auth/FeatureFlagsContext";
import MinutoFitLogo from "../components/MinutoFitLogo";

import { useTodayUserState } from "./user/hooks/useTodayUserState";
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
import MetabolicStatePage from "./user/MetabolicStatePage";
import MovementLabPage from "./user/MovementLabPage";
import MyWorkoutPlansPage from "./user/MyWorkoutPlansPage";

// ✅ ONBOARDING
import OnboardingPage from "./user/OnboardingPage";

// ✅ TREINO SUGERIDO
import SuggestedTrainingPage from "./user/SuggestedTrainingPage";
import ComplianceBanner from "../components/ComplianceBanner";
import { MetabolismPill } from "../components/MetabolismPill";

const USER_BASE = "/app/user" as const;
const USER_DEFAULT = "/app/user/today" as const;

const NAV_ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  workouts: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4v16M18 4v16M1 9h5M18 9h5M1 15h5M18 15h5" />
    </svg>
  ),
  clipboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" />
    </svg>
  ),
  run: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13" cy="4" r="1" /><path d="M7 21l3-6 2 2 3-4" /><path d="M16 21l-3.5-6" /><path d="M8 13l-2-5 5 1 2 3" />
    </svg>
  ),
  tracker: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  messages: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  target: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  lab: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  dot: <span style={{ fontSize: 14, lineHeight: 1 }}>·</span>,
};

function MenuLink({ to, label, iconKey }: { to: string; label: string; iconKey?: keyof typeof NAV_ICONS }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
    >
      <span style={{ width: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {(iconKey && NAV_ICONS[iconKey]) ?? NAV_ICONS.dot}
      </span>
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
  const { logout, user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "Aluno";
  const { hasFeature, loading } = useFeatureFlags();
  const canMessages = hasFeature("messages");
  const canProfile = hasFeature("profile");
  const canTrainingAi = hasFeature("training_ai");
  const showTracker = true;
  const showTrainingAi = true;
  const canSuggestedTraining = hasFeature("suggested_training");
  const canWorkouts = hasFeature("workouts");
  const canHomeWorkouts = hasFeature("home_workouts");
  const canSettings = hasFeature("settings");

  const todayUserState = useTodayUserState();
  const isPersonalLed = todayUserState.hasActivePersonal;
  const showSuggestedTrainingNav = canSuggestedTraining && !isPersonalLed;
  const showWorkoutsNav = canWorkouts && !isPersonalLed;

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
      <AppShell
        bottomNav={
          <MobileBottomNav
            baseUrl={USER_BASE}
            showFicha={true}
            showMessages={canMessages}
            showWorkouts={showWorkoutsNav}
            showLab={canTrainingAi}
            showTracker={showTracker}
            showProfile={canProfile}
            onLogout={handleLogout}
          />
        }
        sidebar={
          <>
            <div style={{ padding: "8px 4px 16px" }}>
              <MinutoFitLogo width={148} />
              <div className="shellSubtitle" style={{ marginTop: 8 }}>{firstName}</div>
            </div>

            <div className="navStack">
              <MenuLink to={`${USER_BASE}/today`} label="Hoje" iconKey="home" />
              <MenuLink to={`${USER_BASE}/estado-metabolico`} label="Estado metabólico" iconKey="tracker" />
              <MenuLink to={`${USER_BASE}/ficha`} label="Minha ficha" iconKey="clipboard" />
              {canTrainingAi && <MenuLink to={`${USER_BASE}/movement-lab`} label="Lab de Movimento" iconKey="lab" />}
              {showSuggestedTrainingNav && <MenuLink to={`${USER_BASE}/suggested-training`} label="Treino do dia" iconKey="target" />}
              {showWorkoutsNav && <MenuLink to={`${USER_BASE}/treinos`} label="Treinos" iconKey="workouts" />}
              {showTracker && <MenuLink to={`${USER_BASE}/activities`} label="Tracker" iconKey="tracker" />}
              {canMessages && <MenuLink to={`${USER_BASE}/messages`} label="Mensagens" iconKey="messages" />}
              {canProfile && <MenuLink to={`${USER_BASE}/profile`} label="Perfil" iconKey="profile" />}

              {canSettings && (
                <div style={{ paddingTop: 12, paddingBottom: 4 }}>
                  <div className="sectionLabel">Geral</div>
                </div>
              )}
              {canSettings && <MenuLink to={`${USER_BASE}/settings`} label="Configurações" iconKey="settings" />}
            </div>

            <div style={{ flex: 1 }} />

            <div className="sidebar-footer" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <MetabolismPill />
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
            minWidth: 0,
            width: "100%",
          }}
        >
          <div>
            <ComplianceBanner />
            <Routes>
              {/* ✅ INDEX seguro */}
              <Route index element={<RedirectToDefault />} />

              {/* ✅ ROTAS */}
              <Route path="today" element={<TodayPage />} />
              <Route path="estado-metabolico" element={<MetabolicStatePage />} />
              <Route
                path="activities"
                element={
                  <LimitedUserOnly allowed={showTracker}>
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
                  <LimitedUserOnly allowed={showTrainingAi}>
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
                  <LimitedUserOnly allowed={!loading}>
                    <MyWorkoutPlansPage />
                  </LimitedUserOnly>
                }
              />
              <Route path="treinos/em-casa" element={<LimitedUserOnly allowed={canHomeWorkouts}><HomeWorkoutsPage /></LimitedUserOnly>} />
              <Route
                path="treinos/player/:workoutId"
                element={
                  <LimitedUserOnly allowed={canWorkouts || canHomeWorkouts}>
                    <WorkoutPlayerPage />
                  </LimitedUserOnly>
                }
              />
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
