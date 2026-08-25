/**
 * Lembrete de cobrança pelo WhatsApp.
 *
 * Anti-spam permanente: só deep link `wa.me`, aberto por toque explícito do
 * personal, com a mensagem pré-preenchida e editável no próprio WhatsApp antes
 * do envio. Nada de Cloud API, disparo em massa ou automação.
 */
import { openWhatsappCompose } from "../../pages/personal/lib/whatsappLink";
import { createRelationshipAction } from "../../services/personalRetentionApi";
import { formatCents, formatIsoDay, type FinanceCharge } from "../../services/personalFinanceApi";

export function buildFinanceReminder(
  studentName: string | null,
  charge: FinanceCharge | null,
): string {
  const firstName = (studentName || "").trim().split(" ")[0];
  const saudacao = firstName ? `Oi ${firstName}!` : "Oi!";
  if (!charge) {
    return `${saudacao} Tudo bem? Podemos alinhar a mensalidade? Qualquer dúvida, é só me chamar.`;
  }

  const valor = formatCents(charge.amountCents - charge.paidCents);
  const data = formatIsoDay(charge.dueDate);
  const quando =
    charge.derivedStatus === "overdue"
      ? `venceu em ${data}`
      : `vence em ${data}`;

  return (
    `${saudacao} Tudo bem? Passando para lembrar da mensalidade de ${valor}, que ${quando}. ` +
    `Qualquer dúvida, é só me chamar!`
  );
}

/**
 * Abre o WhatsApp e registra o toque na timeline do aluno.
 *
 * O `window.open` vem primeiro de propósito: depois de um `await` o navegador
 * já não trata a chamada como gesto do usuário e bloqueia a aba. O registro é
 * best-effort — falhar em anotar não pode impedir o personal de cobrar.
 */
export function sendFinanceReminder(input: {
  studentId: number;
  studentName: string | null;
  studentPhone: string | null;
  charge: FinanceCharge | null;
  message?: string;
}): boolean {
  const message = input.message ?? buildFinanceReminder(input.studentName, input.charge);
  const opened = openWhatsappCompose(input.studentPhone, message);
  if (!opened) return false;

  createRelationshipAction(String(input.studentId), {
    actionType: "payment_reminder_sent",
    payloadJson: {
      channel: "whatsapp",
      chargeId: input.charge?.id ?? null,
      dueDate: input.charge?.dueDate ?? null,
    },
    source: "finance",
  }).catch(() => undefined);

  return true;
}
