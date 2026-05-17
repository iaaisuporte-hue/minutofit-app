import { useCallback, useEffect, useState } from 'react';
import { fetchChatConversations, type ChatConversation } from '../../services/messagesApi';

interface Options {
  /**
   * Quando false, o hook não dispara fetch e retorna estado vazio.
   * Necessário porque /api/messages/* tem gate por feature `messages` —
   * disparar sem feature gera 403/redirect indesejado.
   */
  enabled?: boolean;
}

/**
 * Busca a conversa cuja última mensagem não lida foi enviada por um
 * profissional (personal, nutri ou admin) — não pela própria pessoa.
 * Retorna apenas a conversa mais recente; se houver várias, prioriza a
 * de timestamp mais recente.
 */
export function useLatestUnreadFromProfessional({ enabled = true }: Options = {}) {
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setConversation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await fetchChatConversations();
      const fromPro = all
        .filter(
          (c) =>
            c.unreadCount > 0 &&
            c.lastMessage != null &&
            c.lastMessage.senderRole !== 'user'
        )
        .sort((a, b) => {
          const tA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const tB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return tB - tA;
        });
      setConversation(fromPro[0] ?? null);
    } catch {
      // sem rede, sem feature, ou conversa indisponível — não mostra popup
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** Marca esta conversa como vista, esconde no estado local imediatamente. */
  const dismissLocally = useCallback(() => {
    setConversation(null);
  }, []);

  return { conversation, loading, refetch, dismissLocally };
}
