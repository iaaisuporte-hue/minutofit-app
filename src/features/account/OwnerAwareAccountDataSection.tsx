import { AccountDataSection } from "./AccountDataSection";
import { useOwnerDeletionBlock } from "./useOwnerDeletionBlock";

/**
 * `AccountDataSection` para os perfis de aluno e profissional, com a mesma
 * trava de dono de academia da tela "Minha conta" da academia — o dono costuma
 * ter também conta de aluno ou personal, e a trava numa porta só deixaria a
 * outra aberta. Para quem não é dono, idêntico ao componente de sempre.
 */
export function OwnerAwareAccountDataSection({ onDeleted }: { onDeleted: () => void }) {
  return <AccountDataSection onDeleted={onDeleted} deletionBlocked={useOwnerDeletionBlock()} />;
}
