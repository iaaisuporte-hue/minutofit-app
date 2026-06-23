// Função de decisão PURA da Today Page: dado o "estado do dia" do aluno,
// retorna a ÚNICA ação primária + a copy do hero. Sem hooks, sem efeitos —
// testável isoladamente. A precedência abaixo é o coração da clareza da tela:
// um estado, uma ação. (Loop MaaS: check-in → leitura → sessão → evolução.)

export type TodayPrimaryState =
  | 'first_run'
  | 'checkin_pending'
  | 'trained'
  | 'recovery'
  | 'session'
  | 'personal_no_plan'
  | 'idle';

export type TodayCtaAction = 'open_checkin' | 'scroll_workout' | 'go_evolution' | 'go_chat';

export interface TodayPrimaryInput {
  /** Setup inicial concluído (check-in + perfil). */
  firstRunComplete: boolean;
  /** Fez o check-in de hoje. */
  checkedInToday: boolean;
  /** Já registrou um treino hoje. */
  trainedToday: boolean;
  /** Prontidão do motor adaptativo, se houver ficha do personal. */
  readinessLevel: 'green' | 'yellow' | 'red' | null;
  /** Check-in de hoje pede recuperação (tom 'recovery'). */
  recoveryByCondition: boolean;
  /** Existe uma sessão para fazer (personal, academia ou sugerida). */
  hasSession: boolean;
  /** A sessão foi adaptada pelo check-in de hoje. */
  adapted: boolean;
  /** Tem personal vinculado, mas ainda sem ficha ativa. */
  personalNoPlan: boolean;
  firstName?: string | null;
  personalName?: string | null;
}

export interface TodayPrimary {
  state: TodayPrimaryState;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaAction: TodayCtaAction;
}

/**
 * Precedência (primeira que casar vence):
 * 1. first_run        — guiar o setup antes de tudo
 * 2. checkin_pending  — o loop inteiro começa no check-in
 * 3. trained          — dia cumprido; fecha o loop na evolução
 * 4. recovery         — prontidão vermelha ou sinais de cautela
 * 5. session          — há treino para fazer (protagonista)
 * 6. personal_no_plan — personal vinculado, ficha a caminho
 * 7. idle             — check-in feito, nada pendente
 */
export function resolveTodayPrimary(input: TodayPrimaryInput): TodayPrimary {
  const name = input.firstName?.trim() || '';
  const greet = name ? `, ${name}` : '';

  if (!input.firstRunComplete) {
    return {
      state: 'first_run',
      title: `Vamos começar${greet}`,
      subtitle: 'Leia seu corpo em 30s — é daqui que sai o seu plano.',
      ctaLabel: 'Fazer meu primeiro check-in',
      ctaAction: 'open_checkin',
    };
  }

  if (!input.checkedInToday) {
    return {
      state: 'checkin_pending',
      title: 'Como seu corpo está hoje?',
      subtitle: 'Seu check-in de hoje vira a decisão de treino de hoje.',
      ctaLabel: 'Fazer o check-in de hoje',
      ctaAction: 'open_checkin',
    };
  }

  if (input.trainedToday) {
    return {
      state: 'trained',
      title: 'Dia cumprido',
      subtitle: 'Sua leitura de amanhã já considera o esforço de hoje.',
      ctaLabel: 'Ver sua evolução',
      ctaAction: 'go_evolution',
    };
  }

  if (input.readinessLevel === 'red' || input.recoveryByCondition) {
    return {
      state: 'recovery',
      title: 'Hoje é dia de recuperar',
      subtitle: 'Reduzimos a carga para proteger sua evolução.',
      ctaLabel: 'Ver seu dia de recuperação',
      ctaAction: 'scroll_workout',
    };
  }

  if (input.hasSession) {
    return {
      state: 'session',
      title: input.adapted ? 'Sua sessão, ajustada para hoje' : 'Sua sessão de hoje está pronta',
      subtitle: input.adapted
        ? 'Ajustamos pelo seu check-in — para render sem se quebrar.'
        : 'Montada a partir da sua leitura de hoje.',
      ctaLabel: input.adapted ? 'Começar — ajustado para hoje' : 'Começar a sessão de hoje',
      ctaAction: 'scroll_workout',
    };
  }

  if (input.personalNoPlan) {
    const pname = input.personalName?.trim() || '';
    return {
      state: 'personal_no_plan',
      title: pname ? `${pname} está montando seu plano` : 'Seu plano está a caminho',
      subtitle: 'Mantenha o check-in em dia — é o que alimenta a decisão dele.',
      ctaLabel: pname ? `Falar com ${pname}` : 'Falar com seu personal',
      ctaAction: 'go_chat',
    };
  }

  return {
    state: 'idle',
    title: 'Tudo certo por hoje',
    subtitle: 'Volte amanhã para a próxima leitura do seu corpo.',
    ctaLabel: 'Ver sua evolução',
    ctaAction: 'go_evolution',
  };
}
