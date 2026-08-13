import { Link } from "react-router-dom";
import { clearCookieConsent, readCookieConsent } from "../lib/cookieConsent";

export default function PrivacyPolicyPage() {
  const consent = readCookieConsent();

  return (
    <main className="auth-page" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h1 className="auth-title" style={{ textAlign: "left" }}>
        Privacidade e cookies
      </h1>
      <p className="auth-subtitle" style={{ textAlign: "left", marginBottom: 24 }}>
        S2Core — transparência sobre dados pessoais e tecnologias no seu navegador, em linha com a Lei Geral de
        Proteção de Dados (Lei nº 13.709/2018).
      </p>

      <section style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>1. Controlador</h2>
        {/*
          Esta página é linkada da tela de login e das lojas de aplicativos: a
          LGPD (art. 9º, I e III) exige que o controlador e o Encarregado sejam
          identificáveis aqui, não "no suporte da sua organização".
          Mantenha em sincronia com minutofit-web/app/(legal)/privacidade.
        */}
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-muted)" }}>
          O controlador dos dados é <strong>Francisco Everton Rodrigues de Sousa Tecnologia da
          Informação</strong>, CNPJ <strong>36.295.802/0001-13</strong>, com sede em São Paulo/SP.
          Contato do Encarregado (DPO):{" "}
          <a href="mailto:s2core.contato@gmail.com">s2core.contato@gmail.com</a>. Quando o acesso é
          fornecido por uma academia ou parceiro, essa organização atua como controladora dos dados
          operacionais do seu vínculo com ela.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-muted)" }}>
          A política completa, com as categorias de dados de saúde tratadas e as bases legais, está
          em <a href="https://s2core.com.br/privacidade">s2core.com.br/privacidade</a>. Para apagar
          sua conta, veja <a href="https://s2core.com.br/excluir-conta">s2core.com.br/excluir-conta</a>.
        </p>
      </section>

      <section style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>2. Cookies e tecnologias similares</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-muted)" }}>
          <strong>Cookies ou armazenamento local essenciais:</strong> utilizados para manter sua sessão com segurança
          (por exemplo, tokens de autenticação onde o navegador permitir), preferências de interface e proteção contra
          abuso. Esses itens são necessários para o funcionamento do serviço que você solicitou.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-muted)" }}>
          <strong>Cookies opcionais:</strong> medições agregadas de uso para melhorar desempenho e experiência. Só são
          acionados se você consentir pelo banner de cookies.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-muted)" }}>
          <strong>Consentimento:</strong> sua escolha é registrada apenas neste dispositivo (armazenamento local). Você
          pode revisar ou revogar abaixo.
        </p>
        {consent ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text)" }}>
            Decisão atual: opcionais de medição <strong>{consent.analytics ? "aceitos" : "recusados"}</strong> em{" "}
            {new Date(consent.decidedAt).toLocaleString("pt-BR")}.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
            Nenhuma preferência de cookies opcionais registrada neste dispositivo — o banner será exibido novamente após
            redefinir.
          </p>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            clearCookieConsent();
            window.location.reload();
          }}
        >
          Redefinir preferências de cookies
        </button>
      </section>

      <section style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>3. Direitos do titular (LGPD)</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-muted)" }}>
          Conforme a LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade,
          eliminação de dados desnecessários, informação sobre compartilhamentos e revogação de consentimento, quando
          aplicável. Na sua conta, <strong>Perfil → Meus dados</strong> permite exportar tudo o que
          guardamos e excluir a conta sem intermediários. Para os demais pedidos, escreva ao
          Encarregado: <a href="mailto:s2core.contato@gmail.com">s2core.contato@gmail.com</a>.
        </p>
      </section>

      <div className="auth-links" style={{ justifyContent: "flex-start" }}>
        <Link to="/login">Voltar ao login</Link>
      </div>
    </main>
  );
}
