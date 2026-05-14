import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type DirectInvite = {
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

export type DirectInviteInfo = {
  personalName: string;
  invitedName: string | null;
  invitedEmail: string | null;
  status: string;
  expired: boolean;
};

export async function createDirectInvite(opts: {
  invitedEmail?: string;
  invitedName?: string;
}): Promise<DirectInvite> {
  const response = await authFetch(`${API_URL}/personal/direct-invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitedEmail: opts.invitedEmail || null, invitedName: opts.invitedName || null }),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível criar o convite.");
  return data.data as DirectInvite;
}

export async function listDirectInvites(): Promise<DirectInvite[]> {
  const response = await authFetch(`${API_URL}/personal/direct-invites`);
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível listar convites.");
  return data.data as DirectInvite[];
}

export async function revokeDirectInvite(id: number): Promise<void> {
  const response = await authFetch(`${API_URL}/personal/direct-invites/${id}`, {
    method: "DELETE",
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível revogar o convite.");
}

export async function fetchDirectInviteInfo(token: string): Promise<DirectInviteInfo> {
  const response = await fetch(`${API_URL}/auth/direct-invite/${token}`);
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Convite não encontrado.");
  return data.data as DirectInviteInfo;
}

export async function acceptDirectInvite(
  token: string,
  payload: {
    email: string;
    password: string;
    name: string;
    cpf: string;
    phone: string;
    healthFlags?: Record<string, boolean>;
  }
): Promise<{ accessToken: string; refreshToken: string; user: unknown }> {
  const response = await fetch(`${API_URL}/auth/direct-invite/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.error || "Não foi possível aceitar o convite.");
  return data.data;
}
