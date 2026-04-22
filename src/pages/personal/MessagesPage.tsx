import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
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
import { fetchPersonalConsulting, type PersonalConsultingStudent } from "../../services/personalDashboardApi";

type Role = "user" | "personal" | "admin" | "nutri";

type StudentMini = {
  id: string;
  name: string;
};

function Pill({
  children,
  variant = "neutral",
  title,
}: {
  children: React.ReactNode;
  variant?: "neutral" | "success" | "warn" | "danger" | "orange";
  title?: string;
}) {
  const map = {
    neutral: { bd: COLORS.border, bg: COLORS.highlightSoft },
    success: { bd: COLORS.borderStrong, bg: COLORS.primarySoft },
    warn: { bd: "rgba(255,183,3,.35)", bg: "rgba(255,183,3,.12)" },
    danger: { bd: "rgba(220,38,38,.35)", bg: "rgba(220,38,38,.12)" },
    orange: { bd: COLORS.borderStrong, bg: COLORS.primarySoft },
  } as const;

  return (
    <span
      title={title}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${map[variant].bd}`,
        background: map[variant].bg,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        color: COLORS.text,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "nowrap",
        width: "fit-content",
      }}
    >
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const myRole: Role = user?.role || "personal";
  const preselectedStudentId = (location.state as { studentId?: string; studentName?: string } | null)?.studentId;

  const [students, setStudents] = useState<StudentMini[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const selectedConv = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId]
  );

  const selectedStudent = useMemo(() => {
    if (!selectedConv) return null;
    return {
      id: selectedConv.studentId,
      name: selectedConv.studentName,
    };
  }, [selectedConv]);

  const filteredInbox = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((conversation) => {
      const label = conversation.studentName.toLowerCase();
      return label.includes(q);
    });
  }, [conversations, search]);

  const loadStudents = useCallback(async () => {
    const data = await fetchPersonalConsulting();
    const list = (data?.students ?? []).map((student: PersonalConsultingStudent) => ({
      id: student.id,
      name: student.name,
    }));
    setStudents(list);
  }, []);

  const loadConversations = useCallback(async (preferredConversationId?: string | null) => {
    const list = await fetchChatConversations();
    setConversations(list);
    setSelectedId((current) => preferredConversationId ?? current ?? list[0]?.id ?? null);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const nextMessages = await fetchConversationMessages(conversationId);
    setMessages(nextMessages);
    await markChatConversationRead(conversationId);
    const refreshed = await fetchChatConversations();
    setConversations(refreshed);
  }, []);

  const openConversationWithStudent = useCallback(async (studentId: string) => {
    const conversation = await ensureChatConversation({ studentId });
    await loadConversations(conversation?.id ?? null);
  }, [loadConversations]);

  useEffect(() => {
    if (myRole !== "personal") return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        await Promise.all([loadStudents(), loadConversations()]);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Nao foi possivel carregar o chat do personal.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadConversations, loadStudents, myRole]);

  useEffect(() => {
    if (!preselectedStudentId || myRole !== "personal") return;
    void openConversationWithStudent(preselectedStudentId).catch((err) => {
      setError(err instanceof Error ? err.message : "Nao foi possivel abrir a conversa.");
    });
  }, [myRole, openConversationWithStudent, preselectedStudentId]);

  useEffect(() => {
    if (!selectedId || myRole !== "personal") {
      setMessages([]);
      return;
    }

    void loadMessages(selectedId).catch((err) => {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar as mensagens.");
      setMessages([]);
    });
  }, [loadMessages, myRole, selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSendMessage() {
    if (!selectedConv || !text.trim()) return;

    setSending(true);
    try {
      await sendChatMessage(selectedConv.id, text.trim());
      setText("");
      await loadMessages(selectedConv.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  if (myRole !== "personal") {
    return (
      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Acesso negado</div>
          <div style={{ marginTop: 6, color: "#6B7280", fontSize: 13 }}>
            Esta área é exclusiva para Personal.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, color: "#1F2937" }}>
      <Card>
        <div
          style={{
            padding: 18,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            background: COLORS.panelDeep,
            borderRadius: 20,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 22 }}>Mensagens</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45 }}>
              Converse com a carteira ativa e responda primeiro quem já está pedindo atenção.
            </div>
          </div>

          <Pill variant="orange">Inbox do personal</Pill>
        </div>
      </Card>

      {error ? (
        <Card>
          <div style={{ padding: 14, color: COLORS.text }}>
            <div style={{ fontWeight: 700 }}>Falha ao carregar mensagens</div>
            <div style={{ marginTop: 6, color: COLORS.muted }}>{error}</div>
          </div>
        </Card>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 340px) 1fr",
          gap: 12,
        }}
      >
        <Card>
          <div style={{ padding: 14, display: "grid", gap: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aluno…"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.12)",
                background: "#FAFAFA",
                color: "#1F2937",
                outline: "none",
                fontWeight: 600,
              }}
            />

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
                INICIAR CONVERSA
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {students.slice(0, 4).map((student) => (
                  <button
                    key={student.id}
                    onClick={() => void openConversationWithStudent(student.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${COLORS.border}`,
                      background: "#FAFAFA",
                      color: "#1F2937",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                    title={`Abrir chat com ${student.name}`}
                  >
                    + {student.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
                CONVERSAS
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {loading ? (
                  <div style={{ color: "#6B7280", fontSize: 13 }}>
                    Carregando conversas...
                  </div>
                ) : filteredInbox.length === 0 ? (
                  <div style={{ color: "#6B7280", fontSize: 13 }}>
                    Nenhuma conversa ainda. Crie uma acima.
                  </div>
                ) : (
                  filteredInbox.map((conversation) => {
                    const active = conversation.id === selectedId;
                    const unread = conversation.unreadCount;
                    const last = conversation.lastMessage;

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => setSelectedId(conversation.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "12px 12px",
                          borderRadius: 14,
                          border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                          background: active ? COLORS.primarySoft : "#FAFAFA",
                          color: "#1F2937",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {conversation.studentName}
                          </div>

                          {unread ? (
                            <span
                              style={{
                                borderRadius: 999,
                                background: COLORS.highlightSoft,
                                color: "#22C55E",
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {unread}
                            </span>
                          ) : null}
                        </div>

                        <div style={{ marginTop: 6, color: "#6B7280", fontSize: 12, lineHeight: 1.35 }}>
                          {last ? (
                            <>
                              <b style={{ color: "rgba(255,255,255,.85)" }}>
                                {last.senderRole === "personal" ? "Você: " : ""}
                              </b>
                              {last.text.length > 60 ? last.text.slice(0, 60) + "…" : last.text}
                            </>
                          ) : (
                            "Conversa vazia"
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 520 }}>
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid rgba(255,255,255,.10)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {selectedStudent ? selectedStudent.name : "Selecione uma conversa"}
                </div>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>
                  {selectedStudent ? `Aluno ${selectedStudent.id}` : "Inbox → escolha um aluno para abrir"}
                </div>
              </div>

              {selectedConv ? <Pill variant="orange">Conversa ativa</Pill> : <Pill variant="neutral">Sem conversa</Pill>}
            </div>

            <div
              style={{
                padding: 14,
                overflow: "auto",
                background: "linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0))",
              }}
            >
              {!selectedConv ? (
                <div style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5 }}>
                  Abra uma conversa na coluna da esquerda para começar.
                </div>
              ) : messages.length === 0 ? (
                <div style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5 }}>
                  Ainda não há mensagens. Comece a conversa por aqui.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {messages.map((message) => {
                    const mine = message.senderRole === "personal";
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
                            maxWidth: 520,
                            padding: "10px 12px",
                            borderRadius: 14,
                            border: mine ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                            background: mine ? COLORS.primarySoft : "#F9FAFB",
                            color: "#1F2937",
                            boxShadow: "0 10px 24px rgba(0,0,0,.25)",
                          }}
                        >
                          <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{message.text}</div>
                          <div style={{ marginTop: 6, fontSize: 11, color: "#9CA3AF" }}>
                            {new Date(message.createdAt).toLocaleString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,.10)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={selectedConv ? "Digite sua mensagem…" : "Selecione uma conversa primeiro"}
                  disabled={!selectedConv || sending}
                  rows={2}
                  style={{
                    flex: 1,
                    resize: "none",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: "#FAFAFA",
                    color: "#1F2937",
                    outline: "none",
                    fontWeight: 700,
                    lineHeight: 1.35,
                    opacity: !selectedConv || sending ? 0.7 : 1,
                  }}
                />

                <button
                  onClick={() => void handleSendMessage()}
                  disabled={!selectedConv || !text.trim() || sending}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.borderStrong}`,
                    background: "#22C55E",
                    color: "#FFFFFF",
                    cursor: !selectedConv || !text.trim() || sending ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: "0 14px 28px rgba(34,197,94,.22)",
                    opacity: !selectedConv || !text.trim() || sending ? 0.6 : 1,
                  }}
                >
                  {sending ? "Enviando..." : "Enviar"}
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                Conversa atual: `{selectedId || "—"}`.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
