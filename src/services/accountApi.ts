import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

/** Baixa todos os dados do usuário (LGPD) como arquivo JSON. */
export async function exportMyData(): Promise<void> {
  const res = await authFetch(`${API_URL}/user/account/export`);
  const payload = await parseJson(res);
  if (!res.ok) throw new Error(payload?.error || "export_failed");

  const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "s2core-meus-dados.json";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Desfecho do pedido de exclusão (Spec 040).
 *
 * `completed`: a conta foi excluída. `pending_cancellation` / `stalled`: o titular tem cobrança
 * recorrente que o gateway ainda não confirmou cancelada — a conta foi MANTIDA, o encerramento
 * continua sozinho (até 24h) ou, se parou, com a nossa equipe. Nada foi apagado ainda.
 */
export type DeleteAccountOutcome =
  | { status: "completed" }
  | { status: "pending_cancellation" | "stalled"; message: string; subscriptionsPending: number };

/**
 * A exclusão foi barrada por uma regra do servidor (409): dono de academia sem sucessor, academia
 * com cobrança em andamento, ou contratos ativos com alunos. `message` já vem pronta para a tela.
 */
export class AccountDeletionBlockedError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AccountDeletionBlockedError";
    this.code = code;
  }
}

/**
 * Exclui a conta do próprio usuário. `confirmation` deve ser "EXCLUIR";
 * `password` só é exigida para quem tem senha local (email). Lança com
 * message = error do backend ('invalid_password', 'confirmation_required'…) ou
 * `AccountDeletionBlockedError` quando uma regra do servidor impede.
 */
export async function deleteMyAccount(input: { confirmation: string; password?: string }): Promise<DeleteAccountOutcome> {
  const res = await authFetch(`${API_URL}/user/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    // `acceptsPending`: este cliente sabe mostrar "encerrando a cobrança, conta mantida". Os apps antigos não
    // enviam, e por isso o servidor responde 409 a eles (um 2xx os faria sair achando que a conta foi excluída).
    body: JSON.stringify({ ...input, acceptsPending: true }),
  });
  if (res.status === 202) {
    const payload = await parseJson(res);
    return {
      status: payload?.status === "stalled" ? "stalled" : "pending_cancellation",
      message: String(payload?.message ?? "Estamos encerrando a sua cobrança recorrente. A conta será excluída em seguida."),
      subscriptionsPending: Number(payload?.subscriptionsPending ?? 0),
    };
  }
  if (!res.ok) {
    const payload = await parseJson(res);
    // Defesa: um servidor que responda `deletion_pending` em 409 continua sendo "pendente", não erro.
    if (res.status === 409 && payload?.code === "deletion_pending") {
      return {
        status: payload?.status === "stalled" ? "stalled" : "pending_cancellation",
        message: String(payload?.message ?? "Estamos encerrando a sua cobrança recorrente. A conta será excluída em seguida."),
        subscriptionsPending: Number(payload?.subscriptionsPending ?? 0),
      };
    }
    if (res.status === 409 && payload?.code) {
      throw new AccountDeletionBlockedError(String(payload.code), String(payload.message ?? payload.error));
    }
    throw new Error(payload?.error || "delete_failed");
  }
  return { status: "completed" };
}
