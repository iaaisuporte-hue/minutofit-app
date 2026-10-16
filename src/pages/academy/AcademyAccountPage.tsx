import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { AccountDataSection } from "../../features/account/AccountDataSection";
import { useOwnerDeletionBlock } from "../../features/account/useOwnerDeletionBlock";

/**
 * "Minha conta" da equipe da academia (dono, gestão, financeiro, recepção,
 * personal e nutri da casa).
 *
 * Toda conta criada pelo app precisa poder ser excluída pelo app (Apple
 * 5.1.1(v), LGPD art. 18 VI) — e o staff entra pelo convite `/invite/:token`,
 * mas não tinha onde fazer isso. Reaproveita a mesma seção de aluno e
 * profissional; a exclusão é da conta PESSOAL, nunca da academia. O dono é
 * encaminhado ao atendimento (ver `useOwnerDeletionBlock`).
 */
export default function AcademyAccountPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const bloqueioDono = useOwnerDeletionBlock();

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
