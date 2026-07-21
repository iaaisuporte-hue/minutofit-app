import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, type Role, type AcademyForUser } from "../auth/AuthContext";
import type { AccessProfile } from "../auth/accessControl";
import { GoogleSignInButton } from "../auth/GoogleSignInButton";
import CoreFitLogo from "../components/CoreFitLogo";
import { extractTenantSlug, fetchBranding, type AcademyBrandingPublic } from "../services/tenantHost";

const ACADEMY_PROFILES: AccessProfile[] = [
  "academy_owner", "academy_manager", "academy_finance",
  "academy_reception",
];

const ACADEMY_ROLE_SLUGS = new Set([
  "academy_owner", "academy_manager", "academy_finance", "academy_reception",
]);

function nextPathByRole(
  role: Role,
  accessProfile?: AccessProfile | null,
  academies?: AcademyForUser[],
  activeAcademyId?: number | null,
) {
  // Fallback: derive destination from the active academy's roleSlug when
  // accessProfile in the JWT hasn't been set yet (e.g. during first render
  // after login before token refresh).
  if (activeAcademyId && academies?.length) {
    const active = academies.find((a) => a.id === activeAcademyId);
    if (active && ACADEMY_ROLE_SLUGS.has(active.roleSlug)) {
      return "/app/academy";
    }
  }
  // Primary path: JWT accessProfile
  if (accessProfile && ACADEMY_PROFILES.includes(accessProfile)) {
    return "/app/academy";
  }
  switch (role) {
    case "user":     return "/app/user/today";
    case "personal": return "/app/personal";
    case "nutri":    return "/app/nutri";
    case "admin":    return "/app/admin";
    default:         return "/login";
  }
}

export default function LoginPage() {
  const nav = useNavigate();
  const { login, loginWithOAuth, isAuthenticated, role, academies, activeAcademyId, accessProfile } = useAuth();


  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [tenantBranding, setTenantBranding] = useState<AcademyBrandingPublic | null>(null);

  // FE-1.7.2: Load academy branding for personalised login page
  useEffect(() => {
    const slug = extractTenantSlug();
    if (!slug) return;
    fetchBranding().then((b) => {
      if (b) setTenantBranding(b);
    }).catch(() => {});
  }, []);

  // Redirect after login — sempre tem activeAcademyId resolvido (default
  // CoreFit Direto quando o login geral retorna múltiplas academias).
  useEffect(() => {
    if (isAuthenticated && role) {
      nav(nextPathByRole(role, accessProfile, academies, activeAcademyId), { replace: true });
    }
  }, [isAuthenticated, role, accessProfile, academies, activeAcademyId, nav]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await login(email, password);
    if (!res.ok) {
      setError(res.message);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  }

  async function onGoogleCredential(idToken: string) {
    setError(null);
    setIsLoading(true);
    const res = await loginWithOAuth("google", idToken);
    if (!res.ok) {
      setError(res.message || "Falha no login com Google.");
      setIsLoading(false);
      return;
    }
    // Redirecionamento é tratado pelo useEffect (isAuthenticated) + ProtectedRoute.
    setIsLoading(false);
  }

  const welcomeTitle = tenantBranding?.displayName
    ? `Bem-vindo à ${tenantBranding.displayName}`
    : "Bem-vindo de volta";
  const welcomeSub = tenantBranding?.welcomeMessage ?? "Entre para continuar seu treino.";

  return (
    <main className="auth-page">
      {tenantBranding?.bannerUrl && (
        <div style={{
          width: "100%",
          maxWidth: 420,
          margin: "0 auto var(--space-4)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}>
          <img
            src={tenantBranding.bannerUrl}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
          />
        </div>
      )}
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <div className="auth-logo">
          {tenantBranding?.logoUrl ? (
            <img
              src={tenantBranding.logoUrl}
              alt={tenantBranding.displayName ?? "Logo da academia"}
              referrerPolicy="no-referrer"
              style={{ height: 48, maxWidth: 200, objectFit: "contain" }}
            />
          ) : (
            <CoreFitLogo width={96} />
          )}
        </div>

        <h1 className="auth-title">{welcomeTitle}</h1>
        <p className="auth-subtitle">{welcomeSub}</p>

        <GoogleSignInButton onCredential={onGoogleCredential} text="continue_with" />

        <div className="auth-divider"><span>ou entre com e-mail</span></div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex: usuario@exemplo.com"
            autoComplete="email"
            disabled={isLoading}
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">Senha</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            autoComplete="current-password"
            disabled={isLoading}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? "Entrando…" : "Entrar"}
        </button>

        <div className="auth-links">
          <Link to="/forgot-password">Esqueci minha senha</Link>
          <Link to="/register">Criar conta</Link>
          <Link to="/cadastro-personal">Sou personal — criar conta grátis</Link>
          <Link to="/privacidade">Privacidade e cookies</Link>
        </div>
      </form>
    </main>
  );
}
