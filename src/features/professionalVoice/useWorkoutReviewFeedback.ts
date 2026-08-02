import { useEffect, useState } from 'react';
import { API_URL, parseJson } from '../../services/apiBase';
import { authFetch } from '../../services/apiClient';

/**
 * Feedback de revisão que o personal escreveu PARA o aluno.
 *
 * Até o QA de 02/ago/2026 (P1-5) esse texto não tinha caminho de volta: o
 * personal preenchia `studentFeedback` ao aprovar a revisão e a mensagem
 * ficava só na tela dele. Aqui ela finalmente chega a quem era o destinatário.
 */
export interface WorkoutReviewFeedback {
  id: string;
  title: string;
  goal: string;
  /** `changes_requested` = ficha devolvida com ajustes; `approved` = liberada. */
  status: 'approved' | 'changes_requested';
  studentFeedback: string;
  personalName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export function useLatestReviewFeedback(): WorkoutReviewFeedback | null {
  const [latest, setLatest] = useState<WorkoutReviewFeedback | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await authFetch(`${API_URL}/user/workout-reviews?limit=1`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || !res.ok) return;
        const payload = (await parseJson(res)) as { data?: WorkoutReviewFeedback[] };
        if (controller.signal.aborted) return;
        setLatest(payload?.data?.[0] ?? null);
      } catch {
        // Silencioso de propósito: é enriquecimento do card, não conteúdo crítico.
      }
    })();
    return () => controller.abort();
  }, []);

  return latest;
}
