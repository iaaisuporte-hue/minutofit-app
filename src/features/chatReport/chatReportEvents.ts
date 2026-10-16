import { authFetch } from "../../services/apiClient";
import { API_URL } from "../../services/apiBase";

/**
 * Denúncia de conversa — requisito de compliance (guideline 1.2 das lojas:
 * app com mensagem entre pessoas precisa de um caminho de report).
 *
 * Reaproveita o canal `POST /user/events` (allow-list no backend →
 * `data_access_audit`), o mesmo do resto do app: nenhuma tabela nova, nenhum
 * schema novo. A denúncia fica registrada e auditável, e a equipe revisa pelo
 * canal de suporte já em operação.
 *
 * Diferente dos outros eventos do app, este NÃO é fire-and-forget: o usuário
 * recebe uma confirmação, então precisamos saber se de fato registrou.
 */
export const CHAT_REPORT_EVENT = "chat.conversation_reported" as const;

/** Motivo é texto livre e opcional; cortado para não inflar o payload. */
export const CHAT_REPORT_REASON_MAX = 500;

export async function reportConversation(
  conversationId: string,
  reason?: string,
): Promise<void> {
  const motivo = (reason ?? "").trim().slice(0, CHAT_REPORT_REASON_MAX);

  const response = await authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: CHAT_REPORT_EVENT,
      payload: { conversationId, ...(motivo ? { reason: motivo } : {}) },
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível registrar a denúncia. Tente de novo.");
  }
}
