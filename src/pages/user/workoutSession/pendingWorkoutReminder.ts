// Lembrete de treino iniciado e não finalizado.
//
// ## O problema real
//
// O rascunho da sessão (`sessionDraft.ts`) já sobrevive a minimizar, ao processo
// morrer e ao aparelho reiniciar, e o `ResumeWorkoutCard` já oferece "Continuar"
// a quem reabre o app. Falta o caso em que a pessoa NÃO reabre o app: começou o
// treino, foi atender alguém, guardou o celular. O treino fica aberto, as séries
// lançadas nunca entram no histórico, e nada avisa.
//
// ## Por que notificação do SISTEMA, e não um timer nosso
//
// Com a tela apagada ou o app em segundo plano o JavaScript congela — a mesma
// limitação já registrada para o GPS em background e para o aviso de descanso
// (`restNotification.ts`). Um `setTimeout` para daqui a 45 minutos simplesmente
// não dispara. O lembrete precisa ser ENTREGUE AO SISTEMA no instante da última
// atividade, com a hora absoluta em que deve soar; `@capacitor/local-notifications`
// registra no AlarmManager / UNUserNotificationCenter e o sistema entrega mesmo
// com o app suspenso ou morto.
//
// Consequência direta: não existe polling, não existe background worker, e a
// contagem de "quanto tempo parado" nunca é feita por nós.
//
// ## Exatamente dois lembretes, e nunca mais
//
// 45 minutos e 2 horas depois da última atividade real. Não há terceiro, não há
// repetição e não há recorrência: o objetivo é lembrar de fechar um treino, não
// disputar a atenção de ninguém — o pacto de dados do produto é explícito em não
// explorar atenção, e uma notificação insistente é o oposto disso.
//
// ## Precisão: aproximada, e é uma escolha
//
// Do Android 12 em diante um alarme EXATO exige `SCHEDULE_EXACT_ALARM` (negada
// por padrão no 13+) ou `USE_EXACT_ALARM`, que a Play Store reserva a apps de
// alarme e relógio. Sem elas o plugin usa `setAndAllowWhileIdle`, que o sistema
// pode atrasar alguns minutos em Doze profundo. Para um lembrete de 45 minutos
// o atraso é irrelevante — e pedir permissão de alarme exato para isto seria
// desproporcional.

import { LocalNotifications } from "@capacitor/local-notifications";
import { isNativeApp } from "../../../lib/platform";
import { montarDeepLink } from "../../../lib/deepLinks";
import { garantirPermissaoNotificacao } from "./notificationPermission";

/** Primeiro lembrete: 45 min sem atividade relevante. */
export const ATRASO_LEMBRETE_1_MS = 45 * 60 * 1000;
/** Segundo e ÚLTIMO lembrete: 2 h sem atividade relevante. */
export const ATRASO_LEMBRETE_2_MS = 2 * 60 * 60 * 1000;

/**
 * Faixa de ids reservada a estes lembretes.
 *
 * Ids fixos (1, 2) colidiriam entre sessões: o cancelamento de um treino
 * apagaria o lembrete de outro, e reagendar sobrescreveria o alheio. A faixa
 * própria permite duas coisas — derivar o id da sessão (determinístico, então
 * reagendar SUBSTITUI o lembrete certo) e varrer só o que é nosso ao cancelar,
 * sem tocar no aviso de descanso (90_001) nem em notificação de terceiros.
 */
const BASE_ID = 92_000_000;
const SLOTS = 500_000;

/** Identidade da sessão em execução — o que distingue um treino do outro. */
export interface SessaoLembrete {
  mode: "plan" | "free";
  planId: number | null;
  dayIndex: number | null;
}

/** Chave estável da sessão. Mesma granularidade da chave do rascunho. */
export function chaveSessao(s: SessaoLembrete): string {
  return s.mode === "free" ? "free" : `${s.planId}:${s.dayIndex}`;
}

/** FNV-1a 32 bits — só precisa ser determinístico e bem distribuído. */
function hash32(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Os dois ids desta sessão. Determinísticos: reagendar substitui, não soma. */
export function idsLembrete(chave: string): { primeiro: number; segundo: number } {
  const slot = hash32(chave) % SLOTS;
  return { primeiro: BASE_ID + slot * 2, segundo: BASE_ID + slot * 2 + 1 };
}

/** O id pertence a esta feature? Usado na varredura de cancelamento. */
export function ehIdDeLembrete(id: number): boolean {
  return id >= BASE_ID && id < BASE_ID + SLOTS * 2;
}

/**
 * Deep link que reabre ESTA sessão.
 *
 * Reusa a tradução única do app (`deepLinks.ts`) em vez de guardar uma rota
 * crua no `extra`: a rota que volta de uma notificação vem de fora do processo
 * e passa pela mesma allow-list de qualquer outro link externo.
 */
export function linkDaSessao(s: SessaoLembrete): string {
  const caminho =
    s.mode === "free" ? "workout/free/session" : `workout/session/${s.planId}/${s.dayIndex}`;
  return montarDeepLink(caminho, "notificacao");
}

/** Um lembrete a agendar: qual dos dois, e o instante absoluto em que soa. */
export interface LembretePlanejado {
  ordem: 1 | 2;
  id: number;
  at: number;
}

/**
 * Decide o que ainda faz sentido agendar — função pura, sem Capacitor, para
 * que a regra de tempo seja testável sem simular o sistema operacional.
 *
 * Lembrete cujo instante já passou não é agendado: reagendar depois de uma
 * atividade tardia não deve fazer o primeiro lembrete "soar atrasado". É o que
 * garante o caso do enunciado — interagir aos 40 min move o lembrete de 45 para
 * 40+45, em vez de dispará-lo cinco minutos depois.
 */
export function planejarLembretes(
  chave: string,
  lastActivityAt: number,
  agora: number,
): LembretePlanejado[] {
  const { primeiro, segundo } = idsLembrete(chave);
  const candidatos: LembretePlanejado[] = [
    { ordem: 1, id: primeiro, at: lastActivityAt + ATRASO_LEMBRETE_1_MS },
    { ordem: 2, id: segundo, at: lastActivityAt + ATRASO_LEMBRETE_2_MS },
  ];
  // Margem de um segundo: agendar para "agora" é entregar ao sistema algo que
  // ele pode disparar antes de a chamada terminar.
  return candidatos.filter((c) => c.at - agora > 1000);
}

/**
 * Texto das duas notificações.
 *
 * Curto por obrigação, não por estilo: a bandeja recolhida do Android mostra
 * cerca de 40 caracteres do corpo numa linha só. Numa primeira versão o CTA do
 * segundo lembrete estava no FIM da frase e era cortado — a pessoa lia a
 * consequência pela metade e nunca a ação. Agora a ação vem primeiro nos dois.
 *
 * O tom é o do produto: pergunta e convite, nunca cobrança, contagem de dias
 * perdidos ou culpa. "Finalizar" é o verbo do botão que a pessoa vai encontrar
 * na tela de destino, então a promessa da notificação é cumprida lá.
 */
const TEXTO: Record<1 | 2, { title: string; body: string }> = {
  1: {
    title: "Seu treino continua aberto",
    body: "Toque para voltar de onde parou.",
  },
  2: {
    title: "Você terminou o treino de hoje?",
    body: "Toque para finalizar — sem isso ele não entra no histórico.",
  },
};

// ── Preferência do usuário ──────────────────────────────────────────────────
// Local ao aparelho, como o tema: o lembrete é entregue pelo sistema DESTE
// aparelho, então a escolha pertence a ele. Não vale uma coluna no servidor.

export const CHAVE_PREF_LEMBRETE = "s2core:notif:workout-reminder";

/** Ligado por padrão — só desligado por escolha explícita. */
export function lembretesAtivados(): boolean {
  try {
    return localStorage.getItem(CHAVE_PREF_LEMBRETE) !== "off";
  } catch {
    return true;
  }
}

export function definirLembretesAtivados(ativo: boolean): void {
  try {
    localStorage.setItem(CHAVE_PREF_LEMBRETE, ativo ? "on" : "off");
  } catch {
    /* modo privado: a preferência simplesmente não persiste */
  }
}

/**
 * Cancela TODOS os lembretes de treino pendentes neste aparelho.
 *
 * Varre os pendentes em vez de cancelar dois ids conhecidos, e isso é
 * deliberado: garante que um treino concluído nunca receba lembrete, mesmo que
 * o pendente tenha sido agendado por uma execução anterior cuja chave a tela
 * atual não conhece (o caso 7 do enunciado). O aviso de descanso e qualquer
 * notificação de terceiros ficam de fora — a faixa de ids é só nossa.
 */
export async function cancelarLembretesTreino(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const pendentes = await LocalNotifications.getPending();
    const nossos = (pendentes?.notifications ?? []).filter((n) => ehIdDeLembrete(Number(n.id)));
    if (!nossos.length) return;
    await LocalNotifications.cancel({ notifications: nossos.map((n) => ({ id: Number(n.id) })) });
  } catch {
    /* sem cancelamento o pior caso é um lembrete a mais — nunca propagar erro */
  }
}

/**
 * (Re)agenda os lembretes desta sessão a partir da última atividade relevante.
 *
 * Sempre cancela antes de agendar. Só existe um treino em execução por vez, e
 * varrer garante que uma sessão anterior não deixe lembrete órfão — o preço é
 * que abrir um treino livre cancela o lembrete de um prescrito esquecido, o que
 * é o comportamento certo: quem está treinando agora não precisa ser lembrado
 * do treino de antes enquanto treina.
 *
 * Devolve quantos lembretes ficaram agendados (0 fora do app empacotado, sem
 * permissão, ou com a preferência desligada) — é o que permite ao chamador
 * instrumentar sem duplicar a regra.
 */
export async function agendarLembretesTreino(
  sessao: SessaoLembrete,
  lastActivityAt: number,
): Promise<number> {
  if (!isNativeApp()) return 0;
  if (!lembretesAtivados()) {
    // Pode ter sido desligado com lembretes já no sistema.
    await cancelarLembretesTreino();
    return 0;
  }

  const chave = chaveSessao(sessao);
  const planejados = planejarLembretes(chave, lastActivityAt, Date.now());
  await cancelarLembretesTreino();
  if (!planejados.length) return 0;

  try {
    if (!(await garantirPermissaoNotificacao())) return 0;
    const link = linkDaSessao(sessao);
    await LocalNotifications.schedule({
      notifications: planejados.map((p) => ({
        id: p.id,
        title: TEXTO[p.ordem].title,
        body: TEXTO[p.ordem].body,
        schedule: { at: new Date(p.at), allowWhileIdle: true },
        // O toque precisa levar de volta À SESSÃO, não à última tela aberta:
        // quem foi lembrado depois de horas provavelmente não tem mais o app
        // vivo, e abrir na Hoje devolveria o mesmo problema que o lembrete veio
        // resolver. O link passa pela allow-list de `deepLinks.ts`.
        extra: { kind: "workout_pending", link },
      })),
    });
    return planejados.length;
  } catch {
    return 0;
  }
}

/**
 * Escuta o toque em um lembrete e entrega o link para quem sabe navegar.
 *
 * Fica aqui (e não na ponte nativa) para que a ponte não precise conhecer o
 * plugin de notificação nem o formato do `extra`. O aviso de descanso não traz
 * `link` e por isso não é afetado: continua apenas trazendo o app para a frente.
 */
export async function escutarToqueDeLembrete(
  aoAbrir: (link: string) => void,
): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  try {
    const handle = await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (evento) => {
        const extra = evento?.notification?.extra as { kind?: string; link?: string } | undefined;
        if (extra?.kind !== "workout_pending" || typeof extra.link !== "string") return;
        aoAbrir(extra.link);
      },
    );
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}
