import { useState, useEffect } from "react";
import { X, Send, BookMarked } from "lucide-react";
import {
  listMessageTemplates,
  createRelationshipAction,
  type MessageTemplate,
} from "../../services/personalRetentionApi";
import { ensureChatConversation, sendChatMessage } from "../../services/messagesApi";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import { useSuggestedTemplates } from "./useSuggestedTemplates";
import type { PersonalDashboardEngagementStatus } from "../../services/personalDashboardApi";

type Props = {
  studentId: string;
  studentName: string;
  engagementStatus?: PersonalDashboardEngagementStatus | null;
  /** Abre o modal já com o template "Cobra check-in" selecionado e preenchido. */
  prefillCheckinNudge?: boolean;
  onClose: () => void;
  onSent?: () => void;
};

const CHECKIN_NUDGE_TEMPLATE: MessageTemplate = {
  id: -1,
  personalId: null,
  academyId: null,
  scope: "metacore",
  category: "cobra_checkin",
  title: "Cobra check-in",
  body: "Oi [nome]! Vi que você está sem check-in há alguns dias. Manda um update rapidinho? Me ajuda a ajustar seu treino.",
  isDefault: false,
  createdAt: "",
  updatedAt: "",
};

export function QuickMessageModal({ studentId, studentName, engagementStatus, prefillCheckinNudge, onClose, onSent }: Props) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMessageTemplates()
      .then((t) => setTemplates(t))
      .catch(() => setTemplates([]));
  }, []);

  const { suggested, rest } = useSuggestedTemplates(templates, engagementStatus);

  function selectTemplate(t: MessageTemplate) {
    setSelectedTemplate(t);
    setBody(t.body.replace(/\[nome\]/gi, studentName));
  }

  // Abertura contextual: quando o personal toca "Lembrar check-in" na linha do
  // aluno, o modal já vem com o nudge de check-in pronto para enviar (1 toque + Enviar).
  useEffect(() => {
    if (prefillCheckinNudge) selectTemplate(CHECKIN_NUDGE_TEMPLATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      const conv = await ensureChatConversation({ studentId });
      if (!conv) throw new Error("Não foi possível abrir a conversa");
      await sendChatMessage(conv.id, text);
      // Register action to close the signal loop (non-blocking if it fails)
      createRelationshipAction(studentId, {
        actionType: "message_sent",
        payloadJson: { note: text, templateCategory: selectedTemplate?.category },
        linkedSignalId: engagementStatus ?? null,
      }).catch(() => undefined);
      onSent?.();
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro ao enviar mensagem");
      setSending(false);
    }
  }

  async function handleRegisterOnly() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await createRelationshipAction(studentId, {
        actionType: "quick_nudge",
        payloadJson: { note: text, templateCategory: selectedTemplate?.category },
        linkedSignalId: engagementStatus ?? null,
      });
      onSent?.();
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro ao registrar");
      setSending(false);
    }
  }

  return (
    <DrawerShell open onClose={onClose} ariaLabel={`Mensagem para ${studentName}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 className="pp-quick-msg-title">Mensagem para {studentName}</h3>
        <button onClick={onClose} className="pp-btn pp-btn--icon pp-btn--ghost">
          <X size={18} />
        </button>
      </div>

      <div>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 6px" }}>
          Ação rápida
        </p>
        <div className="pp-template-chips">
          <button
            className={`pp-template-chip${selectedTemplate?.id === CHECKIN_NUDGE_TEMPLATE.id ? " active" : ""}`}
            onClick={() => selectTemplate(CHECKIN_NUDGE_TEMPLATE)}
          >
            {CHECKIN_NUDGE_TEMPLATE.title}
          </button>
        </div>
      </div>

      {suggested.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 6px" }}>
            Sugestão para este aluno
          </p>
          <div className="pp-template-chips">
            {suggested.map((t) => (
              <button
                key={t.id}
                className={`pp-template-chip${selectedTemplate?.id === t.id ? " active" : ""}`}
                onClick={() => selectTemplate(t)}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 6px" }}>
            {suggested.length > 0 ? "Outros modelos" : "Modelos de mensagem"}
          </p>
          <div className="pp-template-chips">
            {rest.map((t) => (
              <button
                key={t.id}
                className={`pp-template-chip${selectedTemplate?.id === t.id ? " active" : ""}`}
                onClick={() => selectTemplate(t)}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        className="pp-quick-msg-textarea"
        placeholder="Escreva sua mensagem..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus
      />

      {error && (
        <p style={{ color: "var(--color-danger)", fontSize: 12, margin: 0 }}>{error}</p>
      )}

      <div className="pp-quick-msg-actions">
        <button
          className="pp-btn pp-btn--ghost"
          onClick={handleRegisterOnly}
          disabled={sending || !body.trim()}
          title="Registrar sem enviar pelo chat"
        >
          <BookMarked size={14} />
          Registrar
        </button>
        <button
          className="pp-btn pp-btn--primary"
          onClick={handleSend}
          disabled={sending || !body.trim()}
        >
          <Send size={14} />
          {sending ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </DrawerShell>
  );
}
