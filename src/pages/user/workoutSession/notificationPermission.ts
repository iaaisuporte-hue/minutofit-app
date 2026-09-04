// Permissão de notificação local — ponto único do app de treino.
//
// Extraído de `restNotification.ts` quando o lembrete de treino não finalizado
// passou a precisar da mesma permissão. Compartilhar importa: com dois módulos
// guardando o próprio cache, o primeiro a receber `prompt` pediria, o segundo
// não saberia do resultado e pediria de novo — dois diálogos do sistema na
// mesma sessão de treino, que é exatamente o pedido agressivo que a §13 da P0
// e a regra "não solicitar permissão de forma agressiva" proíbem.
//
// A política em si não mudou: nunca no boot, só quando existe algo concreto
// para avisar, e `denied` nunca vira um segundo pedido (o sistema não mostraria
// o diálogo de novo e insistir a cada série seria ruído).

import { LocalNotifications } from "@capacitor/local-notifications";

let permissaoConcedida: boolean | null = null;

/**
 * Garante permissão de notificação local, pedindo no máximo uma vez por
 * processo. Devolve `false` — nunca lança — quando não há permissão: o treino
 * continua igual sem notificação nenhuma.
 */
export async function garantirPermissaoNotificacao(): Promise<boolean> {
  if (permissaoConcedida !== null) return permissaoConcedida;
  try {
    const atual = await LocalNotifications.checkPermissions();
    if (atual.display === "granted") {
      permissaoConcedida = true;
      return true;
    }
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

/** Exportado só para teste: zera o cache de permissão entre casos. */
export function __resetPermissaoCache(): void {
  permissaoConcedida = null;
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
