import { useState, useEffect } from "react";
import { X, Send, BookMarked } from "lucide-react";
import {
  listMessageTemplates,
  type MessageTemplate,
} from "../../services/personalRetentionApi";
import { ensureChatConversation, sendChatMessage } from "../../services/messagesApi";
import { createRelationshipAction } from "../../services/personalRetentionApi";

type Props = {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onSent?: () => void;
};

export function QuickMessageModal({ studentId, studentName, onClose, onSent }: Props) {
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

  // Escape fecha (ARIA dialog padrão).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function selectTemplate(t: MessageTemplate) {
    setSelectedTemplate(t);
    setBody(t.body.replace(/\[nome\]/gi, studentName));
  }

  async function handleSend() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      const conv = await ensureChatConversation({ studentId });
      if (!conv) throw new Error("Não foi possível abrir a conversa");
      await sendChatMessage(conv.id, text);
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
      });
      onSent?.();
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro ao registrar");
      setSending(false);
    }
  }

  return (
    <div className="pp-quick-msg-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-quick-msg-modal">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="pp-quick-msg-title">Mensagem para {studentName}</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {templates.length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 6px" }}>
              Modelos de mensagem
            </p>
            <div className="pp-template-chips">
              {templates.slice(0, 6).map((t) => (
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
      </div>
    </div>
  );
}
