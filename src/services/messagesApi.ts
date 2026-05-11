import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type ChatSenderRole = "user" | "personal" | "admin" | "nutri";

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: ChatSenderRole;
  text: string;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  personalId: string;
  personalName: string;
  personalEmail: string;
  createdAt: string;
  updatedAt: string;
  lastReadAtByStudent: string | null;
  lastReadAtByPersonal: string | null;
  unreadCount: number;
  lastMessage: {
    id: string;
    senderId: string;
    senderRole: ChatSenderRole;
    text: string;
    createdAt: string;
  } | null;
};

async function unwrapResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || fallbackMessage);
  }
  return (payload?.data ?? null) as T;
}

export async function fetchChatConversations(): Promise<ChatConversation[]> {
  const response = await authFetch(`${API_URL}/messages/conversations`);
  return unwrapResponse<ChatConversation[]>(response, "Nao foi possivel carregar as conversas.");
}

export async function ensureChatConversation(input: {
  studentId?: string | null;
  personalId?: string | null;
} = {}): Promise<ChatConversation | null> {
  const response = await authFetch(`${API_URL}/messages/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: input.studentId ?? null,
      personalId: input.personalId ?? null,
    }),
  });

  return unwrapResponse<ChatConversation | null>(response, "Nao foi possivel abrir a conversa.");
}

export async function fetchConversationMessages(conversationId: string, limit = 200): Promise<ChatMessage[]> {
  const response = await authFetch(`${API_URL}/messages/conversations/${conversationId}/messages?limit=${limit}`);
  return unwrapResponse<ChatMessage[]>(response, "Nao foi possivel carregar as mensagens.");
}

export async function sendChatMessage(conversationId: string, text: string): Promise<ChatMessage> {
  const response = await authFetch(`${API_URL}/messages/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  return unwrapResponse<ChatMessage>(response, "Nao foi possivel enviar a mensagem.");
}

export async function markChatConversationRead(conversationId: string): Promise<void> {
  const response = await authFetch(`${API_URL}/messages/conversations/${conversationId}/read`, {
    method: "POST",
  });

  await unwrapResponse<null>(response, "Nao foi possivel marcar a conversa como lida.");
}

export type EligibleStudent = {
  id: string;
  name: string;
  email: string;
  hasConversation: boolean;
  hasMessages: boolean;
};

export async function fetchEligibleStudents(): Promise<EligibleStudent[]> {
  const response = await authFetch(`${API_URL}/messages/eligible-students`);
  return unwrapResponse<EligibleStudent[]>(response, "Nao foi possivel listar alunos para iniciar conversa.");
}

