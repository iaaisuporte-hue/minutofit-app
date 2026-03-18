import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Role = "user" | "personal" | "admin" | "nutri";

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: Role;
  text: string;
  createdAt: string;
};

type ChatConversation = {
  id: string;
  studentId: string;
  personalId: string;
  createdAt: string;
  updatedAt: string;
  lastReadAtByStudent?: string;
  lastReadAtByPersonal?: string;
};

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  mutedSoft: "rgba(232,236,233,.58)",
  highlightSoft: "rgba(124,255,107,.12)",
  primarySoft: "rgba(29,185,84,.18)",
};

const CONVERSATIONS_KEY = "treinai_chat_conversations_v1";
const MESSAGES_KEY_PREFIX = "treinai_chat_messages_v1__";
const DEFAULT_PERSONAL_ID = "personal@treinai.com";

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function nowISO() {
  return new Date().toISOString();
}

function uid(prefix = "m") {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function conversationIdOf(studentId: string, personalId: string) {
  return `c_${encodeURIComponent(studentId)}__${encodeURIComponent(personalId)}`;
}

function readConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    return raw ? (JSON.parse(raw) as ChatConversation[]) : [];
  } catch {
    return [];
  }
}

function writeConversations(list: ChatConversation[]) {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
}

function readMessages(conversationId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY_PREFIX + conversationId);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function writeMessages(conversationId: string, list: ChatMessage[]) {
  localStorage.setItem(MESSAGES_KEY_PREFIX + conversationId, JSON.stringify(list));
}

function getDisplayNameFromEmail(email: string) {
  if (email === DEFAULT_PERSONAL_ID) {
    return "Seu personal";
  }
  const head = email.split("@")[0] || "Contato";
  return head
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ensureStudentConversation(studentId: string, studentName?: string) {
  const conversationId = conversationIdOf(studentId, DEFAULT_PERSONAL_ID);
  const conversations = readConversations();
  const existing = conversations.find((conversation) => conversation.id === conversationId);

  if (!existing) {
    const createdAt = nowISO();
    const nextConversation: ChatConversation = {
      id: conversationId,
      studentId,
      personalId: DEFAULT_PERSONAL_ID,
      createdAt,
      updatedAt: createdAt,
    };
    writeConversations([nextConversation, ...conversations]);

    const starterMessages: ChatMessage[] = [
      {
        id: uid("m"),
        conversationId,
        senderId: DEFAULT_PERSONAL_ID,
        senderRole: "personal",
        text: `Olá${studentName ? `, ${studentName.split(" ")[0]}` : ""}. Este espaço serve para alinhar treinos, dúvidas e ajustes rápidos do seu plano.`,
        createdAt,
      },
    ];
    writeMessages(conversationId, starterMessages);
    return nextConversation;
  }

  return existing;
}

function countUnreadForStudent(conversation: ChatConversation, messages: ChatMessage[]) {
  const lastRead = conversation.lastReadAtByStudent
    ? new Date(conversation.lastReadAtByStudent).getTime()
    : 0;
  return messages.filter((message) => {
    const createdAt = new Date(message.createdAt).getTime();
    return createdAt > lastRead && message.senderRole === "personal";
  }).length;
}

function formatTimeLabel(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserMessagesPage() {
  const { user } = useAuth() as any;
  const myId: string = user?.email || "teste1@treinai.com";
  const myRole: Role = user?.role || "user";
  const myName: string = user?.name || "Aluno";

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId]
  );

  useEffect(() => {
    if (myRole !== "user") {
      return;
    }

    const ensured = ensureStudentConversation(myId, myName);
    const list = readConversations()
      .filter((conversation) => conversation.studentId === myId)
      .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());
    setConversations(list);
    setSelectedId(ensured.id);
  }, [myId, myName, myRole]);

  useEffect(() => {
    if (!selectedId || myRole !== "user") {
      setMessages([]);
      return;
    }

    const nextMessages = readMessages(selectedId);
    setMessages(nextMessages);

    const updatedConversations = readConversations().map((conversation) => {
      if (conversation.id !== selectedId) {
        return conversation;
      }
      return {
        ...conversation,
        lastReadAtByStudent: nowISO(),
      };
    });
    writeConversations(updatedConversations);
    setConversations(
      updatedConversations
        .filter((conversation) => conversation.studentId === myId)
        .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
    );
  }, [myId, myRole, selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (myRole !== "user") {
    return (
      <Card style={{ padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 1000, color: COLORS.text }}>Acesso indisponível</div>
        <div style={{ marginTop: 8, color: COLORS.muted }}>
          Essa área será controlada por perfil de acesso. Quando você quiser, eu te ajudo a amarrar isso por role de ponta a ponta.
        </div>
      </Card>
    );
  }

  function refreshConversationState(conversationId: string) {
    const nextConversations = readConversations()
      .filter((conversation) => conversation.studentId === myId)
      .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());
    setConversations(nextConversations);
    setSelectedId(conversationId);
    setMessages(readMessages(conversationId));
  }

  function handleSendMessage() {
    if (!selectedConversation || !text.trim()) {
      return;
    }

    const cleanText = text.trim();
    const nextMessage: ChatMessage = {
      id: uid("m"),
      conversationId: selectedConversation.id,
      senderId: myId,
      senderRole: "user",
      text: cleanText,
      createdAt: nowISO(),
    };

    const existingMessages = readMessages(selectedConversation.id);
    writeMessages(selectedConversation.id, [...existingMessages, nextMessage]);

    const updatedConversations = readConversations().map((conversation) => {
      if (conversation.id !== selectedConversation.id) {
        return conversation;
      }
      return {
        ...conversation,
        updatedAt: nextMessage.createdAt,
        lastReadAtByStudent: nextMessage.createdAt,
      };
    });
    writeConversations(updatedConversations);
    setText("");
    refreshConversationState(selectedConversation.id);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card
        style={{
          background: COLORS.panelDeep,
          borderColor: COLORS.borderStrong,
          padding: 20,
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              background: COLORS.highlightSoft,
              color: "#7CFF6B",
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Mensagens
          </div>
          <div style={{ fontSize: 30, fontWeight: 1000, color: COLORS.text }}>
            Canal direto com seu personal.
          </div>
          <div style={{ color: COLORS.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 780 }}>
            Use esse espaço para tirar dúvidas rápidas, avisar sobre dores, pedir ajustes no treino ou combinar próximos passos do seu plano.
          </div>
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
          gap: 16,
        }}
      >
        <Card style={{ padding: 14, display: "grid", gap: 12, alignSelf: "start" }}>
          <div style={{ fontWeight: 1000, color: COLORS.text, fontSize: 16 }}>Conversas</div>
          {conversations.map((conversation) => {
            const conversationMessages = readMessages(conversation.id);
            const unread = countUnreadForStudent(conversation, conversationMessages);
            const lastMessage = conversationMessages[conversationMessages.length - 1];
            const active = conversation.id === selectedId;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 16,
                  border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                  background: active ? COLORS.primarySoft : "rgba(255,255,255,.03)",
                  color: COLORS.text,
                  cursor: "pointer",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>{getDisplayNameFromEmail(conversation.personalId)}</div>
                  {unread ? (
                    <span
                      style={{
                        borderRadius: 999,
                        background: COLORS.highlightSoft,
                        color: "#7CFF6B",
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      {unread} nova{unread > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                  {lastMessage?.text || "Conversa pronta para você começar."}
                </div>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>
                  {lastMessage ? formatTimeLabel(lastMessage.createdAt) : "Agora mesmo"}
                </div>
              </button>
            );
          })}
        </Card>

        <Card style={{ display: "grid", gridTemplateRows: "auto minmax(360px, 1fr) auto" }}>
          <div
            style={{
              padding: 18,
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 1000, color: COLORS.text }}>
                {selectedConversation ? getDisplayNameFromEmail(selectedConversation.personalId) : "Seu personal"}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>
                Respostas rápidas, avisos de treino e alinhamentos do seu acompanhamento.
              </div>
            </div>
            <div
              style={{
                borderRadius: 999,
                background: "rgba(29,185,84,.12)",
                border: `1px solid ${COLORS.borderStrong}`,
                padding: "8px 12px",
                color: COLORS.text,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              Canal ativo
            </div>
          </div>

          <div
            style={{
              padding: 18,
              display: "grid",
              gap: 14,
              background: "linear-gradient(180deg, rgba(17,19,18,.9), rgba(13,15,14,.96))",
              minHeight: 420,
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  margin: "auto",
                  maxWidth: 420,
                  textAlign: "center",
                  color: COLORS.muted,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 30 }}>💬</div>
                <div style={{ fontWeight: 1000, color: COLORS.text }}>Ainda não há mensagens nessa conversa.</div>
                <div style={{ fontSize: 14 }}>
                  Você pode começar pedindo ajuste no treino, avisando como se sentiu na sessão de hoje ou relatando qualquer desconforto.
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const mine = message.senderRole === "user";
                return (
                  <div
                    key={message.id}
                    style={{
                      display: "flex",
                      justifyContent: mine ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "78%",
                        borderRadius: 18,
                        padding: "12px 14px",
                        border: mine ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                        background: mine
                          ? "linear-gradient(135deg, rgba(15,61,46,.9), rgba(24,34,28,.96))"
                          : "rgba(255,255,255,.05)",
                        color: COLORS.text,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>{message.text}</div>
                      <div style={{ fontSize: 11, color: COLORS.mutedSoft }}>
                        {mine ? "Você" : "Personal"} • {formatTimeLabel(message.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <div
            style={{
              padding: 18,
              borderTop: `1px solid ${COLORS.border}`,
              display: "grid",
              gap: 10,
            }}
          >
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Escreva sua mensagem para o personal..."
              rows={4}
              style={{
                width: "100%",
                resize: "vertical",
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.04)",
                color: COLORS.text,
                padding: 14,
                fontSize: 14,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>
                Prefira mensagens curtas e objetivas para facilitar resposta e acompanhamento.
              </div>
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!text.trim()}
                style={{
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: `1px solid ${text.trim() ? COLORS.borderStrong : COLORS.border}`,
                  background: text.trim()
                    ? "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)"
                    : "rgba(255,255,255,.05)",
                  color: text.trim() ? "#0A130D" : COLORS.muted,
                  fontWeight: 1000,
                  cursor: text.trim() ? "pointer" : "not-allowed",
                }}
              >
                Enviar mensagem
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
