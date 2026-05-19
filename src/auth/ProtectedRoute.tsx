import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "./AuthContext"; // ✅ type-only import

export default function ProtectedRoute({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, role, profileCompleted, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/" replace />;

  if (user?.mustChangePassword && location.pathname !== "/force-password-change") {
    return <Navigate to="/force-password-change" replace />;
  }

  // Check if profile completion is required
  if (profileCompleted === false && location.pathname !== "/profile-completion" && location.pathname !== "/force-password-change") {
    return <Navigate to="/profile-completion" replace />;
  }

  // ✅ Admin tem acesso total
  if (role === "admin") return <>{children}</>;

  if (!role || !allow.includes(role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
