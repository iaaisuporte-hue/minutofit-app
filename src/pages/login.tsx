// src/pages/Login.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";

const COLORS = {
  bg: "#0F0F0F",
  panel: "#171717",
  border: "rgba(255,255,255,.10)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.70)",
  orange: "#FF6A00",
  orangeSoft: "rgba(255,106,0,.16)",
};

function nextPathByRole(role: Role) {
  switch (role) {
    case "user":
      return "/app/user";
    case "personal":
      return "/app/personal";
    case "nutri":
      return "/app/nutri";
    case "admin":
      return "/app/admin";
    default:
      return "/login";
  }
}

export default function LoginPage() {
  const nav = useNavigate();
  const { login, isAuthenticated, role } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Se já estiver logado, manda pra home do papel.
  useMemo(() => {
    if (isAuthenticated && role) nav(nextPathByRole(role), { replace: true });
  }, [isAuthenticated, role, nav]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = login(email, password);
    if (!res.ok) {
      setError(res.message);
      return;
    }

    nav(nextPathByRole(res.role), { replace: true });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>TREINAí</div>
          <div style={{ color: COLORS.muted, marginTop: 6 }}>Acesse sua conta</div>
        </div>

        {error ? (
          <div
            style={{
              background: COLORS.orangeSoft,
              border: `1px solid ${COLORS.orange}`,
              padding: 10,
              borderRadius: 12,
              marginBottom: 12,
              color: COLORS.text,
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>E-mail</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: admin@treinai.com"
              autoComplete="email"
              style={{
                background: "#101010",
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: "12px 12px",
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: COLORS.muted, fontSize: 13 }}>Senha</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              type="password"
              autoComplete="current-password"
              style={{
                background: "#101010",
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: "12px 12px",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: 6,
              background: COLORS.orange,
              color: "#0B0B0B",
              border: "none",
              borderRadius: 12,
              padding: "12px 12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Entrar
          </button>

          <div style={{ marginTop: 10, color: COLORS.muted, fontSize: 13, lineHeight: 1.35 }}>
            <div style={{ marginBottom: 6, fontWeight: 700, color: COLORS.text }}>Logins de teste (MVP)</div>
            <div>Admin: admin@treinai.com / 123456</div>
            <div>Personal: personal@treinai.com / 123456</div>
            <div>Aluno: teste1@treinai.com / 123456</div>
          </div>
        </form>
      </div>
    </div>
  );
}