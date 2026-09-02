import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  findInProgressSession,
  sessaoAtiva,
  type InProgressSession,
} from "../workoutSession/inProgressSession";

/**
 * Mini-player do treino em andamento (SPEC P1 §12 · §13).
 *
 * Antes: sair da tela de treino fazia o cronômetro de descanso sumir da vista.
 * Ele não PARAVA — o `useRestTimer` trabalha com instante absoluto e o rascunho
 * guarda o `restEndsAt` —, mas ninguém conseguia vê-lo, e "não consigo ver" e
 * "parou" são a mesma coisa para quem está descansando entre séries.
 *
 * Decisão de arquitetura: o mini-player NÃO recebe estado por contexto nem por
 * provider. Ele lê o mesmo rascunho que a tela de sessão grava, e recalcula
 * tudo a partir de instantes absolutos. Isso significa que ele mostra o número
 * certo mesmo quando a tela de treino está desmontada, quando o app voltou do
 * segundo plano, ou quando o processo foi morto e reaberto — sem mover nada do
 * estado que o P0 já verificou.
 */

function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Rotas em que o mini-player não deve aparecer. */
function ehTelaDeTreino(pathname: string, rota: string): boolean {
  return pathname.startsWith(rota) || pathname.startsWith("/app/user/movement-lab");
}

export function WorkoutMiniPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessao, setSessao] = useState<InProgressSession | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const reler = useCallback(() => setSessao(findInProgressSession()), []);

  useEffect(() => {
    reler();
    // Um tique por segundo. É barato (uma leitura de localStorage + um
    // setState) e é o que mantém o descanso honesto enquanto se navega.
    const id = window.setInterval(() => {
      setAgora(Date.now());
      reler();
    }, 1000);
    const onVis = () => { if (document.visibilityState === "visible") { setAgora(Date.now()); reler(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reler]);

  if (!sessao) return null;
  if (ehTelaDeTreino(location.pathname, sessao.route)) return null;
  // Treino esquecido aberto não vira um cronômetro correndo há 14 horas no
  // rodapé — esse caso é do card de retomada (ver ResumeWorkoutCard).
  if (!sessaoAtiva(sessao, agora)) return null;

  const decorrido = Math.floor((agora - sessao.startedAt) / 1000);
  const descansoRestante =
    sessao.restEndsAt != null ? Math.ceil((sessao.restEndsAt - agora) / 1000) : 0;
  const descansando = descansoRestante > 0;

  return (
    <div className={`wmp${descansando ? " wmp--rest" : ""}`} role="status" aria-live="off">
      <button
        type="button"
        className="wmp__body"
        onClick={() => navigate(sessao.route)}
        aria-label="Voltar ao treino em andamento"
      >
        <span className="wmp__pulse" aria-hidden="true" />
        <span className="wmp__texts">
          <span className="wmp__title">Treino em andamento</span>
          <span className="wmp__meta">
            <span className="wmp__clock">{relogio(decorrido)}</span>
            {descansando ? (
              <>
                <span className="wmp__sep">·</span>
                <span className="wmp__rest">Descanso {relogio(descansoRestante)}</span>
              </>
            ) : sessao.currentExercise ? (
              <>
                <span className="wmp__sep">·</span>
                <span className="wmp__ex">{sessao.currentExercise}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className="wmp__cta">Voltar</span>
      </button>
    </div>
  );
}
