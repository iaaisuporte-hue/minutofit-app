import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  markChatConversationRead,
  type ChatConversation,
  type ChatSenderRole,
} from '../../services/messagesApi';

interface Props {
  conversation: ChatConversation;
  /** Esconder localmente após dismiss/abrir, antes do refetch eventual. */
  onDismiss?: () => void;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

function senderLabel(role: ChatSenderRole): string {
  if (role === 'personal') return 'personal';
  if (role === 'nutri') return 'nutricionista';
  if (role === 'admin') return 'administrador';
  return 'profissional';
}

/**
 * Banner descartável no topo da TodayPage com a última mensagem não lida
 * de um profissional. Tanto o X (dispensar) quanto "Abrir conversa" chamam
 * mark-as-read — não reaparece no próximo login pois o backend persiste a
 * marca de lida (cross-device).
 *
 * Tom MaaS: conteúdo é voz humana real, não notificação algorítmica;
 * descarte é trivial; sem badges agressivos; sem urgência fabricada.
 */
export function IncomingMessageBanner({ conversation, onDismiss }: Props) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const lastMsg = conversation.lastMessage;
  if (!lastMsg) return null;

  async function markAndHide() {
    setVisible(false);
    onDismiss?.();
    try {
      await markChatConversationRead(conversation.id);
    } catch {
      // best-effort; se falhar, próximo refetch traz de volta — comportamento aceitável
    }
  }

  async function handleOpen() {
    await markAndHide();
    navigate('/app/user/messages');
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -12, height: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-accent-border)',
              borderRadius: 16,
              padding: 16,
              boxShadow: 'var(--shadow-md)',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-accent-hover)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}
                >
                  Mensagem do seu {senderLabel(lastMsg.senderRole)}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: 'var(--color-text)',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {lastMsg.text}
                </p>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {conversation.personalName} · {formatRelative(lastMsg.createdAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={markAndHide}
                aria-label="Dispensar mensagem"
                style={{
                  flexShrink: 0,
                  padding: '2px 10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  fontSize: 22,
                  lineHeight: 1,
                  fontWeight: 400,
                }}
              >
                ×
              </button>
            </div>
            <button
              type="button"
              onClick={handleOpen}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                background: 'var(--gradient-primary)',
                color: 'var(--color-white)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Abrir conversa →
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
