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
 * Exclui a conta do próprio usuário. `confirmation` deve ser "EXCLUIR";
 * `password` só é exigida para quem tem senha local (email). Lança com
 * message = error do backend ('invalid_password', 'confirmation_required'…).
 */
export async function deleteMyAccount(input: { confirmation: string; password?: string }): Promise<void> {
  const res = await authFetch(`${API_URL}/user/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const payload = await parseJson(res);
    throw new Error(payload?.error || "delete_failed");
  }
}
