import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { FeatureFlagsProvider } from "./auth/FeatureFlagsContext";
import ProtectedRoute from "./auth/ProtectedRoute";

import { ToastProvider } from "./components/Toast";
import Login from "./pages/login";
import Register from "./pages/register";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ProfileCompletionPage from "./pages/ProfileCompletionPage";
import ForcePasswordChangePage from "./pages/ForcePasswordChangePage";
import UserApp from "./pages/UserApp";
import PersonalApp from "./pages/PersonalApp";
import NutriApp from "./pages/NutriApp";
import AdminApp from "./pages/AdminApp";
import AcademyApp from "./pages/AcademyApp";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import DirectInviteAcceptPage from "./pages/DirectInviteAcceptPage";
import CookieConsentBanner from "./components/CookieConsentBanner";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import WaitlistPage from "./pages/WaitlistPage";

export default function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <FeatureFlagsProvider>
        <CookieConsentBanner />
        <Routes>
          <Route path="/privacidade" element={<PrivacyPolicyPage />} />
          <Route path="/lista-de-espera" element={<WaitlistPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
      </FeatureFlagsProvider>
    </AuthProvider>
    </ToastProvider>
  );
}
