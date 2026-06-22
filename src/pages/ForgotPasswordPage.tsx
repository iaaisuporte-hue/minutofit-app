import { Link } from "react-router-dom";
import CoreFitLogo from "../components/CoreFitLogo";
import { Banner } from "../components/Banner";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <CoreFitLogo width={140} />
        </div>

        <h1 className="auth-title">Recuperar acesso</h1>
        <p className="auth-subtitle">
          Redefinição de senha via e-mail automático está em desenvolvimento.
        </p>

        <Banner
          variant="info"
          title="Peça ao admin da sua academia"
          description={
            <>
              Por enquanto, solicite a redefinição diretamente ao administrador da sua academia — ele consegue gerar uma nova senha pelo painel. Ou entre em contato com o suporte:{" "}
              <a href="mailto:suporte@corefit.com.br" style={{ fontWeight: 600, color: "inherit" }}>
                suporte@corefit.com.br
              </a>
            </>
          }
        />

        <div className="auth-links">
          <Link to="/login">Voltar para o login</Link>
          <Link to="/privacidade">Privacidade e cookies</Link>
        </div>
      </div>
    </main>
  );
}
