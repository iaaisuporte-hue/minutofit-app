import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { PERSONAL_STUDENTS, resolvePersonalStudentReference } from "./personalStudentsMock";
import { COLORS } from "../../styles/colors";

/**
 * =========================
 * ✅ MODELO DE DADOS (MVP)
 * =========================
 * Mesma estrutura que a tela do aluno vai usar.
 */

type Role = "user" | "personal" | "admin" | "nutri";

type ChatMessage = {
  id: string;
  conversationId: string;

  senderId: string; // email (MVP)
  senderRole: Role;

  text: string;
  createdAt: string; // ISO
};

type ChatConversation = {
  id: string;

  studentId: string; // email (MVP)
  personalId: string; // email (MVP)

  createdAt: string; // ISO
  updatedAt: string; // ISO

  // controle simples de “lido” por participante
  lastReadAtByStudent?: string;
  lastReadAtByPersonal?: string;
};

type StudentMini = {
  id: string;
  chatParticipantId: string;
  name: string;
};

/**
 * ✅ Storage keys (centralizado)
 * - Conversas: lista de conversas
 * - Mensagens: lista de mensagens (por conversa)
 */
const CONVERSATIONS_KEY = "treinai_chat_conversations_v1";
const MESSAGES_KEY_PREFIX = "treinai_chat_messages_v1__"; // + conversationId

/** ✅ Helpers */
function nowISO() {
  return new Date().toISOString();
}

function uid(prefix = "m") {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

/** ✅ Cria um id estável (mesmo para aluno e personal) */
function conversationIdOf(studentId: string, personalId: string) {
  // ✅ ordem fixa evita duplicar conversas invertidas
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

function sortConversationsByRecency(list: ChatConversation[]) {
  return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * ✅ Garante que só os participantes vejam
 * (MVP “seguro” na UI)
 */
function canAccessConversation(conv: ChatConversation, viewerId: string, viewerRole: Role) {
  if (viewerRole === "personal") return conv.personalId === viewerId;
  if (viewerRole === "user") return conv.studentId === viewerId;
  // admin/nutri: você pode decidir permitir ou não (aqui: NÃO)
  return false;
}

/** ✅ Unread count (simples) */
function countUnreadForPersonal(conv: ChatConversation, messages: ChatMessage[]) {
  const lastRead = conv.lastReadAtByPersonal ? new Date(conv.lastReadAtByPersonal).getTime() : 0;
  return messages.filter((m) => {
    const t = new Date(m.createdAt).getTime();
    return t > lastRead && m.senderRole === "user";
  }).length;
}

/** ✅ Badge UI */
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
        padding: "6px 10px", // ✅ tamanho do pill
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

/** ✅ Card base */
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
  const { user } = useAuth() as any; // 👈 MVP: depende do seu AuthContext
  const location = useLocation();
  const myId: string = user?.email || "personal@treinai.com"; // ✅ (MVP) usa email como ID
  const myRole: Role = user?.role || "personal";
  const preselectedStudentId = (location.state as { studentId?: string; studentName?: string } | null)?.studentId;
  const preselectedStudentName = (location.state as { studentId?: string; studentName?: string } | null)?.studentName;

  // ✅ segurança (UI): se não for personal, não mostra
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

  /**
   * ✅ Mock de alunos (até você ligar no banco / students list real)
   * - Importante: o "id" aqui deve ser o mesmo usado no login do aluno (email).
   * - Assim a conversa “encaixa” automaticamente.
   */
  const students: StudentMini[] = useMemo(
    () =>
      PERSONAL_STUDENTS.map((student) => ({
        id: student.id,
        chatParticipantId: student.chatParticipantId,
        name: student.name,
      })),
    []
  );

  // ✅ Estado principal
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ✅ Mensagens do chat atual
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");

  // ✅ scroll pro final
  const endRef = useRef<HTMLDivElement | null>(null);

  function loadMyConversations() {
    return sortConversationsByRecency(readConversations().filter((c) => canAccessConversation(c, myId, myRole)));
  }

  /** ✅ Carregar conversas do storage */
  useEffect(() => {
    const mine = loadMyConversations();
    setConversations(mine);

    // seleciona a primeira se nada selecionado
    if (!selectedId && mine.length) setSelectedId(mine[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, myRole]);

  useEffect(() => {
    if (!preselectedStudentId && !preselectedStudentName) return;
    const student = resolvePersonalStudentReference({ id: preselectedStudentId, name: preselectedStudentName });
    if (!student) return;
    openConversationWithStudent(student.id);
  }, [preselectedStudentId, preselectedStudentName]);

  /** ✅ Sempre que selecionar conversa, carregar mensagens */
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    const conv = readConversations().find((c) => c.id === selectedId);
    if (!conv) {
      setMessages([]);
      return;
    }

    // segurança: checa acesso
    if (!canAccessConversation(conv, myId, myRole)) {
      setMessages([]);
      return;
    }

    const list = readMessages(selectedId);
    setMessages(list);

    // marca como lida (personal)
    const updated = readConversations().map((c) => {
      if (c.id !== selectedId) return c;
      return { ...c, lastReadAtByPersonal: nowISO() };
    });
    writeConversations(updated);

    // atualiza state local
    setConversations(sortConversationsByRecency(updated.filter((c) => canAccessConversation(c, myId, myRole))));
  }, [selectedId, myId, myRole]);

  /** ✅ Scroll sempre que mensagens mudarem */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /** ✅ “Realtime” simples (MVP): escuta storage */
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!e.key) return;

      // conversas mudaram
      if (e.key === CONVERSATIONS_KEY) {
        setConversations(loadMyConversations());
      }

      // mensagens da conversa aberta mudaram
      if (selectedId && e.key === MESSAGES_KEY_PREFIX + selectedId) {
        setMessages(readMessages(selectedId));
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [selectedId, myId, myRole]);

  /** ✅ Abrir (ou criar) conversa com um aluno */
  function openConversationWithStudent(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;

    const convId = conversationIdOf(student.chatParticipantId, myId);

    const all = readConversations();
    let conv = all.find((c) => c.id === convId);

    // cria se não existir
    if (!conv) {
      conv = {
        id: convId,
        studentId: student.chatParticipantId,
        personalId: myId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        lastReadAtByStudent: undefined,
        lastReadAtByPersonal: nowISO(),
      };
      all.push(conv);
      writeConversations(all);
    }

    // atualiza state e seleciona
    setConversations(sortConversationsByRecency(all.filter((c) => canAccessConversation(c, myId, myRole))));
    setSelectedId(convId);
  }

  /** ✅ Enviar mensagem */
  function sendMessage() {
    const body = text.trim();
    if (!selectedId || !body) return;

    const conv = readConversations().find((c) => c.id === selectedId);
    if (!conv) return;

    // segurança: checa acesso
    if (!canAccessConversation(conv, myId, myRole)) return;

    const list = readMessages(selectedId);

    const msg: ChatMessage = {
      id: uid("msg"),
      conversationId: selectedId,
      senderId: myId,
      senderRole: "personal",
      text: body,
      createdAt: nowISO(),
    };

    const next = [...list, msg];
    writeMessages(selectedId, next);
    setMessages(next);
    setText("");

    // atualiza conversa (updatedAt e lastRead)
    const all = readConversations().map((c) => {
      if (c.id !== selectedId) return c;
      return { ...c, updatedAt: nowISO(), lastReadAtByPersonal: nowISO() };
    });
    writeConversations(all);

    setConversations(sortConversationsByRecency(all.filter((c) => canAccessConversation(c, myId, myRole))));
  }

  const selectedConv = useMemo(() => conversations.find((c) => c.id === selectedId) || null, [conversations, selectedId]);

  const selectedStudent = useMemo(() => {
    if (!selectedConv) return null;
    return (
      students.find((s) => s.chatParticipantId === selectedConv.studentId) || {
        id: selectedConv.studentId,
        chatParticipantId: selectedConv.studentId,
        name: selectedConv.studentId,
      }
    );
  }, [selectedConv, students]);

  const filteredInbox = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((c) => {
      const stu = students.find((s) => s.chatParticipantId === c.studentId);
      const label = (stu?.name || c.studentId).toLowerCase();
      return label.includes(q);
    });
  }, [conversations, search, students]);

  return (
    <div style={{ display: "grid", gap: 16, color: "#1F2937" }}>
      {/* ✅ Top header */}
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

      {/* ✅ Layout: Inbox + Chat */}
      <div
        style={{
          display: "grid",

          // ✅ (LAYOUT) responsivo:
          // - desktop: 340px + chat
          // - mobile: 1 coluna (inbox em cima)
          gridTemplateColumns: "minmax(280px, 340px) 1fr",
          gap: 12,
        }}
      >
        {/* =====================
            ✅ INBOX (ESQUERDA)
            ===================== */}
        <Card>
          <div style={{ padding: 14, display: "grid", gap: 12 }}>
            {/* ✅ Search */}
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

            {/* ✅ Atalho: abrir conversa (criar) */}
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
                INICIAR CONVERSA
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {students.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openConversationWithStudent(s.id)}
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
                    title={`Abrir chat com ${s.name}`}
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* ✅ Lista de conversas */}
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
                CONVERSAS
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {filteredInbox.length === 0 ? (
                  <div style={{ color: "#6B7280", fontSize: 13 }}>
                    Nenhuma conversa ainda. Crie uma acima.
                  </div>
                ) : (
                  filteredInbox.map((c) => {
                    const stu = students.find((s) => s.chatParticipantId === c.studentId);
                    const label = stu?.name || c.studentId;

                    const msgs = readMessages(c.id);
                    const last = msgs[msgs.length - 1];

                    const unread = countUnreadForPersonal(c, msgs);

                    const active = c.id === selectedId;

                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
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
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>

                          {unread > 0 ? (
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: COLORS.primarySoft,
                                border: `1px solid ${COLORS.borderStrong}`,
                                fontWeight: 700,
                                fontSize: 12,
                                lineHeight: 1,
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

            {/* ✅ Dica */}
            <div style={{ marginTop: 6, color: "#9CA3AF", fontSize: 12, lineHeight: 1.4 }}>
              As mensagens desta etapa ainda ficam no navegador enquanto o backend de chat não entra.
            </div>
          </div>
        </Card>

        {/* =====================
            ✅ CHAT (DIREITA)
            ===================== */}
        <Card>
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 520 }}>
            {/* ✅ Header do chat */}
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
                  {selectedStudent ? selectedStudent.id : "Inbox → escolha um aluno para abrir"}
                </div>
              </div>

              {selectedConv ? <Pill variant="orange">Conversa ativa</Pill> : <Pill variant="neutral">Sem conversa</Pill>}
            </div>

            {/* ✅ Mensagens */}
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
                  {messages.map((m) => {
                    const mine = m.senderRole === "personal";
                    return (
                      <div
                        key={m.id}
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
                          <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.text}</div>
                          <div style={{ marginTop: 6, fontSize: 11, color: "#9CA3AF" }}>
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

            {/* ✅ Composer */}
            <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,.10)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={selectedConv ? "Digite sua mensagem…" : "Selecione uma conversa primeiro"}
                  disabled={!selectedConv}
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
                  }}
                />

                <button
                  onClick={sendMessage}
                  disabled={!selectedConv || !text.trim()}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.borderStrong}`,
                    background: "#22C55E",
                    color: "#FFFFFF",
                    cursor: !selectedConv || !text.trim() ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: "0 14px 28px rgba(34,197,94,.22)",
                    opacity: !selectedConv || !text.trim() ? 0.6 : 1,
                  }}
                >
                  Enviar
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                Conversa atual: `{selectedId || "—"}`.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ✅ Responsivo simples (1 coluna no mobile) */}
      <style>{`
        @media (max-width: 980px){
          div[style*="grid-template-columns: minmax(280px, 340px) 1fr"]{
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
