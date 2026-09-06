import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import {
  discardInProgressSession,
  findInProgressSession,
  sessaoAtiva,
  type InProgressSession,
} from "../workoutSession/inProgressSession";
import { cancelarLembretesTreino } from "../workoutSession/pendingWorkoutReminder";
import { createWorkoutLiveSurface } from "../workoutSession/liveSurface/createWorkoutLiveSurface";

/**
 * Aviso de treino em andamento.
 *
 * O rascunho da sessão sempre sobreviveu ao app morrer; o que faltava era um
 * lugar onde ele aparecesse. Quem reabre o app pelo ícone cai na Hoje, não na
 * URL da sessão — e o treino ficava invisível até a pessoa navegar de volta
 * por conta própria. Este card é a porta de entrada que faltava.
 *
 * Regra deliberada: NUNCA cria sessão nova e NUNCA descarta sem confirmar. As
 * duas ações são as da SPEC — "Continuar treino" e "Encerrar treino" — e a
 * segunda passa por um diálogo que diz, com todas as letras, que o que foi
 * feito se perde.
 */
export function ResumeWorkoutCard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<InProgressSession | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const refresh = useCallback(() => setSession(findInProgressSession()), []);

  // Reavalia ao montar, ao mudar de rota e ao voltar do segundo plano — é
  // exatamente quando o estado pode ter mudado sem a tela saber.
  useEffect(() => {
    refresh();
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, location.pathname]);

  if (!session) return null;

  // Já estamos DENTRO da sessão — o aviso viraria ruído.
  if (location.pathname.startsWith(session.route)) return null;

  // Treino em curso é assunto do mini-player, que mostra cronômetro e descanso
  // em qualquer tela (P1 §13). Este card existe para o outro caso: o treino
  // que ficou aberto e esfriou — é dele que a pessoa precisa ser lembrada, com
  // espaço para explicar e a opção de encerrar (P0 §22). Sem esta linha os
  // dois apareciam na Hoje dizendo a mesma coisa em dois formatos.
  if (sessaoAtiva(session)) return null;

  const restantes = Math.max(0, session.totalSets - session.doneSets);
  const detalhe = session.currentExercise
    ? `${session.doneSets} de ${session.totalSets} séries · parou em ${session.currentExercise}`
    : `${session.doneSets} de ${session.totalSets} séries`;

  return (
    <>
      <section className="resume-workout" role="status" aria-live="polite">
        <div className="resume-workout__head">
          <span className="resume-workout__pulse" aria-hidden="true" />
          <div className="resume-workout__copy">
            <strong className="resume-workout__title">Você possui um treino em andamento.</strong>
            <span className="resume-workout__detail">{detalhe}</span>
          </div>
        </div>
        <div className="resume-workout__actions">
          <button
            type="button"
            className="resume-workout__btn resume-workout__btn--primary"
            onClick={() => navigate(session.route)}
          >
            Continuar treino
          </button>
          <button
            type="button"
            className="resume-workout__btn resume-workout__btn--ghost"
            onClick={() => setConfirmEnd(true)}
          >
            Encerrar treino
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmEnd}
        title="Encerrar o treino em andamento?"
        message={
          restantes > 0
            ? `As ${session.doneSets} série(s) já lançadas serão descartadas e não entram no seu histórico. Para salvá-las, escolha "Continuar treino" e finalize.`
            : `O treino aberto será descartado. Para salvá-lo, escolha "Continuar treino" e finalize.`
        }
        confirmLabel="Encerrar"
        cancelLabel="Voltar"
        danger
        onConfirm={() => {
          discardInProgressSession(session);
          // Encerrar aqui é fechar o treino: os lembretes pendentes daquela
          // sessão perdem o objeto e não podem tocar depois.
          void cancelarLembretesTreino();
          // Defensivo (P1E): este card descarta o treino SEM nunca montar
          // `WorkoutSessionPage` — é a porta de entrada exatamente para quem
          // reabriu o app sem voltar à tela da sessão. Se o serviço nativo
          // sobreviveu a uma morte de processo (`START_STICKY`, P1D), não há
          // NENHUM efeito React vivo para desligá-lo; sem esta chamada a
          // notificação do treino ficaria órfã. Mesmo raciocínio do descarte
          // de rascunho do Tracker outdoor (P1B).
          createWorkoutLiveSurface().parar();
          setConfirmEnd(false);
          refresh();
        }}
        onCancel={() => setConfirmEnd(false)}
      />
    </>
  );
}
