import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

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
  id: string; // email
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
    neutral: { bd: "rgba(255,255,255,.12)", bg: "rgba(255,255,255,.06)" },
    success: { bd: "rgba(34,197,94,.35)", bg: "rgba(34,197,94,.12)" },
    warn: { bd: "rgba(255,183,3,.35)", bg: "rgba(255,183,3,.12)" },
    danger: { bd: "rgba(220,38,38,.35)", bg: "rgba(220,38,38,.12)" },
    orange: { bd: "rgba(255,106,0,.35)", bg: "rgba(255,106,0,.12)" },
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
        fontWeight: 900,
        lineHeight: 1,
        color: "#FFFFFF",
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
  const { user } = useAuth() as any; // 👈 MVP: depende do seu AuthContext
  const myId: string = user?.email || "personal@treinai.com"; // ✅ (MVP) usa email como ID
  const myRole: Role = user?.role || "personal";

  // ✅ segurança (UI): se não for personal, não mostra
  if (myRole !== "personal") {
    return (
      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Acesso negado</div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,.70)", fontSize: 13 }}>
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
    () => [
      { id: "basic@treinai.com", name: "Aluno Basic" },
      { id: "silver@treinai.com", name: "Aluno Silver" },
      { id: "gold@treinai.com", name: "Aluno Gold" },
      { id: "black@treinai.com", name: "Aluno Black" },
    ],
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

  /** ✅ Carregar conversas do storage */
  useEffect(() => {
    const list = readConversations();
    // só as minhas (personal)
    const mine = list.filter((c) => canAccessConversation(c, myId, myRole));
    // mais recentes primeiro
    mine.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setConversations(mine);

    // seleciona a primeira se nada selecionado
    if (!selectedId && mine.length) setSelectedId(mine[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ✅ Sempre que selecionar conversa, carregar mensagens */
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const conv = conversations.find((c) => c.id === selectedId);
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
    const mine = updated.filter((c) => canAccessConversation(c, myId, myRole));
    mine.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setConversations(mine);
  }, [selectedId, myId, myRole, conversations]);

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
        const list = readConversations().filter((c) => canAccessConversation(c, myId, myRole));
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setConversations(list);
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
    const convId = conversationIdOf(studentId, myId);

    const all = readConversations();
    let conv = all.find((c) => c.id === convId);

    // cria se não existir
    if (!conv) {
      conv = {
        id: convId,
        studentId,
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
    const mine = all.filter((c) => canAccessConversation(c, myId, myRole));
    mine.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setConversations(mine);
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

    const mine = all.filter((c) => canAccessConversation(c, myId, myRole));
    mine.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setConversations(mine);
  }

  const selectedConv = useMemo(() => conversations.find((c) => c.id === selectedId) || null, [conversations, selectedId]);

  const selectedStudent = useMemo(() => {
    if (!selectedConv) return null;
    return students.find((s) => s.id === selectedConv.studentId) || { id: selectedConv.studentId, name: selectedConv.studentId };
  }, [selectedConv, students]);

  const filteredInbox = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((c) => {
      const stu = students.find((s) => s.id === c.studentId);
      const label = (stu?.name || c.studentId).toLowerCase();
      return label.includes(q);
    });
  }, [conversations, search, students]);

  return (
    <div style={{ display: "grid", gap: 16, color: "#FFFFFF" }}>
      {/* ✅ Top header */}
      <Card>
        <div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Mensagens</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
              Inbox do Personal. Responda rápido e priorize alunos com dúvidas recorrentes.
            </div>
          </div>

          <Pill variant="orange">🔐 Treinaí • Chat MVP</Pill>
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
                background: "#121212",
                color: "#FFFFFF",
                outline: "none",
                fontWeight: 800,
              }}
            />

            {/* ✅ Atalho: abrir conversa (criar) */}
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,.65)" }}>
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
                      border: "1px solid rgba(255,255,255,.12)",
                      background: "transparent",
                      color: "#FFFFFF",
                      cursor: "pointer",
                      fontWeight: 900,
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
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,.65)" }}>
                CONVERSAS
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {filteredInbox.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,.65)", fontSize: 13 }}>
                    Nenhuma conversa ainda. Crie uma acima.
                  </div>
                ) : (
                  filteredInbox.map((c) => {
                    const stu = students.find((s) => s.id === c.studentId);
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
                          border: active ? "1px solid rgba(255,106,0,.35)" : "1px solid rgba(255,255,255,.10)",
                          background: active ? "rgba(255,106,0,.12)" : "rgba(255,255,255,.04)",
                          color: "#FFFFFF",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontWeight: 1000, fontSize: 14 }}>{label}</div>

                          {unread > 0 ? (
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: "rgba(255,106,0,.18)",
                                border: "1px solid rgba(255,106,0,.35)",
                                fontWeight: 1000,
                                fontSize: 12,
                                lineHeight: 1,
                              }}
                            >
                              {unread}
                            </span>
                          ) : null}
                        </div>

                        <div style={{ marginTop: 6, color: "rgba(255,255,255,.65)", fontSize: 12, lineHeight: 1.35 }}>
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
            <div style={{ marginTop: 6, color: "rgba(255,255,255,.55)", fontSize: 12, lineHeight: 1.4 }}>
              💡 MVP: as mensagens ficam no navegador (localStorage). No backend a gente coloca autenticação e criptografia.
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
                <div style={{ fontWeight: 1000, fontSize: 15 }}>
                  {selectedStudent ? selectedStudent.name : "Selecione uma conversa"}
                </div>
                <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12 }}>
                  {selectedStudent ? selectedStudent.id : "Inbox → escolha um aluno para abrir"}
                </div>
              </div>

              {selectedConv ? <Pill variant="orange">🔒 Conversa privada</Pill> : <Pill variant="neutral">Sem chat</Pill>}
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
                <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.5 }}>
                  Abra uma conversa na coluna da esquerda para começar.
                </div>
              ) : messages.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.5 }}>
                  Ainda não há mensagens. Envie a primeira 👇
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
                            border: mine ? "1px solid rgba(255,106,0,.35)" : "1px solid rgba(255,255,255,.10)",
                            background: mine ? "rgba(255,106,0,.14)" : "rgba(255,255,255,.05)",
                            color: "#FFFFFF",
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
                  disabled={!selectedConv || !text.trim()}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,106,0,.35)",
                    background: "#FF6A00",
                    color: "#0F0F0F",
                    cursor: !selectedConv || !text.trim() ? "not-allowed" : "pointer",
                    fontWeight: 1000,
                    fontSize: 14,
                    boxShadow: "0 10px 24px rgba(0,0,0,.35)",
                    opacity: !selectedConv || !text.trim() ? 0.6 : 1,
                  }}
                >
                  Enviar
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                ✅ MVP pronto para integração: aluno envia mensagem na conversa `{selectedId || "—"}`.
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