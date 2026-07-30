import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import S2CoreLogo from "../components/S2CoreLogo";
import { changePassword } from "../services/authApi";

export default function ForcePasswordChangePage() {
  const nav = useNavigate();
  const { getUser, role } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath =
    role === "personal" ? "/app/personal" :
    role === "nutri" ? "/app/nutri" :
    role === "admin" ? "/app/admin" :
    "/app/user/today";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("A confirmação precisa ser igual à nova senha.");
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      await getUser();
      nav(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <div className="auth-logo">
          <S2CoreLogo width={96} />
        </div>

        <h1 className="auth-title">Troque sua senha temporária</h1>
        <p className="auth-subtitle">
          Para proteger sua conta, defina uma senha própria antes de continuar.
        </p>

        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="field">
          <label className="label" htmlFor="currentPassword">Senha temporária</label>
          <input
            id="currentPassword"
            className="input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="newPassword">Nova senha</label>
          <input
            id="newPassword"
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            required
          />
          <div className="field-hint">Mínimo 8 caracteres, 1 letra maiúscula e 1 símbolo.</div>
        </div>

        <div className="field">
          <label className="label" htmlFor="confirmPassword">Confirmar nova senha</label>
          <input
            id="confirmPassword"
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}
