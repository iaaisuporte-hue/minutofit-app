import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import MobileBottomNav from "../layout/MobileBottomNav";
import { useFeatureFlags } from "../auth/FeatureFlagsContext";
import CoreFitLogo from "../components/CoreFitLogo";
import { fetchChatConversations } from "../services/messagesApi";

import { useTodayUserState } from "./user/hooks/useTodayUserState";
import HomeWorkoutsPage from "./user/HomeWorkoutsPage";
import UpgradePlanPage from "./user/UpgradePlanPage";
import WorkoutPlayerPage from "./user/WorkoutPlayerPage";
import WorkoutSessionPage from "./user/WorkoutSessionPage";
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
import GlossarioPage from "./user/GlossarioPage";
import MinhaEquipePage from "./user/MinhaEquipePage";
import NutritionPlanViewPage from "./user/NutritionPlanViewPage";
import MeuPlanoPage from "./user/MeuPlanoPage";
import SportHomePage from "./user/sport/SportHomePage";
import RequireClearance from "../auth/RequireClearance";
import ParqSigningPage from "./user/studentCompliance/ParqSigningPage";

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
  nutrition: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2M5 2v20M16 2c-1.7 0-3 2.2-3 5s1.3 5 3 5v10" />
    </svg>
  ),
  evolution: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  team: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
  sport: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
      <path d="M5.2 5.2l1.4 1.4M17.4 5.2l-1.4 1.4M5.2 18.8l1.4-1.4M17.4 18.8l-1.4-1.4" />
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

// /settings foi fundida no Perfil. Redirect preserva ?focus=compliance / #compliance
// para o deep-link do painel de compliance seguir funcionando (bookmarks, e-mails).
function SettingsRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: `${USER_BASE}/profile`, search: location.search, hash: location.hash }} replace />;
}

export default function UserApp() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "Aluno";
  const { hasFeature, loading } = useFeatureFlags();
  const canMessages = hasFeature("messages");
  const showTracker = true;
  const showTrainingAi = true;
  const canSuggestedTraining = hasFeature("suggested_training");
  const canWorkouts = hasFeature("workouts");
  const canHomeWorkouts = hasFeature("home_workouts");

  const todayUserState = useTodayUserState();
  const isPersonalLed = todayUserState.hasActivePersonal;
  const showSuggestedTrainingNav = canSuggestedTraining && !isPersonalLed;

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!canMessages) return;
    fetchChatConversations()
      .then((convs) => {
        const total = convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
        setUnreadCount(total);
      })
      .catch(() => {/* silencioso — badge simplesmente não aparece */});
  }, [canMessages]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  // Mensagens como ícone no topo (não é aba do bottom nav). Mantém as 5 abas
  // fixas e segue o mesmo padrão "destinos + ícone" da área do personal.
  const mobileMessagesIcon = canMessages ? (
    <NavLink
      to={`${USER_BASE}/messages`}
      style={{ position: "relative", display: "flex", alignItems: "center", padding: 8, borderRadius: 8, color: "var(--color-text-muted)", textDecoration: "none" }}
      title="Mensagens"
      aria-label="Mensagens"
    >
      {({ isActive }) => (
        <>
          <span style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)", display: "flex" }}>
            {NAV_ICONS.messages}
          </span>
          {unreadCount > 0 && (
            <span style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 999, background: "var(--color-primary)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1 }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  ) : undefined;

  return (
      <AppShell
        bottomNav={<MobileBottomNav baseUrl={USER_BASE} />}
        mobileHeader={mobileMessagesIcon}
        sidebar={
          <>
            <div style={{ padding: "8px 4px 16px" }}>
              <CoreFitLogo width={148} />
              <div className="shellSubtitle" style={{ marginTop: 8 }}>{firstName}</div>
            </div>

            <div className="navStack">
              {/* 5 destinos principais — espelham as abas fixas do mobile */}
              <MenuLink to={`${USER_BASE}/today`} label="Hoje" iconKey="home" />
              <MenuLink to={`${USER_BASE}/plano`} label="Treino" iconKey="workouts" />
              <MenuLink to={`${USER_BASE}/plano-alimentar`} label="Alimentação" iconKey="nutrition" />
              <MenuLink to={`${USER_BASE}/estado-metabolico`} label="Evolução" iconKey="evolution" />
              <MenuLink to={`${USER_BASE}/profile`} label="Perfil" iconKey="profile" />
              {/* Atalhos secundários (só desktop tem espaço) */}
              {showSuggestedTrainingNav && <MenuLink to={`${USER_BASE}/suggested-training`} label="Treino do dia" iconKey="target" />}
              {showTracker && <MenuLink to={`${USER_BASE}/activities`} label="Atividades" iconKey="tracker" />}
              {canMessages && <MenuLink to={`${USER_BASE}/messages`} label="Mensagens" iconKey="messages" />}
              <MenuLink to={`${USER_BASE}/equipe`} label="Minha equipe" iconKey="team" />
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
                    <RequireClearance>
                      <ActivityTrackerPage />
                    </RequireClearance>
                  </LimitedUserOnly>
                }
              />
              {/* alias semântico: /evolucao → MetabolicStatePage */}
              <Route path="evolucao" element={<MetabolicStatePage />} />
              <Route
                path="messages"
                element={
                  <LimitedUserOnly allowed={canMessages}>
                    <UserMessagesPage />
                  </LimitedUserOnly>
                }
              />
              {/* Perfil é aba fixa do bottom nav → sempre acessível (identidade,
                  conta, equipe e logout). Backend segue gateando dados sensíveis. */}
              <Route
                path="profile"
                element={<UserProfilePage onLogout={handleLogout} />}
              />
              <Route
                path="movement-lab"
                element={
                  <LimitedUserOnly allowed={showTrainingAi}>
                    <RequireClearance>
                      <MovementLabPage />
                    </RequireClearance>
                  </LimitedUserOnly>
                }
              />

              {/* ✅ PAR-Q — assinatura obrigatória, sempre acessível (é o destino do gate) */}
              <Route path="parq" element={<ParqSigningPage />} />

              {/* ✅ ONBOARDING (blindado: relativa + absoluta) — acessível a todos os alunos */}
              <Route path="onboarding" element={<OnboardingPage />} />
              <Route path="/app/user/onboarding" element={<OnboardingPage />} />

              {/* ✅ ROTAS antigas (mantidas) */}
              <Route path="treinos" element={<Navigate to="/app/user/today" replace />} />
              <Route
                path="ficha"
                element={
                  <LimitedUserOnly allowed={!loading}>
                    <RequireClearance>
                      <MeuPlanoPage />
                    </RequireClearance>
                  </LimitedUserOnly>
                }
              />
              <Route
                path="treinos/em-casa"
                element={
                  <LimitedUserOnly allowed={canHomeWorkouts}>
                    <RequireClearance>
                      <HomeWorkoutsPage />
                    </RequireClearance>
                  </LimitedUserOnly>
                }
              />
              {/* ✅ MODO TREINO (execução ao vivo + cronômetro) — Spec 010 UX */}
              <Route
                path="treino/:planId/:dayIndex"
                element={
                  <LimitedUserOnly allowed={!loading}>
                    <RequireClearance>
                      <WorkoutSessionPage />
                    </RequireClearance>
                  </LimitedUserOnly>
                }
              />
              <Route
                path="treinos/player/:workoutId"
                element={
                  <LimitedUserOnly allowed={canWorkouts || canHomeWorkouts || isPersonalLed}>
                    <RequireClearance>
                      <WorkoutPlayerPage />
                    </RequireClearance>
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
              <Route path="settings" element={<SettingsRedirect />} />

              {/* ✅ TREINO SUGERIDO
                  Conteúdo de recomendação client-side, sem dado sensível. Não tem
                  gate de feature/produto: qualquer aluno autenticado alcança pelo
                  card "Ver treino completo" e pelos atalhos do Hoje/metabolismo.
                  O gate anterior (feature flag / estado async de personal) rebatia
                  para /today de forma intermitente — removido de vez. Auth já é
                  garantida pelo ProtectedRoute; PAR-Q continua via RequireClearance. */}
              <Route
                path="suggested-training"
                element={
                  <RequireClearance>
                    <SuggestedTrainingPage />
                  </RequireClearance>
                }
              />

              {/* ✅ GLOSSÁRIO */}
              <Route path="glossario" element={<GlossarioPage />} />

              {/* alias semântico: /espelho → MovementLabPage */}
              <Route
                path="espelho"
                element={
                  <LimitedUserOnly allowed={showTrainingAi}>
                    <RequireClearance>
                      <MovementLabPage />
                    </RequireClearance>
                  </LimitedUserOnly>
                }
              />
              {/* alias semântico: /plano → MyWorkoutPlansPage */}
              <Route
                path="plano"
                element={
                  <LimitedUserOnly allowed={!loading}>
                    <MyWorkoutPlansPage />
                  </LimitedUserOnly>
                }
              />

              {/* ✅ FIGHT INTELLIGENCE — gated por sport_profile.active + clearance PAR-Q */}
              <Route path="sport/*" element={<RequireClearance><SportHomePage /></RequireClearance>} />

              {/* ✅ MINHA EQUIPE — destino próprio (Onda 1.5) + alias */}
              <Route path="equipe" element={<MinhaEquipePage />} />
              <Route path="minha-equipe" element={<MinhaEquipePage />} />
              <Route path="plano-alimentar" element={<NutritionPlanViewPage />} />

              {/* ✅ FALLBACK seguro */}
              <Route path="*" element={<RedirectToDefault />} />
            </Routes>
          </div>
        </div>
      </AppShell>
  );
}
