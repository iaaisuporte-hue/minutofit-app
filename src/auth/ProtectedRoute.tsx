import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "./AuthContext"; // ✅ type-only import

export default function ProtectedRoute({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, role, profileCompleted } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Check if profile completion is required
  if (profileCompleted === false) {
    return <Navigate to="/profile-completion" replace />;
  }

  // ✅ Admin tem acesso total
  if (role === "admin") return <>{children}</>;

  if (!role || !allow.includes(role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}