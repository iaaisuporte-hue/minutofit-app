import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";

import Login from "./pages/login";
import ProfileCompletionPage from "./pages/ProfileCompletionPage";
import UserApp from "./pages/UserApp";
import PersonalApp from "./pages/PersonalApp";
import NutriApp from "./pages/NutriApp";
import AdminApp from "./pages/AdminApp";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
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

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}