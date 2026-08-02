import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "./AuthContext"; // ✅ type-only import
import RouteFallback from "../components/RouteFallback";

export default function ProtectedRoute({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, bootstrapping, role, profileCompleted, user } = useAuth();
  const location = useLocation();

  // Sessão guardada ainda sendo validada contra /auth/me. Sem esta espera,
  // `isAuthenticated` (que nasce false) fazia o guard redirecionar para "/" no
  // primeiro render de todo boot frio: o F5 e qualquer deep link caíam em
  // /login e, quando a auth resolvia, o usuário era jogado na rota padrão da
  // role — perdendo o destino. Doía especialmente no PWA, onde o Android mata a
  // aba em segundo plano e a volta parecia "o app esqueceu onde eu estava"
  // (QA mobile 02/ago/2026).
  if (bootstrapping) return <RouteFallback />;

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
