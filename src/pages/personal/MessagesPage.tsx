import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  ensureChatConversation,
  fetchChatConversations,
  fetchConversationMessages,
  fetchEligibleStudents,
  markChatConversationRead,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
  type EligibleStudent,
} from "../../services/messagesApi";
import {
  createRelationshipAction,
  listMessageTemplates,
  type MessageTemplate,
} from "../../services/personalRetentionApi";
import { usePersonalStudentSnapshot } from "./hooks/usePersonalStudentSnapshot";
import { SkeletonStudentList } from "../../components/feedback/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { normalizePhoneToBRE164, openWhatsappCompose } from "./lib/whatsappLink";
import "./messagesPersonal.css";

type Role = "user" | "personal" | "admin" | "nutri";
type StudentMini = EligibleStudent;

// Chips de sugestão com fallback hardcoded
const CHIP_CATEGORIES = [
  { label: "Reengajamento", category: "aluno_ausente_amigavel" },
  { label: "Retorno leve",  category: "retorno_progressivo" },
  { label: "Aula bônus",    category: "oferta_bonus_leve" },
  { label: "Motivacional",  category: "parabens_consistencia" },
] as const;

const FALLBACK_TEMPLATES: Record<string, string> = {
  aluno_ausente_amigavel:
    "Oi [nome]! Vi que você ficou alguns dias sem treinar 😄\nEstá tudo bem?\nSe quiser podemos retomar de forma mais leve essa semana.",
  retorno_progressivo:
    "Oi [nome]! Que tal voltarmos com um treino mais curto essa semana para pegar o ritmo de volta? Você escolhe o dia.",
  oferta_bonus_leve:
    "Oi [nome]! Tenho um horário aberto pra uma sessão bônus essa semana — quer aproveitar?",
  parabens_consistencia:
    "Oi [nome]! Queria te parabenizar pela constância nos treinos. Continua assim — está fazendo diferença!",
};

function daysSince(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / 86_400_000);
}

function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

type Toast = { kind: "success" | "warn"; text: string };

export default function MessagesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const myRole: Role = user?.role || "personal";

  const preselectedStudentId =
    (location.state as { studentId?: string; studentName?: string } | null)?.studentId;

  const [students, setStudents] = useState<StudentMini[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [activeChipCategory, setActiveChipCategory] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const selectedStudent = useMemo(() => {
    if (!selectedConv) return null;
    return { id: selectedConv.studentId, name: selectedConv.studentName };
  }, [selectedConv]);

  const { data: studentSnapshot } = usePersonalStudentSnapshot(selectedStudent?.id ?? null);

  const filteredInbox = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.studentName.toLowerCase().includes(q));
  }, [conversations, search]);

  const showToast = useCallback((kind: Toast["kind"], text: string) => {
    setToast({ kind, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadStudents = useCallback(async () => {
    const list = await fetchEligibleStudents();
    setStudents(list);
  }, []);

  const loadConversations = useCallback(async (preferredId?: string | null) => {
    const list = await fetchChatConversations();
    setConversations(list);
    setSelectedId((curr) => preferredId ?? curr ?? list[0]?.id ?? null);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const msgs = await fetchConversationMessages(conversationId);
    setMessages(msgs);
    await markChatConversationRead(conversationId);
    const refreshed = await fetchChatConversations();
    setConversations(refreshed);
  }, []);

  const openConversationWithStudent = useCallback(
    async (studentId: string) => {
      const conv = await ensureChatConversation({ studentId });
      await loadConversations(conv?.id ?? null);
    },
    [loadConversations]
  );

  // Boot
  useEffect(() => {
    if (myRole !== "personal") return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [, , tmpl] = await Promise.all([
          loadStudents(),
          loadConversations(),
          listMessageTemplates().catch(() => [] as MessageTemplate[]),
        ]);
        if (!cancelled) {
          setTemplates(tmpl);
          setError(null);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Não foi possível carregar o chat."
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadConversations, loadStudents, myRole]);

  // Abertura de conversa pré-selecionada via router state
  useEffect(() => {
    if (!preselectedStudentId || myRole !== "personal") return;
    void openConversationWithStudent(preselectedStudentId).catch((err) => {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a conversa.");
    });
  }, [myRole, openConversationWithStudent, preselectedStudentId]);

  // Carrega mensagens ao trocar de conversa
  useEffect(() => {
    if (!selectedId || myRole !== "personal") {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId).catch((err) => {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as mensagens.");
      setMessages([]);
    });
  }, [loadMessages, myRole, selectedId]);

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Handlers ──

  function applyChip(category: string, studentName: string) {
    const tmpl = templates.find((t) => t.category === category);
    const body = (tmpl?.body ?? FALLBACK_TEMPLATES[category] ?? "").replace(
      /\[nome\]/gi,
      studentName
    );
    if (text.trim() && activeChipCategory !== category) {
      if (!window.confirm("Substituir o texto atual pelo template?")) return;
    }
    setText(body);
    setActiveChipCategory(category);
  }

  async function handleSendMessage() {
    if (!selectedConv || !text.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(selectedConv.id, text.trim());
      setText("");
      setActiveChipCategory(null);
      await loadMessages(selectedConv.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendWhatsApp() {
    if (!selectedConv || !text.trim()) return;
    const phone = selectedConv.studentPhone;
    const e164 = normalizePhoneToBRE164(phone);

    if (!e164) {
      showToast(
        "warn",
        "Telefone do aluno não cadastrado ou inválido. Edite o perfil do aluno para enviar via WhatsApp."
      );
      return;
    }

    setSendingWa(true);
    try {
      const snippet = text.trim().slice(0, 200);
      openWhatsappCompose(phone, text.trim());
      showToast("success", "WhatsApp aberto. Revise a mensagem e envie.");

      // Registra na timeline sem bloquear a UX
      void createRelationshipAction(selectedConv.studentId, {
        actionType: "message_sent",
        payloadJson: {
          channel: "whatsapp",
          snippet,
          templateCategory: activeChipCategory ?? undefined,
        },
        source: "whatsapp-deep-link",
      }).catch(() => {
        // best-effort — falha silenciosa
      });

      setText("");
      setActiveChipCategory(null);
    } finally {
      setSendingWa(false);
    }
  }

  // ── Render ──

  if (myRole !== "personal") {
    return (
      <div className="mp-card mp-access-denied">
        <div className="mp-access-denied-title">Acesso negado</div>
        <div className="mp-access-denied-sub">Esta área é exclusiva para Personal.</div>
      </div>
    );
  }

  const canSend = !!selectedConv && !!text.trim() && !sending;
  const canSendWa = !!selectedConv && !!text.trim() && !sendingWa;
  const phoneFormatted = formatPhone(selectedConv?.studentPhone);
  const daysAbsent =
    studentSnapshot?.today?.latestWorkout
      ? daysSince(studentSnapshot.today.latestWorkout.completedAt)
      : null;

  return (
    <div className="mp-page">
      {/* Header */}
      <div className="mp-card mp-header">
        <div>
          <div className="mp-header-title">Mensagens</div>
          <div className="mp-header-sub">
            Converse com a carteira ativa e responda quem já está pedindo atenção.
          </div>
        </div>
        <span className="mp-pill">Inbox do personal</span>
      </div>

      {/* Error */}
      {error ? (
        <div className="mp-card mp-error">
          <div className="mp-error-title">Falha ao carregar mensagens</div>
          <div className="mp-error-body">{error}</div>
        </div>
      ) : null}

      {/* Toast */}
      {toast ? (
        <div className={`mp-toast ${toast.kind}`}>{toast.text}</div>
      ) : null}

      {/* Two-column grid */}
      <div className="mp-grid">
        {/* Inbox */}
        <div className="mp-card">
          <div className="mp-inbox">
            <input
              className="mp-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aluno…"
            />

            {/* Nova conversa */}
            <div>
              <div className="mp-inbox-section-label">Iniciar nova conversa</div>
              {students.length === 0 ? (
                <div className="mp-empty-text">
                  Sem alunos vinculados ativos. Convide alunos pela página de Alunos.
                </div>
              ) : (
                <div className="mp-new-students">
                  {[...students]
                    .sort((a, b) => {
                      if (a.hasMessages === b.hasMessages)
                        return a.name.localeCompare(b.name);
                      return a.hasMessages ? 1 : -1;
                    })
                    .map((s) => (
                      <button
                        key={s.id}
                        className={`mp-new-student-btn${s.hasMessages ? " has-messages" : ""}`}
                        onClick={() => void openConversationWithStudent(s.id)}
                        title={
                          s.hasMessages
                            ? `Retomar chat com ${s.name}`
                            : `Iniciar conversa com ${s.name}`
                        }
                      >
                        {s.hasMessages ? "↻" : "+"} {s.name}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Lista de conversas */}
            <div>
              <div className="mp-inbox-section-label">Conversas</div>
              <div className="mp-conv-list">
                {loading ? (
                  <SkeletonStudentList rows={3} label="Carregando conversas" />
                ) : filteredInbox.length === 0 ? (
                  <div style={{ padding: "12px 8px" }}>
                    <EmptyState
                      eyebrow="Inbox vazia"
                      variant="info"
                      title="Nenhuma conversa ativa"
                      description="Selecione um aluno acima para iniciar — o contexto metabólico e a aderência aparecem no painel à direita."
                    />
                  </div>
                ) : (
                  filteredInbox.map((conv) => {
                    const active = conv.id === selectedId;
                    const last = conv.lastMessage;
                    return (
                      <button
                        key={conv.id}
                        className={`mp-conv-card${active ? " active" : ""}`}
                        onClick={() => setSelectedId(conv.id)}
                      >
                        <div className="mp-conv-meta">
                          <span className="mp-conv-name">{conv.studentName}</span>
                          {conv.unreadCount > 0 ? (
                            <span className="mp-conv-unread">{conv.unreadCount}</span>
                          ) : null}
                        </div>
                        <div className="mp-conv-preview">
                          {last ? (
                            <>
                              {last.senderRole === "personal" ? (
                                <span className="mp-conv-preview-sender">Você: </span>
                              ) : null}
                              {last.text.length > 58
                                ? last.text.slice(0, 58) + "…"
                                : last.text}
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
        </div>

        {/* Thread */}
        <div className="mp-card">
          <div className="mp-thread">
            {/* Header da conversa */}
            <div>
              <div className="mp-thread-header">
                <div className="mp-thread-header-info">
                  <div className="mp-thread-header-name">
                    {selectedStudent ? selectedStudent.name : "Selecione uma conversa"}
                  </div>
                  <div className="mp-thread-header-sub">
                    {selectedStudent ? (
                      <>
                        {phoneFormatted ? (
                          <span className="mp-phone-badge">
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.42"/>
                            </svg>
                            {phoneFormatted}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-subtle)", fontSize: 11 }}>
                            Sem telefone cadastrado
                          </span>
                        )}
                      </>
                    ) : (
                      "Inbox → escolha um aluno para abrir"
                    )}
                  </div>
                </div>

                {selectedConv ? (
                  <span className="mp-pill">Conversa ativa</span>
                ) : (
                  <span className="mp-pill" style={{ opacity: 0.6 }}>
                    Sem conversa
                  </span>
                )}
              </div>

              {/* Context strip */}
              {studentSnapshot && selectedStudent ? (
                <div className="mp-context-strip">
                  <span>
                    Frequência (30d) <b>{studentSnapshot.adherencePct}%</b>
                  </span>
                  <span>
                    Streak <b>{studentSnapshot.streakDays}d</b>
                  </span>
                  {studentSnapshot.today.metabolism ? (
                    <span>
                      Metabolismo <b>{studentSnapshot.today.metabolism.score}</b> (
                      {studentSnapshot.today.metabolism.trend})
                    </span>
                  ) : null}
                  {daysAbsent !== null ? (
                    daysAbsent >= 5 ? (
                      <span className="absent-warn">Sem treino há {daysAbsent}d</span>
                    ) : (
                      <span>
                        Último treino{" "}
                        <b>há {daysAbsent === 0 ? "hoje" : `${daysAbsent}d`}</b>
                      </span>
                    )
                  ) : (
                    <span>Sem treino recente</span>
                  )}
                </div>
              ) : null}
            </div>

            {/* Mensagens */}
            <div className="mp-messages-area">
              {!selectedConv ? (
                <span className="mp-empty-text">
                  Abra uma conversa na coluna da esquerda para começar.
                </span>
              ) : messages.length === 0 ? (
                <span className="mp-empty-text">
                  Ainda não há mensagens. Comece a conversa por aqui.
                </span>
              ) : (
                messages.map((msg) => {
                  const mine = msg.senderRole === "personal";
                  return (
                    <div
                      key={msg.id}
                      className={`mp-bubble-row ${mine ? "mine" : "theirs"}`}
                    >
                      <div className={`mp-bubble ${mine ? "mine" : "theirs"}`}>
                        <div className="mp-bubble-text">{msg.text}</div>
                        <div className="mp-bubble-time">
                          {new Date(msg.createdAt).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            {/* Compositor */}
            <div className="mp-composer">
              {/* Chips de sugestão */}
              {selectedConv ? (
                <div className="mp-chips-row">
                  {CHIP_CATEGORIES.map(({ label, category }) => (
                    <button
                      key={category}
                      className="mp-chip"
                      disabled={!selectedConv}
                      onClick={() =>
                        applyChip(category, selectedConv?.studentName ?? "")
                      }
                      title={`Preencher com template "${label}"`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Textarea + botões */}
              <div className="mp-composer-row">
                <textarea
                  className="mp-textarea"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setActiveChipCategory(null);
                  }}
                  placeholder={
                    selectedConv
                      ? "Digite sua mensagem…"
                      : "Selecione uma conversa primeiro"
                  }
                  disabled={!selectedConv || sending}
                  rows={3}
                />

                <div className="mp-actions">
                  <button
                    className="mp-btn-send"
                    onClick={() => void handleSendMessage()}
                    disabled={!canSend}
                  >
                    {sending ? "Enviando…" : "Enviar"}
                  </button>

                  <button
                    className="mp-btn-whatsapp"
                    onClick={() => void handleSendWhatsApp()}
                    disabled={!canSendWa || !normalizePhoneToBRE164(selectedConv?.studentPhone)}
                    title={
                      !normalizePhoneToBRE164(selectedConv?.studentPhone)
                        ? "Cadastre o telefone do aluno para enviar via WhatsApp"
                        : "Abrir WhatsApp com a mensagem pré-preenchida"
                    }
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.42"/>
                    </svg>
                    WhatsApp
                  </button>
                </div>
              </div>

              {selectedConv ? (
                <div className="mp-composer-hint">
                  "Enviar" salva no chat interno.{" "}
                  {normalizePhoneToBRE164(selectedConv.studentPhone)
                    ? "\"WhatsApp\" abre o app para você revisar e enviar."
                    : "Cadastre o telefone do aluno para habilitar o WhatsApp."}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
