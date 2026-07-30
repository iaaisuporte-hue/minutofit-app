import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import S2CoreLogo from "../components/S2CoreLogo";
import { resetPassword } from "../services/authApi";
import { getStrongPasswordError } from "../utils/validators";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [done, setDone] = useState(false);

  const fieldError = useMemo(() => {
    if (!password) return null;
    const pwErr = getStrongPasswordError(password);
    if (pwErr) return pwErr;
    if (confirm && confirm !== password) return "As senhas não coincidem.";
    return null;
  }, [password, confirm]);

  const canSubmit = !!token && !!password && !!confirm && !fieldError && !isLoading;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const pwErr = getStrongPasswordError(password);
    if (pwErr) { setError(pwErr); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }

    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (err) {
      const e2 = err as Error & { code?: string };
      if (e2.code === "invalid_token") {
        setTokenInvalid(true);
      } else {
        setError(e2.message || "Não foi possível redefinir a senha.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <S2CoreLogo width={96} />
        </div>

        <h1 className="auth-title">Nova senha</h1>

        {!token ? (
          <>
            <p className="auth-subtitle">Link inválido — o token de redefinição não foi encontrado.</p>
            <div className="auth-links">
              <Link to="/forgot-password">Pedir um novo link</Link>
            </div>
          </>
        ) : tokenInvalid ? (
          <>
            <p className="auth-subtitle">
              Este link expirou ou já foi usado. Peça um novo link de redefinição.
            </p>
            <div className="auth-links">
              <Link to="/forgot-password">Pedir um novo link</Link>
            </div>
          </>
        ) : done ? (
          <>
            <p className="auth-subtitle">Senha redefinida com sucesso. Redirecionando para o login…</p>
            <div className="auth-links">
              <Link to="/login">Ir para o login agora</Link>
            </div>
          </>
        ) : (
          <>
            <p className="auth-subtitle">Escolha uma nova senha para sua conta.</p>

            <form onSubmit={onSubmit} noValidate>
              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="rp-password">Nova senha</label>
                <input
                  id="rp-password"
                  className={`input${fieldError ? " input-invalid" : ""}`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="rp-confirm">Confirmar nova senha</label>
                <input
                  id="rp-confirm"
                  className={`input${fieldError ? " input-invalid" : ""}`}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                {fieldError && <span className="field-error">{fieldError}</span>}
              </div>

              <p className="field-hint">
                A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula e 1 símbolo (ex: ! @ # $ %).
              </p>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={!canSubmit}
                aria-busy={isLoading}
              >
                {isLoading ? "Redefinindo…" : "Redefinir senha"}
              </button>
            </form>

            <div className="auth-links">
              <Link to="/login">Voltar para o login</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
