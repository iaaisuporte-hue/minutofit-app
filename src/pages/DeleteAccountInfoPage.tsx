import { Link } from "react-router-dom";

/**
 * Como excluir a conta — página PÚBLICA.
 *
 * ## Por que ela existe aqui, e não só no site
 *
 * A política de exclusão de dados do Google Play exige uma URL **pública**,
 * alcançável sem instalar o app e sem fazer login. O texto canônico vive em
 * `minutofit-web/app/(legal)/excluir-conta/page.tsx` — mas quem responde por
 * `www.s2core.com.br` hoje é esta SPA, e ela não tinha essa rota: um usuário
 * real que abrisse `/excluir-conta` era jogado para o login, que é exatamente
 * o que a loja proíbe. `/termos` e `/privacidade` já eram públicos aqui; esta
 * ficou de fora.
 *
 * Enquanto o site Next não servir esse domínio, os dois textos precisam andar
 * juntos. Ao mudar o fluxo em `accountDeletionService.ts`, revise os dois.
 */
const SECTION_STYLE: React.CSSProperties = { display: "grid", gap: 12, marginBottom: 20 };
const H2_STYLE: React.CSSProperties = { fontSize: 16, margin: 0 };
const P_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: "var(--color-text-muted)",
};
const LIST_STYLE: React.CSSProperties = { ...P_STYLE, paddingLeft: 20, display: "grid", gap: 8 };

export default function DeleteAccountInfoPage() {
  return (
    <main className="auth-page" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h1 className="auth-title" style={{ textAlign: "left" }}>
        Excluir sua conta e seus dados
      </h1>
      <p className="auth-subtitle" style={{ textAlign: "left", marginBottom: 24 }}>
        Você pode apagar sua conta do S2Core a qualquer momento, sem precisar falar com ninguém. A
        exclusão é definitiva e não há como desfazer.
      </p>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>1. Pelo aplicativo (recomendado)</h2>
        <ol style={LIST_STYLE}>
          <li>Entre na sua conta.</li>
          <li>
            Abra <strong>Perfil</strong> e desça até <strong>Meus dados</strong>.
          </li>
          <li>
            Toque em <strong>Excluir minha conta</strong>.
          </li>
          <li>
            Confirme digitando <strong>EXCLUIR</strong> e sua senha.
          </li>
        </ol>
        <p style={P_STYLE}>
          Antes de excluir, você pode usar <strong>Exportar meus dados</strong> na mesma tela para
          baixar uma cópia de tudo o que guardamos sobre você.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>2. Por solicitação direta</h2>
        <p style={P_STYLE}>
          Se você não consegue acessar sua conta, escreva para{" "}
          <a href="mailto:s2core.contato@gmail.com">s2core.contato@gmail.com</a> a partir do e-mail
          cadastrado, com o assunto <strong>Exclusão de conta</strong>. Confirmamos sua identidade e
          concluímos a exclusão em até <strong>15 dias</strong>.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>3. O que é apagado</h2>
        <p style={P_STYLE}>Ao excluir a conta, removemos de forma permanente:</p>
        <ul style={LIST_STYLE}>
          <li>Seu cadastro: nome, e-mail, telefone, CPF, data de nascimento e foto de perfil.</li>
          <li>
            Seus dados de saúde: treinos e execução, check-ins diários, sono, medidas corporais,
            metabolismo, perfil clínico-nutricional e planos alimentares.
          </li>
          <li>Suas fotos de progresso e de refeições, inclusive os arquivos no armazenamento.</li>
          <li>Suas mensagens com profissionais e seus registros de atividade e localização.</li>
          <li>Seus vínculos com personal, nutricionista ou academia, e os consentimentos dados.</li>
        </ul>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>4. O que é mantido, e por quê</h2>
        <ul style={LIST_STYLE}>
          <li>
            <strong>Registros de pagamento</strong> (valor, data, status) são{" "}
            <strong>anonimizados</strong>: deixam de estar ligados a você, mas os números permanecem
            pelo prazo legal fiscal, como exige a legislação brasileira.
          </li>
          <li>
            <strong>Um registro da própria exclusão</strong>, sem identificar você (guardamos apenas
            um código derivado do seu e-mail), para comprovarmos que o pedido foi cumprido.
          </li>
          <li>
            <strong>Trilhas de acesso de outros titulares:</strong> se você era um profissional, os
            registros de que dados de OUTRA pessoa foram acessados continuam existindo, sem seu
            nome. Apagá-los destruiria a prova de acesso aos dados de quem não pediu exclusão.
          </li>
        </ul>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>5. Prazo</h2>
        <p style={P_STYLE}>
          A exclusão pelo app é <strong>imediata</strong>. Cópias em backups de segurança são
          sobrescritas no ciclo normal de retenção, em até <strong>30 dias</strong>.
        </p>
      </section>

      <p style={P_STYLE}>
        Dúvidas sobre privacidade? Fale com nosso Encarregado (DPO):{" "}
        <a href="mailto:s2core.contato@gmail.com">s2core.contato@gmail.com</a>. Veja também a{" "}
        <Link to="/privacidade">Política de Privacidade</Link>.
      </p>
    </main>
  );
}
