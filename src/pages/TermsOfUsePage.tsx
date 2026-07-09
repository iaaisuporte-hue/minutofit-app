import { Link } from "react-router-dom";

/**
 * Termos de Uso — S2Core.
 *
 * Documento estruturado para o cadastro (checkbox de aceite em /register linka
 * para cá). O conteúdo cobre os pontos jurídicos essenciais levantados na análise
 * pré-Go-Live: a plataforma fornece TECNOLOGIA de acompanhamento (não serviços de
 * educação física/nutrição), profissionais são independentes e respondem por suas
 * prescrições, e conteúdo automático é sugestão de bem-estar — não prescrição nem
 * diagnóstico. Texto sujeito a revisão jurídica antes do lançamento público.
 */
const SECTION_STYLE: React.CSSProperties = { display: "grid", gap: 12, marginBottom: 20 };
const H2_STYLE: React.CSSProperties = { fontSize: 16, margin: 0 };
const P_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: "var(--color-text-muted)",
};

export default function TermsOfUsePage() {
  return (
    <main className="auth-page" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h1 className="auth-title" style={{ textAlign: "left" }}>
        Termos de Uso
      </h1>
      <p className="auth-subtitle" style={{ textAlign: "left", marginBottom: 24 }}>
        S2Core — condições de uso da plataforma. Ao criar uma conta você concorda com estes termos.
      </p>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>1. O que a S2Core é</h2>
        <p style={P_STYLE}>
          A S2Core é uma <strong>plataforma de tecnologia</strong> de acompanhamento metabólico e organização de
          rotina de saúde, treino e alimentação. Fornecemos software, organização de dados, comunicação e insights
          — <strong>não prestamos serviços de educação física, nutrição, medicina ou diagnóstico clínico</strong>.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>2. Conteúdo automático é sugestão, não prescrição</h2>
        <p style={P_STYLE}>
          Sugestões de treino, interpretações metabólicas e lembretes gerados automaticamente pela plataforma são
          <strong> apoio ao bem-estar</strong>, baseados nas informações que você fornece. Eles{" "}
          <strong>não substituem avaliação médica, prescrição de profissional habilitado nem diagnóstico</strong>.
          Antes de iniciar ou intensificar atividade física, consulte um profissional de saúde. Se sentir dor,
          mal-estar ou sintoma incomum, interrompa e procure atendimento.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>3. Profissionais são independentes</h2>
        <p style={P_STYLE}>
          Personal trainers e nutricionistas que usam a plataforma para acompanhar você são{" "}
          <strong>profissionais independentes</strong>, responsáveis técnica e legalmente pelas orientações,
          fichas e planos que prescrevem, dentro das competências dos respectivos conselhos (CREF/CRN). A S2Core
          não é empregadora, clínica, academia nem responsável direta pelo serviço profissional prestado — oferece
          a tecnologia que organiza esse acompanhamento.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>4. Suas informações de saúde</h2>
        <p style={P_STYLE}>
          Você declara que as informações de saúde, triagem e PAR-Q informadas são verdadeiras. Esses dados são
          tratados conforme a{" "}
          <Link to="/privacidade">Política de Privacidade</Link> e a Lei Geral de Proteção de Dados (Lei nº
          13.709/2018). Você decide quais profissionais têm acesso a quais dados e pode revogar esse acesso a
          qualquer momento em <strong>Perfil → Minha Equipe</strong>.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>5. Uso adequado e conta</h2>
        <p style={P_STYLE}>
          Você é responsável por manter a confidencialidade das suas credenciais e pelo uso da sua conta. É vedado
          usar a plataforma para fins ilícitos, inserir dados de terceiros sem autorização ou tentar burlar
          controles de segurança e de acesso.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>6. Planos, cobrança e cancelamento</h2>
        <p style={P_STYLE}>
          Recursos pagos são descritos no momento da contratação. Você pode gerenciar ou cancelar sua assinatura e
          excluir sua conta pela própria plataforma (Perfil → Seus dados e conta). Registros financeiros podem ser
          retidos de forma anonimizada por obrigação legal/fiscal após a exclusão da conta.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>7. Limitação de responsabilidade</h2>
        <p style={P_STYLE}>
          A S2Core empenha-se para manter o serviço disponível e seguro, mas não garante resultados de saúde,
          performance ou composição corporal — estes dependem de fatores individuais e da condução de profissionais
          habilitados. Na máxima extensão permitida em lei, a responsabilidade da S2Core limita-se ao fornecimento
          da tecnologia.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>8. Alterações destes termos</h2>
        <p style={P_STYLE}>
          Podemos atualizar estes termos. Mudanças relevantes serão comunicadas e, quando exigido, um novo aceite
          será solicitado. A data de vigência acompanha a versão registrada no seu aceite.
        </p>
      </section>

      <div className="auth-links" style={{ justifyContent: "flex-start" }}>
        <Link to="/login">Voltar ao login</Link>
        <Link to="/privacidade">Política de Privacidade</Link>
      </div>
    </main>
  );
}
