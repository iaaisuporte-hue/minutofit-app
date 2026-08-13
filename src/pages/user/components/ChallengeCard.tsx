import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag } from "lucide-react";
import {
  getActiveChallenge,
  type ChallengeSummary,
  type MyChallengeProgress,
} from "../../../features/performance/performanceApi";
// O CSS precisa vir COM o componente: a tela Hoje não importa o do detalhe, e
// um estilo que só existe na outra rota é o defeito de "arquivo criado e nunca
// importado" que já custou um falso verde neste repositório.
import "../../../features/performance/challenges.css";

/**
 * Card do desafio em curso, na tela Hoje (Spec 034, C2).
 *
 * Mostra SÓ o próprio progresso. Não há percentual, nome nem posição de outro
 * participante — nem aqui, nem na API que alimenta este card.
 *
 * Some quando não há desafio: um card vazio dizendo "nenhum desafio" ocuparia
 * a tela mais visitada do produto para não informar nada.
 */
export function ChallengeCard() {
  const [data, setData] = useState<(ChallengeSummary & { myProgress: MyChallengeProgress }) | null>(
    null,
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void getActiveChallenge(ctrl.signal).then((res) => {
      if (!ctrl.signal.aborted) setData(res);
    });
    return () => ctrl.abort();
  }, []);

  if (!data) return null;

  const { pct, weeksDone, weeksRequired } = data.myProgress;
  const concluido = data.myStatus === "completed";
  const convite = data.myStatus === "invited";

  return (
    <Link to={`/app/user/desafios/${data.id}`} className="ch-card">
      <header className="ch-card-head">
        <Flag size={18} className="ch-card-icon" aria-hidden="true" />
        <span className="ch-card-title">{data.title}</span>
      </header>

      <p className="ch-card-rule">{data.ruleText}</p>

      {/* O convite é a única porta de entrada do desafio no app: sem este
          estado aqui, o aluno nunca ficaria sabendo que foi convidado. */}
      {convite ? (
        <p className="ch-card-hint">
          {data.invitedByName
            ? `${data.invitedByName} convidou você. Toque para ver os detalhes.`
            : "Seu personal convidou você. Toque para ver os detalhes."}
        </p>
      ) : pct == null ? (
        <p className="ch-card-hint">
          {data.myProgress.blockedReason === "no_target"
            ? "Defina uma meta de frequência semanal para acompanhar seu progresso."
            : "Seu progresso aparece assim que houver dados suficientes."}
        </p>
      ) : (
        <>
          <div
            className="ch-bar"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Seu progresso no desafio"
          >
            <div className={`ch-bar-fill${concluido ? " is-done" : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="ch-card-hint">
            {concluido
              ? "Você concluiu este desafio."
              : `${weeksDone} de ${weeksRequired} ${weeksRequired === 1 ? "semana" : "semanas"}.`}
          </p>
        </>
      )}
    </Link>
  );
}
