// Permissão de notificação local — ponto único do app (Tracker outdoor,
// descanso de treino e lembrete de treino não finalizado).
//
// Extraído de `restNotification.ts` quando o lembrete de treino não finalizado
// passou a precisar da mesma permissão. Compartilhar importa por causa de uma
// corrida real: com dois chamadores concorrentes, o primeiro a receber
// `prompt` pediria, o segundo não saberia do pedido em andamento e pediria de
// novo — dois diálogos do sistema abertos ao mesmo tempo.
//
// ## Por que NÃO é um cache do RESULTADO (bug corrigido em set/2026)
//
// A versão anterior guardava a RESPOSTA (concedida/negada) para sempre, pelo
// resto do processo. Isso quebrou de um jeito concreto: a pessoa negou a
// notificação em algum momento da sessão (ex.: ao testar o Tracker logo após
// instalar, antes de conceder localização/notificação), o valor `false` ficava
// travado, e o lembrete de treino — que já tinha funcionado antes, em outra
// sessão — parava de agendar em SILÊNCIO, mesmo que a pessoa fosse até
// Configurações e reativasse a notificação manualmente: nada no app voltava a
// checar o sistema operacional até o processo (o app) ser fechado e reaberto
// de verdade, não só minimizado.
//
// A correção é reconsultar o SISTEMA a cada chamada — `checkPermissions()` é
// local e instantâneo, sem diálogo, então não há custo em nunca confiar num
// valor antigo. O que precisa de proteção contra duplicidade é só a CHAMADA
// EM ANDAMENTO (a promise viva), não o resultado depois de resolvida — por
// isso a variável abaixo guarda a promise, não o boolean.
//
// A política de UX não mudou: nunca no boot, só quando existe algo concreto
// para avisar, e `denied` nunca vira um pedido novo (o sistema não abriria o
// diálogo de novo mesmo que pedíssemos, e insistir a cada série seria ruído).

import { LocalNotifications } from "@capacitor/local-notifications";

let emAndamento: Promise<boolean> | null = null;

/**
 * Garante permissão de notificação local. Sempre reflete o estado ATUAL do
 * sistema (nunca uma resposta congelada de uma chamada anterior); a única
 * coisa compartilhada entre chamadas é a checagem/pedido EM ANDAMENTO, para
 * duas chamadas simultâneas não abrirem dois diálogos.
 */
export async function garantirPermissaoNotificacao(): Promise<boolean> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    try {
      const atual = await LocalNotifications.checkPermissions();
      if (atual.display === "granted") return true;
      if (atual.display === "denied") return false;
      const pedido = await LocalNotifications.requestPermissions();
      return pedido.display === "granted";
    } catch {
      return false;
    }
  })();
  try {
    return await emAndamento;
  } finally {
    emAndamento = null;
  }
}

/** Exportado só para teste: garante que nenhuma chamada anterior ficou presa. */
export function __resetPermissaoCache(): void {
  emAndamento = null;
}

/**
 * Só CONSULTA a permissão — nunca abre o diálogo do sistema.
 *
 * Existe para a tela de preferências poder dizer a verdade: com a permissão
 * negada no aparelho, um controle marcado "Ativado" que nunca entrega nada é
 * uma falha silenciosa. Pedir ali seria justamente o prompt fora de contexto
 * que a política acima proíbe, então a tela informa em vez de insistir.
 */
export async function notificacaoPermitida(): Promise<boolean> {
  try {
    const atual = await LocalNotifications.checkPermissions();
    return atual.display === "granted";
  } catch {
    return false;
  }
}
