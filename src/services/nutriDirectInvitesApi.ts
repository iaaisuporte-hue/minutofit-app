import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type NutriDirectInvite = {
  id: number;
  token: string;
  invitedEmail: string | null;
  invited_email: string | null;
  invitedName: string | null;
  invited_name: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  expires_at: string;
  createdAt: string;
  created_at: string;
  acceptedAt: string | null;
  accepted_at: string | null;
  acceptedUserName: string | null;
  accepted_user_name: string | null;
  inviteUrl: string;
};

export type NutriDirectInviteInfo = {
  professionalName: string;
  personalName: string;
  invitedName: string | null;
  invitedEmail: string | null;
  status: string;
  expired: boolean;
  type: "nutri";
};

export async function createNutriDirectInvite(opts: {
  invitedEmail?: string;
  invitedName?: string;
}): Promise<NutriDirectInvite> {
  const response = await authFetch(`${API_URL}/nutri/direct-invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitedEmail: opts.invitedEmail || null, invitedName: opts.invitedName || null }),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível criar o convite.");
  return data.data as NutriDirectInvite;
}

export async function listNutriDirectInvites(): Promise<NutriDirectInvite[]> {
  const response = await authFetch(`${API_URL}/nutri/direct-invites`);
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível listar convites.");
  return data.data as NutriDirectInvite[];
}

export async function revokeNutriDirectInvite(id: number): Promise<void> {
  const response = await authFetch(`${API_URL}/nutri/direct-invites/${id}`, { method: "DELETE" });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível revogar o convite.");
}

export async function fetchNutriDirectInviteInfo(token: string): Promise<NutriDirectInviteInfo> {
  const response = await fetch(`${API_URL}/auth/direct-invite/${token}?type=nutri`);
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Convite não encontrado.");
  return data.data as NutriDirectInviteInfo;
}

export async function acceptNutriDirectInvite(
  token: string,
  payload: {
    email: string;
    password: string;
    name: string;
    cpf?: string;
    phone?: string;
  }
): Promise<{ accessToken: string; refreshToken: string; user: unknown; isNew: boolean; userExists: boolean }> {
  const response = await fetch(`${API_URL}/auth/direct-invite-nutri/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    const err: Error & { userExists?: boolean; email?: string } = new Error(
      data?.error || "Não foi possível aceitar o convite."
    );
    err.userExists = data?.userExists ?? false;
    err.email = data?.email;
    throw err;
  }
  return data.data;
}
