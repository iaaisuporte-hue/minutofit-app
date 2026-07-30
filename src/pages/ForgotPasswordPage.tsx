import { useState } from "react";
import { Link } from "react-router-dom";
import S2CoreLogo from "../components/S2CoreLogo";
import { forgotPassword } from "../services/authApi";
import { isValidEmail } from "../utils/validators";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    setIsLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
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

        <h1 className="auth-title">Recuperar acesso</h1>

        {sent ? (
          <>
            <p className="auth-subtitle">
              Se houver uma conta com esse e-mail, enviamos um link para redefinir sua senha.
              Verifique também a caixa de spam. O link vale por 30 minutos.
            </p>
            <div className="auth-links">
              <Link to="/login">Voltar para o login</Link>
            </div>
          </>
        ) : (
          <>
            <p className="auth-subtitle">
              Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
            </p>

            <form onSubmit={onSubmit} noValidate>
              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="fp-email">E-mail</label>
                <input
                  id="fp-email"
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: usuario@exemplo.com"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? "Enviando…" : "Enviar link de redefinição"}
              </button>
            </form>

            <div className="auth-links">
              <Link to="/login">Voltar para o login</Link>
              <a href="mailto:suporte@s2core.com.br">Falar com o suporte</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
