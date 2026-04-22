import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { COLORS } from "../../styles/colors";
import {
  ensureChatConversation,
  fetchChatConversations,
  fetchConversationMessages,
  markChatConversationRead,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
} from "../../services/messagesApi";

type Role = "user" | "personal" | "admin" | "nutri";

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
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
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
  const { user } = useAuth();
  const myRole: Role = user?.role || "user";

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId]
  );

  const loadConversations = useCallback(async (preferredConversationId?: string | null) => {
    setLoading(true);
    try {
      let list = await fetchChatConversations();
      if (myRole === "user" && list.length === 0) {
        await ensureChatConversation();
        list = await fetchChatConversations();
      }

      setConversations(list);
      setSelectedId((current) => preferredConversationId ?? current ?? list[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o chat.");
      setConversations([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [myRole]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const nextMessages = await fetchConversationMessages(conversationId);
      setMessages(nextMessages);
      await markChatConversationRead(conversationId);
      const refreshed = await fetchChatConversations();
      setConversations(refreshed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar as mensagens.");
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSendMessage() {
    if (!selectedConversation || !text.trim()) {
      return;
    }

    setSending(true);
    try {
      await sendChatMessage(selectedConversation.id, text.trim());
      setText("");
      await loadMessages(selectedConversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  if (myRole !== "user") {
    return (
      <Card style={{ padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Acesso indisponível</div>
        <div style={{ marginTop: 8, color: COLORS.muted }}>
          Essa área será controlada por perfil de acesso. Quando você quiser, eu te ajudo a amarrar isso por role de ponta a ponta.
        </div>
      </Card>
    );
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
              color: "#22C55E",
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Mensagens
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text }}>
            Canal direto com seu personal.
          </div>
          <div style={{ color: COLORS.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 780 }}>
            Use esse espaço para tirar dúvidas rápidas, avisar sobre dores, pedir ajustes no treino ou combinar próximos passos do seu plano.
          </div>
        </div>
      </Card>

      {error ? (
        <Card style={{ padding: 14, color: COLORS.text }}>
          <div style={{ fontWeight: 700 }}>Falha ao carregar mensagens</div>
          <div style={{ marginTop: 6, color: COLORS.muted }}>{error}</div>
        </Card>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
          gap: 16,
        }}
      >
        <Card style={{ padding: 14, display: "grid", gap: 12, alignSelf: "start" }}>
          <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 16 }}>Conversas</div>

          {loading ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando conversas...</div>
          ) : conversations.length === 0 ? (
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
              Ainda não há conversas disponíveis para a sua conta.
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
                  onClick={() => setSelectedId(conversation.id)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 16,
                    border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                    background: active ? COLORS.primarySoft : "#FAFAFA",
                    color: COLORS.text,
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 600 }}>{conversation.personalName}</div>
                    {unread ? (
                      <span
                        style={{
                          borderRadius: 999,
                          background: COLORS.highlightSoft,
                          color: "#22C55E",
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600,
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
            })
          )}
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
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>
                {selectedConversation ? selectedConversation.personalName : "Seu personal"}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>
                Respostas rápidas, avisos de treino e alinhamentos do seu acompanhamento.
              </div>
            </div>
            <div
              style={{
                borderRadius: 999,
                background: "rgba(34,197,94,.12)",
                border: `1px solid ${COLORS.borderStrong}`,
                padding: "8px 12px",
                color: COLORS.text,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {selectedConversation ? "Canal ativo" : "Sem conversa"}
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
            {!selectedConversation ? (
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
                <div style={{ fontWeight: 700, color: COLORS.text }}>Nenhuma conversa selecionada.</div>
                <div style={{ fontSize: 14 }}>
                  Escolha uma conversa na coluna da esquerda para acompanhar suas mensagens com o personal.
                </div>
              </div>
            ) : messages.length === 0 ? (
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
                <div style={{ fontWeight: 700, color: COLORS.text }}>Ainda não há mensagens nessa conversa.</div>
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
                          : "#F9FAFB",
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
              placeholder={selectedConversation ? "Escreva sua mensagem para o personal..." : "Selecione uma conversa primeiro"}
              rows={4}
              disabled={!selectedConversation || sending}
              style={{
                width: "100%",
                resize: "vertical",
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                background: "#FAFAFA",
                color: COLORS.text,
                padding: 14,
                fontSize: 14,
                outline: "none",
                opacity: !selectedConversation || sending ? 0.7 : 1,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>
                Prefira mensagens curtas e objetivas para facilitar resposta e acompanhamento.
              </div>
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!selectedConversation || !text.trim() || sending}
                style={{
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: `1px solid ${text.trim() ? COLORS.borderStrong : COLORS.border}`,
                  background: text.trim() ? "#22C55E" : "#F9FAFB",
                  color: text.trim() ? "#0A130D" : COLORS.muted,
                  fontWeight: 700,
                  cursor: !selectedConversation || !text.trim() || sending ? "not-allowed" : "pointer",
                }}
              >
                {sending ? "Enviando..." : "Enviar mensagem"}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
