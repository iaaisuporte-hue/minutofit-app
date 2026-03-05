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

const CONVERSATIONS_KEY = "treinai_chat_conversations_v1";
const MESSAGES_KEY_PREFIX = "treinai_chat_messages_v1__";

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
function canAccessConversation(conv: ChatConversation, viewerId: string, viewerRole: Role) {
  if (viewerRole === "personal") return conv.personalId === viewerId;
  if (viewerRole === "user") return conv.studentId === viewerId;
  return false;
}

/**
 * ✅ IMPORTANTE:
 * Aqui você define qual personal atende este aluno no MVP.
 * No backend isso vira: "student.personalId" vindo do banco.
 */
const DEFAULT_PERSONAL_ID = "personal@treinai.com";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 16,
        background: "#171717",
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
      }}
    >
      {children}
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuth() as any;
  const myId: string = user?.email || "basic@treinai.com";
  const myRole: Role = user?.role || "user";

  if (myRole !== "user") {
    return (
      <Card>
        <div style={{ padding: 16, color: "#fff" }}>
          <div style={{ fontWeight: 1000 }}>Acesso negado</div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,.70)", fontSize: 13 }}>Área exclusiva do aluno.</div>
        </div>
      </Card>
    );
  }

  const conversationId = useMemo(() => conversationIdOf(myId, DEFAULT_PERSONAL_ID), [myId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  // ✅ garante conversa existe
  useEffect(() => {
    const all = readConversations();
    let conv = all.find((c) => c.id === conversationId);

    if (!conv) {
      conv = {
        id: conversationId,
        studentId: myId,
        personalId: DEFAULT_PERSONAL_ID,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        lastReadAtByStudent: nowISO(),
      };
      all.push(conv);
      writeConversations(all);
    }

    // segurança UI
    if (!canAccessConversation(conv, myId, myRole)) return;

    setMessages(readMessages(conversationId));
  }, [conversationId, myId, myRole]);

  // ✅ “Realtime” MVP
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === MESSAGES_KEY_PREFIX + conversationId) {
        setMessages(readMessages(conversationId));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function sendMessage() {
    const body = text.trim();
    if (!body) return;

    const conv = readConversations().find((c) => c.id === conversationId);
    if (!conv) return;
    if (!canAccessConversation(conv, myId, myRole)) return;

    const list = readMessages(conversationId);

    const msg: ChatMessage = {
      id: uid("msg"),
      conversationId,
      senderId: myId,
      senderRole: "user",
      text: body,
      createdAt: nowISO(),
    };

    const next = [...list, msg];
    writeMessages(conversationId, next);
    setMessages(next);
    setText("");

    const all = readConversations().map((c) => {
      if (c.id !== conversationId) return c;
      return { ...c, updatedAt: nowISO(), lastReadAtByStudent: nowISO() };
    });
    writeConversations(all);
  }

  return (
    <div style={{ display: "grid", gap: 12, color: "#fff" }}>
      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Fale com seu personal</div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,.70)", fontSize: 13 }}>
            Chat privado • respostas rápidas • sem enrolação 💪
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 520 }}>
          <div style={{ padding: 14, overflow: "auto" }}>
            {messages.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>Envie a primeira mensagem 👇</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {messages.map((m) => {
                  const mine = m.senderRole === "user";
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                      <div
                        style={{
                          maxWidth: 520,
                          padding: "10px 12px",
                          borderRadius: 14,
                          border: mine ? "1px solid rgba(255,106,0,.35)" : "1px solid rgba(255,255,255,.10)",
                          background: mine ? "rgba(255,106,0,.14)" : "rgba(255,255,255,.05)",
                          boxShadow: "0 10px 24px rgba(0,0,0,.25)",
                        }}
                      >
                        <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.text}</div>
                        <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,.55)" }}>
                          {new Date(m.createdAt).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,.10)", display: "flex", gap: 10 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite sua mensagem…"
              rows={2}
              style={{
                flex: 1,
                resize: "none",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.12)",
                background: "#121212",
                color: "#FFFFFF",
                outline: "none",
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            />

            <button
              onClick={sendMessage}
              disabled={!text.trim()}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,106,0,.35)",
                background: "#FF6A00",
                color: "#0F0F0F",
                cursor: !text.trim() ? "not-allowed" : "pointer",
                fontWeight: 1000,
                fontSize: 14,
                boxShadow: "0 10px 24px rgba(0,0,0,.35)",
                opacity: !text.trim() ? 0.6 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}