import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { FeatureFlagsProvider } from "./auth/FeatureFlagsContext";
import ProtectedRoute from "./auth/ProtectedRoute";

import { ToastProvider } from "./components/Toast";
import Login from "./pages/login";
import Register from "./pages/register";
import RegisterPersonal from "./pages/register-personal";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProfileCompletionPage from "./pages/ProfileCompletionPage";
import ForcePasswordChangePage from "./pages/ForcePasswordChangePage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import DirectInviteAcceptPage from "./pages/DirectInviteAcceptPage";
import CookieConsentBanner from "./components/CookieConsentBanner";
import ThemeToggle from "./components/ThemeToggle";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfUsePage from "./pages/TermsOfUsePage";
import WaitlistPage from "./pages/WaitlistPage";
import { NativeAppBridge } from "./lib/NativeAppBridge";
import { AppUpdateBanner } from "./features/pwa/AppUpdateBanner";
import { OfflineBanner } from "./features/pwa/OfflineBanner";
import RouteFallback from "./components/RouteFallback";

// As cinco áreas autenticadas entram sob demanda. Antes tudo virava UM bundle de
// 2,19 MB (600 KB gzip) sem nenhum corte: quem abria o /login baixava o mapa do
// Tracker (leaflet), os gráficos da Evolução (recharts) e as telas de admin,
// academia e nutri — e pagava o parse de tudo antes do primeiro pixel. Como cada
// pessoa vive em UMA dessas áreas, cortar aqui é o ponto de maior alavancagem:
// a rota pública passa a carregar só o que ela usa.
const UserApp = lazy(() => import("./pages/UserApp"));
const PersonalApp = lazy(() => import("./pages/PersonalApp"));
const NutriApp = lazy(() => import("./pages/NutriApp"));
const AdminApp = lazy(() => import("./pages/AdminApp"));
const AcademyApp = lazy(() => import("./pages/AcademyApp"));

export default function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <FeatureFlagsProvider>
        <NativeAppBridge />
        <OfflineBanner />
        <AppUpdateBanner />
        <CookieConsentBanner />
        <ThemeToggle />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/privacidade" element={<PrivacyPolicyPage />} />
          <Route path="/termos" element={<TermsOfUsePage />} />
          <Route path="/lista-de-espera" element={<WaitlistPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cadastro-personal" element={<RegisterPersonal />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/force-password-change"
            element={
              <ProtectedRoute allow={["user", "personal", "nutri", "admin"]}>
                <ForcePasswordChangePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile-completion"
            element={
              <ProtectedRoute allow={["user", "personal", "nutri", "admin"]}>
                <ProfileCompletionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/app/user/*"
            element={
              <ProtectedRoute allow={["user"]}>
                <UserApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/app/saude"
            element={
              <ProtectedRoute allow={["user"]}>
                <Navigate to="/app/user/estado-metabolico" replace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/app/personal/*"
            element={
              <ProtectedRoute allow={["personal"]}>
                <PersonalApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/app/nutri/*"
            element={
              <ProtectedRoute allow={["nutri"]}>
                <NutriApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/app/admin/*"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AdminApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/app/academy/*"
            element={
              <ProtectedRoute allow={["user", "personal", "nutri", "admin"]}>
                <AcademyApp />
              </ProtectedRoute>
            }
          />

          <Route path="/invite/:token" element={<AcceptInvitationPage />} />
          <Route path="/convite-personal/:token" element={<DirectInviteAcceptPage />} />
          <Route path="/convite-nutri/:token" element={<DirectInviteAcceptPage />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </FeatureFlagsProvider>
    </AuthProvider>
    </ToastProvider>
  );
}
