import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  ensureChatConversation,
  fetchChatConversations,
  fetchConversationMessages,
  markChatConversationRead,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
  type ChatSenderRole,
} from "../../services/messagesApi";

type Role = "user" | "personal" | "admin" | "nutri";

function formatTimeLabel(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPreviewTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function senderLabel(role: ChatSenderRole, fallback: string): string {
  if (role === "user") return "Você";
  if (role === "personal") return fallback;
  if (role === "nutri") return "Nutricionista";
  if (role === "admin") return "Equipe S2Core";
  return fallback;
}

function initialOf(name: string | undefined): string {
  const first = (name ?? "").trim().charAt(0).toUpperCase();
  return first || "?";
}

const cardStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 20,
  boxShadow: "var(--shadow-sm)",
};

export default function UserMessagesPage() {
  const { user } = useAuth();
  const myRole: Role = (user?.role as Role) || "user";
  const isMobile = useIsMobile(720);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Mobile: 'list' = inbox visível; 'chat' = conversa aberta com back. Desktop ignora. */
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const loadConversations = useCallback(
    async (preferredId?: string | null) => {
      setLoading(true);
      try {
        let list = await fetchChatConversations();
        if (myRole === "user" && list.length === 0) {
          await ensureChatConversation();
          list = await fetchChatConversations();
        }
        setConversations(list);
        setSelectedId((current) => preferredId ?? current ?? list[0]?.id ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar o chat.");
        setConversations([]);
        setSelectedId(null);
      } finally {
        setLoading(false);
      }
    },
    [myRole]
  );

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const nextMessages = await fetchConversationMessages(conversationId);
      setMessages(nextMessages);
      await markChatConversationRead(conversationId);
      const refreshed = await fetchChatConversations();
      setConversations(refreshed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as mensagens.");
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (myRole !== "user") return;
    void loadConversations();
  }, [loadConversations, myRole]);

  useEffect(() => {
    if (!selectedId || myRole !== "user") {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [loadMessages, myRole, selectedId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mobile: ao selecionar conversa, abre o chat; o back volta pra lista.
  function openChat(conversationId: string) {
    setSelectedId(conversationId);
    if (isMobile) setMobileView("chat");
  }

  function backToList() {
    setMobileView("list");
  }

  async function handleSendMessage() {
    if (!selectedConversation || !text.trim() || sending) return;
    setSending(true);
    try {
      await sendChatMessage(selectedConversation.id, text.trim());
      setText("");
      await loadMessages(selectedConversation.id);
      composerRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  // Enter para enviar, Shift+Enter quebra linha (padrão de chat moderno)
  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  }

  if (myRole !== "user") {
    return (
      <div style={{ ...cardStyle, padding: 22 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>
          Acesso indisponível
        </div>
        <div style={{ marginTop: 8, color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.6 }}>
          Esta área é exclusiva para alunos. Se você é personal, acesse pelo painel do personal.
        </div>
      </div>
    );
  }

  // ── Subcomponentes inline (mantêm o arquivo coeso; pequenos o suficiente) ──

  const Hero = (
    <div style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Mensagens
      </span>
      <h1
        style={{
          margin: 0,
          fontSize: isMobile ? 22 : 26,
          fontWeight: 700,
          color: "var(--color-text)",
          letterSpacing: "-0.01em",
        }}
      >
        {isMobile && mobileView === "chat" && selectedConversation
          ? selectedConversation.personalName
          : "Canal direto com seu personal"}
      </h1>
      {!(isMobile && mobileView === "chat") && (
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.55 }}>
          Tire dúvidas, avise sobre desconforto ou peça ajustes no treino.
        </p>
      )}
    </div>
  );

  const ConversationList = (
    <div style={{ ...cardStyle, padding: 14, display: "grid", gap: 10, alignSelf: "start" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        Conversas
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 64,
                borderRadius: 14,
                background: "var(--color-surface-subtle)",
                animation: "pulse 1.6s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div style={{ padding: "16px 4px", color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.55 }}>
          <strong style={{ color: "var(--color-text)" }}>Conversa em formação.</strong>
          <div style={{ marginTop: 4 }}>
            Assim que houver um profissional vinculado, ela aparece aqui.
          </div>
        </div>
      ) : (
        conversations.map((conversation) => {
          const active = conversation.id === selectedId;
          const lastMessage = conversation.lastMessage;
          const unread = conversation.unreadCount;
          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => openChat(conversation.id)}
              style={{
                textAlign: "left",
                padding: 12,
                borderRadius: 14,
                border: `1px solid ${active ? "var(--color-border-strong)" : "var(--color-border)"}`,
                background: active ? "var(--color-primary-soft)" : "transparent",
                color: "var(--color-text)",
                cursor: "pointer",
                display: "flex",
                gap: 12,
                alignItems: "center",
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
            >
              <div
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: active ? "var(--color-primary)" : "var(--color-surface-subtle)",
                  color: active ? "var(--color-cta-text, #FFFFFF)" : "var(--color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {initialOf(conversation.personalName)}
              </div>
              <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conversation.personalName}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-text-subtle)", fontWeight: 600, flexShrink: 0 }}>
                    {lastMessage ? formatPreviewTime(lastMessage.createdAt) : ""}
                  </span>
                </div>
                <div
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {lastMessage?.text || "Conversa pronta para começar."}
                  </span>
                  {unread > 0 && (
                    <span
                      aria-label={`${unread} mensagens não lidas`}
                      style={{
                        flexShrink: 0,
                        minWidth: 18,
                        height: 18,
                        padding: "0 6px",
                        borderRadius: 9,
                        background: "var(--action-primary)",
                        color: "var(--color-cta-text, #FFFFFF)",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  const ChatPanel = (
    <div
      style={{
        ...cardStyle,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        minHeight: isMobile ? "calc(100vh - 220px)" : 480,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {isMobile && (
          <button
            type="button"
            onClick={backToList}
            aria-label="Voltar para a lista"
            style={{
              flexShrink: 0,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-text)",
              fontSize: 18,
              lineHeight: 1,
              fontWeight: 600,
            }}
          >
            ←
          </button>
        )}
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "var(--color-primary-soft)",
            color: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {initialOf(selectedConversation?.personalName)}
        </div>
        <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
            {selectedConversation?.personalName ?? "Sem conversa"}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {selectedConversation ? "Personal acompanhando" : "Selecione uma conversa"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          padding: isMobile ? 14 : 18,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "var(--color-surface-raised)",
          overflowY: "auto",
        }}
      >
        {!selectedConversation ? (
          <div style={{ margin: "auto", maxWidth: 360, textAlign: "center", color: "var(--color-text-muted)", display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 15 }}>
              Nenhuma conversa selecionada.
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              Escolha uma conversa na lista para acompanhar suas trocas com o personal.
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ margin: "auto", maxWidth: 360, textAlign: "center", color: "var(--color-text-muted)", display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 15 }}>
              Conversa pronta para começar.
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              Comece pedindo um ajuste, avisando como foi o último treino ou relatando algum desconforto.
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.senderRole === "user";
            const label = senderLabel(message.senderRole, selectedConversation?.personalName ?? "Personal");
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
                    maxWidth: "82%",
                    borderRadius: 16,
                    padding: "10px 14px",
                    border: mine ? "1px solid var(--color-border-primary)" : "1px solid var(--color-border)",
                    background: mine ? "var(--color-primary)" : "var(--color-surface)",
                    color: mine ? "var(--color-cta-text, #FFFFFF)" : "var(--color-text)",
                    display: "grid",
                    gap: 4,
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{message.text}</div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      opacity: 0.75,
                      color: mine ? "var(--color-cta-text, #FFFFFF)" : "var(--color-text-subtle)",
                    }}
                  >
                    {label} · {formatTimeLabel(message.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div
        style={{
          padding: 12,
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          display: "grid",
          gap: 8,
        }}
      >
        {error && (
          <div
            role="alert"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--color-danger-border)",
              background: "var(--color-danger-soft)",
              color: "var(--color-danger)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={composerRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={
              selectedConversation
                ? "Escreva sua mensagem… (Enter envia · Shift+Enter quebra linha)"
                : "Selecione uma conversa primeiro"
            }
            rows={1}
            disabled={!selectedConversation || sending}
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 140,
              resize: "none",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-raised)",
              color: "var(--color-text)",
              padding: "10px 12px",
              fontSize: 14,
              fontFamily: "inherit",
              lineHeight: 1.45,
              outline: "none",
              opacity: !selectedConversation || sending ? 0.6 : 1,
            }}
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!selectedConversation || !text.trim() || sending}
            aria-label="Enviar mensagem"
            style={{
              flexShrink: 0,
              minHeight: 44,
              padding: "0 18px",
              borderRadius: 12,
              border: "none",
              background: text.trim() && !sending ? "var(--color-primary)" : "var(--color-surface-subtle)",
              color: text.trim() && !sending ? "var(--color-cta-text, #FFFFFF)" : "var(--color-text-muted)",
              fontSize: 14,
              fontWeight: 700,
              cursor: !selectedConversation || !text.trim() || sending ? "not-allowed" : "pointer",
              transition: "background 0.15s ease",
            }}
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Layout: mobile vs desktop ───────────────────────────────

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {Hero}

      {isMobile ? (
        // Mobile: state machine — lista OU chat (não ambos)
        mobileView === "list" || !selectedConversation ? ConversationList : ChatPanel
      ) : (
        // Desktop: 2 colunas lado a lado
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
          {ConversationList}
          {ChatPanel}
        </div>
      )}
    </div>
  );
}
