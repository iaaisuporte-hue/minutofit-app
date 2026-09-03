import { authFetch } from "../../services/apiClient";
import { API_URL } from "../../services/apiBase";

/**
 * Instrumentação da camada de atividade (SPEC Mobile P2 §70/§71).
 *
 * Mesmo canal do resto do app: `POST /user/events` → allow-list no backend →
 * `data_access_audit`. Nenhum SDK novo.
 *
 * ## A regra que manda aqui
 *
 * A §70 é literal: **"não mandar coordenadas para analytics"**. E a regra é
 * maior que ela — rota de exercício revela casa, trabalho e rotina, e é o dado
 * mais sensível que esta fase introduz. Por isso o payload é um tipo FECHADO,
 * sem campo livre: não existe caminho pelo qual uma coordenada, um endereço ou
 * um horário exato de partida entre num evento, nem por descuido de quem
 * acrescentar um evento novo depois.
 *
 * O que sai daqui: tipo de atividade, duração arredondada, faixa de distância,
 * origem e se houve rota — o suficiente para as perguntas do §71 e nada além.
 */
export type ActivityEventType =
  | "activity.started"
  | "activity.paused"
  | "activity.resumed"
  | "activity.completed"
  | "activity.abandoned"
  | "activity.recovered"
  | "activity.discarded"
  | "activity.gps_denied"
  | "activity.share_opened"
  | "health_connect.connected"
  | "apple_health.connected"
  | "widget.workout_started";

/**
 * Campos permitidos. Fechado de propósito — ver o bloco acima.
 *
 * `distanceBand` em vez de distância exata: a faixa responde "que tipo de
 * atividade as pessoas fazem" sem que o conjunto de eventos permita
 * reconstruir o percurso de alguém por agregação.
 */
export interface ActivityEventPayload {
  activityType?: "walk" | "run" | "cycling";
  /** Duração em minutos, arredondada. */
  durationMin?: number;
  /** Faixa de distância, nunca o valor exato. */
  distanceBand?: "0" | "0-1km" | "1-5km" | "5-10km" | "10km+";
  source?: "s2core" | "health_connect" | "apple_health" | "import";
  /** A atividade tem rota gravada? (booleano — jamais a rota) */
  hasRoute?: boolean;
  /** Pontos descartados pelo filtro — diagnóstico de qualidade do sinal. */
  discardedPoints?: number;
  /** Concluída sem rede e pendente de sincronização. */
  offline?: boolean;
}

/** Converte distância em faixa. A única forma de distância que sai daqui. */
export function faixaDeDistancia(km: number): NonNullable<ActivityEventPayload["distanceBand"]> {
  if (!Number.isFinite(km) || km <= 0) return "0";
  if (km < 1) return "0-1km";
  if (km < 5) return "1-5km";
  if (km < 10) return "5-10km";
  return "10km+";
}

export function postActivityEvent(
  eventType: ActivityEventType,
  payload: ActivityEventPayload = {},
): void {
  authFetch(`${API_URL}/user/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, payload }),
  }).catch(() => {
    /* best-effort: analytics nunca atrapalha quem está treinando */
  });
}
