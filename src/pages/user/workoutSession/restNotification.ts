// Aviso de fim de descanso quando o app NÃO está na frente (SPEC P1 §39/§40/§41).
//
// O ponto que decide o desenho: com a tela apagada ou o app em segundo plano,
// o JavaScript congela. Um `setTimeout` para daqui a 90 segundos simplesmente
// não dispara — é a mesma limitação já registrada no CLAUDE.md para o GPS em
// background. Portanto o aviso não pode ser AGENDADO POR NÓS no momento em que
// ele deveria tocar: ele precisa ser entregue ao SISTEMA no instante em que o
// descanso começa, com a hora absoluta em que deve soar.
//
// É o que `@capacitor/local-notifications` faz: registra no AlarmManager /
// UNUserNotificationCenter e o sistema entrega mesmo com o app suspenso ou
// morto. A §40 pede exatamente isso e proíbe o contrário ("não implementar
// serviço agressivo ou workaround incompatível") — nada de foreground service,
// nada de manter a CPU acordada.
//
// Fora do app empacotado (web/PWA) o aviso só existe enquanto a aba vive: é a
// degradação honesta, e o beep + vibração do `useRestTimer` continuam sendo o
// caminho principal para quem está com a tela ligada.
//
// ## Precisão: o aviso é APROXIMADO, e isso é uma escolha
//
// A partir do Android 12 um alarme EXATO exige `SCHEDULE_EXACT_ALARM` (negada
// por padrão no Android 13+, com o usuário tendo que ir às configurações do
// sistema) ou `USE_EXACT_ALARM` — que a Play Store reserva a aplicações de
// alarme e relógio, e que um app de treino não deveria pedir. Sem elas, o
// plugin cai em `setAndAllowWhileIdle`, que o sistema pode atrasar em alguns
// minutos quando o aparelho está em Doze profundo.
//
// Aceitamos o atraso: com a tela ligada quem avisa na hora é o cronômetro da
// própria tela (beep + vibração, exatos); esta notificação é a rede de
// segurança de quem guardou o celular no bolso. Um aviso alguns minutos atrasado
// é melhor que nenhum — e pedir permissão de alarme exato para um descanso de
// 90 segundos seria justamente o "serviço agressivo" que a §40 proíbe.

import { LocalNotifications } from "@capacitor/local-notifications";
import { isNativeApp } from "../../../lib/platform";

/** Id fixo: existe no máximo um descanso por vez, então reagendar substitui. */
const ID_DESCANSO = 90_001;

let permissaoConcedida: boolean | null = null;

/**
 * Pede permissão de notificação — só quando há um descanso para avisar.
 *
 * Nunca no boot do app: a mesma regra contextual que a P0 aplicou à câmera
 * (§13 daquela SPEC) vale aqui. Quem nunca inicia um treino nunca é
 * interrompido por um prompt de notificação.
 */
async function garantirPermissao(): Promise<boolean> {
  if (permissaoConcedida !== null) return permissaoConcedida;
  try {
    const atual = await LocalNotifications.checkPermissions();
    if (atual.display === "granted") {
      permissaoConcedida = true;
      return true;
    }
    // `denied` não vira novo pedido: o sistema não mostraria o diálogo de novo,
    // e insistir a cada série seria ruído.
    if (atual.display === "denied") {
      permissaoConcedida = false;
      return false;
    }
    const pedido = await LocalNotifications.requestPermissions();
    permissaoConcedida = pedido.display === "granted";
    return permissaoConcedida;
  } catch {
    permissaoConcedida = false;
    return false;
  }
}

/**
 * Agenda o aviso para `endsAt` (instante absoluto em ms).
 *
 * Chamar de novo substitui o agendamento anterior — é o comportamento certo
 * para "+30s" e para começar outro descanso antes do primeiro acabar.
 */
export async function agendarAvisoDescanso(endsAt: number): Promise<void> {
  if (!isNativeApp()) return;
  // Descanso que já passou (ou está a menos de um segundo) não vale um
  // agendamento: o `useRestTimer` avisa na hora, com a tela ligada.
  if (endsAt - Date.now() < 1500) return;

  try {
    if (!(await garantirPermissao())) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID_DESCANSO,
          title: "Descanso concluído",
          body: "Hora da próxima série.",
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
          // Toque leva de volta ao treino (§41). O app abre na última rota, que
          // é a da sessão — a `extra` fica para quando houver deep link próprio.
          extra: { kind: "rest_done" },
        },
      ],
    });
  } catch {
    // Sem notificação o treino segue igual — nunca propagar erro daqui.
  }
}

/** Cancela o aviso pendente (descanso pulado, encerrado ou sessão finalizada). */
export async function cancelarAvisoDescanso(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID_DESCANSO }] });
  } catch {
    /* silencioso */
  }
}

/** Exportado só para teste: zera o cache de permissão entre casos. */
export function __resetPermissaoCache(): void {
  permissaoConcedida = null;
}
