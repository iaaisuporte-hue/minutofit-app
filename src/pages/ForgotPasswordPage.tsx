import { Link } from "react-router-dom";
import MinutoFitLogo from "../components/MinutoFitLogo";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <MinutoFitLogo width={140} />
        </div>

        <h1 className="auth-title">Esqueci minha senha</h1>
        <p className="auth-subtitle">
          Estamos finalizando o fluxo de recuperação de senha.
        </p>

        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-accent-soft)",
            border: "1px solid var(--color-accent-border)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text)",
            lineHeight: 1.6,
          }}
        >
          Por enquanto, envie um e-mail para{" "}
          <a
            href="mailto:suporte@minutofit.com.br"
            style={{ color: "var(--color-accent-hover)", fontWeight: 600 }}
          >
            suporte@minutofit.com.br
          </a>{" "}
          informando seu e-mail de cadastro e redefiniremos sua senha manualmente em até 24h.
        </div>

        <div className="auth-links">
          <Link to="/login">Voltar para o login</Link>
        </div>
      </div>
    </main>
  );
}
