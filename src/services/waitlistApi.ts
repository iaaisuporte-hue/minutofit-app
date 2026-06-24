import { API_URL, parseJson } from "./apiBase";

/**
 * Inscreve um e-mail na waitlist B2C (endpoint público, sem auth).
 * Resposta é idempotente: reinscrição do mesmo e-mail também resolve com sucesso.
 */
export async function submitWaitlistEmail(
  email: string,
  opts?: { source?: string; referral?: string; interest?: string },
): Promise<void> {
  const response = await fetch(`${API_URL}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      source: opts?.source ?? "landing",
      referral: opts?.referral,
      interest: opts?.interest,
    }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    const err = data?.error;
    if (err === "invalid_email") throw new Error("E-mail inválido. Confira e tente de novo.");
    if (err === "too_many_requests") throw new Error("Muitas tentativas. Aguarde alguns minutos.");
    throw new Error("Não foi possível inscrever agora. Tente novamente em instantes.");
  }
}
