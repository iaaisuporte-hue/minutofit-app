import { useState } from "react";
import { openWhatsappCompose } from "../../pages/personal/lib/whatsappLink";
import { sendBillingReminder } from "../../services/academyApi";

/**
 * Régua de cobrança observável (feature Pro). Abre o WhatsApp com mensagem
 * pré-preenchida (envio SEMPRE manual — wa.me deep link, nunca automação) e
 * registra o touchpoint no audit. Anti-spam permanente: só por ação explícita.
 */
export function BillingReminderButton({
  userId,
  name,
  phone,
  onLogged,
}: {
  userId: number;
  name: string;
  phone?: string | null;
  onLogged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = (name || "").trim().split(" ")[0] || "tudo bem";
  const message =
    `Olá ${firstName}, tudo bem? Passando para falar sobre a sua mensalidade. ` +
    `Qualquer dúvida, estou à disposição!`;

  async function handleClick() {
    setError(null);
    if (!phone) {
      setError("Aluno sem telefone cadastrado.");
      return;
    }
    setBusy(true);
    try {
      // Registra o touchpoint primeiro (valida Pro no backend); depois abre o wa.me.
      await sendBillingReminder(userId);
      const opened = openWhatsappCompose(phone, message);
      if (!opened) setError("Telefone inválido para WhatsApp.");
      else onLogged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar a cobrança.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-sm btn-secondary" onClick={handleClick} disabled={busy}>
        {busy ? "Abrindo…" : "Cobrar via WhatsApp"}
      </button>
      {error && <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-danger)" }}>{error}</div>}
    </div>
  );
}
