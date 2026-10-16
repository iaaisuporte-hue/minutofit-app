import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { AccountDataSection } from "../../features/account/AccountDataSection";

/** Canal publicado na página de contato do site (s2core.com.br/contato). */
const SUPORTE_EMAIL = "s2core.contato@gmail.com";

/**
 * "Minha conta" da equipe da academia (dono, gestão, financeiro, recepção,
 * personal e nutri da casa).
 *
 * Toda conta criada pelo app precisa poder ser excluída pelo app (Apple
 * 5.1.1(v), LGPD art. 18 VI) — e o staff entra pelo convite `/invite/:token`,
 * mas não tinha onde fazer isso. Reaproveita a mesma seção de aluno e
 * profissional; a exclusão é da conta PESSOAL, nunca da academia.
 *
 * O dono é a exceção, por ora: `academies.owner_user_id` vira NULL na exclusão,
 * e a academia ficaria sem responsável, com o Pro seguindo na cobrança do
 * cartão de quem saiu e sem ninguém para cancelar. Até a Spec 040 decidir a
 * transferência de posse, o dono inicia o pedido pelo app e o atendimento
 * conclui — em vez de um botão que deixa a organização acéfala.
 */
export default function AcademyAccountPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const academiasComoDono = (auth.academies ?? []).filter((a) => a.roleSlug === "academy_owner");

  function aoExcluir() {
    auth.logout();
    navigate("/login", { replace: true });
  }

  const nota = (
    <>
      Isto exclui <strong>só a sua conta pessoal</strong>. A academia, a equipe e os alunos
      continuam — você apenas deixa de ter acesso.
    </>
  );

  const bloqueioDono =
    academiasComoDono.length > 0 ? (
      <>
        Você é responsável por{" "}
        <strong>{academiasComoDono.map((a) => a.displayName).join(", ")}</strong>. Antes de
        excluir a sua conta, a academia precisa de outro responsável — senão ela fica sem
        ninguém para gerir a equipe e a assinatura. Peça a exclusão pelo{" "}
        <a
          href={`mailto:${SUPORTE_EMAIL}?subject=${encodeURIComponent("Exclusão de conta — responsável pela academia")}`}
        >
          {SUPORTE_EMAIL}
        </a>
        : nós cuidamos da transferência e excluímos a sua conta.
      </>
    ) : undefined;

  return (
    <div className="page-container" style={{ maxWidth: 640, display: "grid", gap: "var(--space-4)" }}>
      <header style={{ display: "grid", gap: 4 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Minha conta</h1>
        <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
          {auth.email}
        </div>
      </header>
      <AccountDataSection onDeleted={aoExcluir} deletionNote={nota} deletionBlocked={bloqueioDono} />
    </div>
  );
}
