import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";
import MinutoFitLogo from "../components/MinutoFitLogo";

function nextPathByRole(role: Role) {
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
  const { login, isAuthenticated, role } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && role) {
      nav(nextPathByRole(role), { replace: true });
    }
  }, [isAuthenticated, role, nav]);

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
    nav(nextPathByRole(res.role), { replace: true });
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <div className="auth-logo">
          <MinutoFitLogo width={140} />
        </div>

        <h1 className="auth-title">Bem-vindo de volta</h1>
        <p className="auth-subtitle">Entre para continuar seu treino.</p>

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
          <Link to="/register">Criar conta</Link>
        </div>
      </form>
    </main>
  );
}
