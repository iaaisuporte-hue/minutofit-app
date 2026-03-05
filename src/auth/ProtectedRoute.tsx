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
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // ✅ Admin tem acesso total
  if (role === "admin") return <>{children}</>;

  if (!role || !allow.includes(role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}