import type { ReactNode } from "react";
import { useAuth } from "../../auth/AuthContext";

/** Canal publicado na página de contato do site (s2core.com.br/contato). */
const SUPORTE_EMAIL = "s2core.contato@gmail.com";

/**
 * Explicação exibida no lugar do formulário de exclusão quando o titular é
 * DONO de academia — `undefined` para todos os outros.
 *
 * Por quê: `academies.owner_user_id` vira NULL na exclusão e a academia fica sem
 * responsável, com o Pro seguindo na cobrança do cartão de quem saiu e sem rota
 * para cancelar. Até a Spec 040 colocar a trava no servidor (fonte de verdade:
 * `owner_user_id`, inclusive de academia inativa), o app inicia o pedido e o
 * atendimento conclui com a transferência de posse.
 *
 * Usado em TODA tela que tem a seção de exclusão (aluno, profissional,
 * academia): o dono costuma ser também aluno ou personal, e bloquear só numa
 * página deixaria a outra porta aberta. Dois sinais, porque o caminho de login
 * OAuth não carrega `academies` — o perfil de acesso cobre esse caso.
 *
 * É mitigação de UI. A garantia é do servidor (Spec 040).
 */
export function useOwnerDeletionBlock(): ReactNode | undefined {
  const auth = useAuth();
  const comoDono = (auth.academies ?? []).filter((a) => a.roleSlug === "academy_owner");
  const perfilDono = auth.accessProfile === "academy_owner";

  if (comoDono.length === 0 && !perfilDono) return undefined;

  const nomes = comoDono.map((a) => a.displayName).join(", ");
  return (
    <>
      Você é responsável por {nomes ? <strong>{nomes}</strong> : "uma academia"}. Antes de excluir a
      sua conta, a academia precisa de outro responsável — senão ela fica sem ninguém para gerir a
      equipe e a assinatura. Peça a exclusão pelo{" "}
      <a href={`mailto:${SUPORTE_EMAIL}?subject=${encodeURIComponent("Exclusão de conta — responsável pela academia")}`}>
        {SUPORTE_EMAIL}
      </a>
      : nós cuidamos da transferência e excluímos a sua conta.
    </>
  );
}
