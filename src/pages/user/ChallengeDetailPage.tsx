import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Flag, ShieldCheck } from "lucide-react";
import {
  getChallengeDetail,
  joinChallenge,
  leaveChallenge,
  type ChallengeDetail,
} from "../../features/performance/performanceApi";
import "../../features/performance/challenges.css";

/**
 * Detalhe do desafio (Spec 034, C2).
 *
 * Duas telas no mesmo lugar, conforme o estado:
 *
 * - **Convite**: antes de aceitar, o aluno lê quem convidou, o objetivo, a
 *   duração, COMO o progresso é medido e o que os outros vão ver. Aceitar é o
 *   consentimento, e consentimento precisa ser informado — um botão "Aceitar"
 *   sozinho não é consentimento, é um clique.
 * - **Acompanhamento**: o próprio progresso e as faixas agregadas, quando
 *   existirem. Nunca o percentual, o nome ou a posição de outra pessoa.
 */
function formatDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function ChallengeDetailPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!challengeId) return;
      const res = await getChallengeDetail(challengeId, signal);
      if (signal?.aborted) return;
      setData(res);
      setFailed(res == null);
      setLoading(false);
    },
    [challengeId],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const agir = useCallback(
    async (acao: "join" | "leave") => {
      if (!challengeId || acting) return;
      setActing(true);
      setActionError(null);
      const res = acao === "join" ? await joinChallenge(challengeId) : await leaveChallenge(challengeId);
      setActing(false);
      if (!res.ok) {
        setActionError(res.error ?? "Não foi possível concluir.");
        return;
      }
      await load();
    },
    [challengeId, acting, load],
  );

  if (loading) {
    return (
      <p className="perf-soon-copy" role="status">
        Carregando o desafio…
      </p>
    );
  }

  if (failed || !data) {
    // O cliente devolve `null` tanto para 404 quanto para falha de rede, então
    // a copy não pode afirmar que o desafio não existe — seria acusar o
    // usuário de um erro que é do túnel.
    return (
      <section className="perf-soon">
        <span className="perf-soon-title">Não foi possível abrir o desafio</span>
        <p className="perf-soon-copy">
          Pode ser a conexão, ou o desafio pode ter sido cancelado.
        </p>
        <div className="ch-actions">
          <button type="button" className="btn btn-primary" onClick={() => void load()}>
            Tentar novamente
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Voltar
          </button>
        </div>
      </section>
    );
  }

  const { challenge, myStatus, myProgress, participantsCount, bands } = data;
  const convite = myStatus === "invited";

  return (
    <div className="ch-page">
      <button type="button" className="ch-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} aria-hidden="true" />
        Voltar
      </button>

      <header className="ch-header">
        <Flag size={22} className="ch-card-icon" aria-hidden="true" />
        <h1 className="ch-title">{challenge.title}</h1>
      </header>

      {challenge.description && <p className="perf-soon-copy">{challenge.description}</p>}

      <dl className="ch-meta">
        <div>
          <dt>Período</dt>
          <dd>
            {formatDay(challenge.startsOn)} a {formatDay(challenge.endsOn)}
          </dd>
        </div>
        <div>
          <dt>Como o progresso é medido</dt>
          <dd>{challenge.ruleText}</dd>
        </div>
        <div>
          <dt>Participantes</dt>
          <dd>{participantsCount}</dd>
        </div>
      </dl>

      {convite ? (
        <section className="ch-invite">
          <h2 className="metabolic-section-title">
            {challenge.invitedByName
              ? `${challenge.invitedByName} convidou você`
              : "Seu personal convidou você"}
          </h2>
          <p className="perf-soon-copy">
            Ao entrar, seu progresso passa a ser calculado sobre a{" "}
            <strong>sua própria frequência prevista</strong> — não sobre quanto os outros treinam.
          </p>

          {/* A copy de privacidade vem ANTES do botão, e é específica: dizer
              "seus dados estão seguros" não é consentimento informado. */}
          <div className="ch-privacy">
            <ShieldCheck size={18} className="ch-privacy-icon" aria-hidden="true" />
            <p>
              Os outros participantes <strong>não verão</strong> sua carga, seu peso, sua prontidão,
              seu Progress Score nem qualquer dado de saúde. Também não verão seu percentual. O
              desafio compartilha apenas sua participação e contagens agregadas do grupo.
            </p>
            {/* Dizer só "ninguém vê seu percentual" faria o aluno concluir que
                nem o personal vê — e ele vê, como já vê os treinos. Consentimento
                informado é dizer quem vê o quê, não só quem não vê. */}
            <p>
              {challenge.invitedByName ?? "Seu personal"} acompanha seu percentual neste desafio,
              como já acompanha seus treinos. Você pode revogar esse acesso a qualquer momento nas
              suas configurações de privacidade.
            </p>
          </div>

          <div className="ch-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={acting}
              onClick={() => void agir("join")}
            >
              {acting ? "Entrando…" : "Entrar no desafio"}
            </button>
            {/* Sem recusa explícita não há escolha — só um convite pendente
                para sempre, e um personal vendo "Convidado" indefinidamente. */}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={acting}
              onClick={() => void agir("leave")}
            >
              Agora não
            </button>
          </div>
          <p className="ch-card-hint">Você pode sair quando quiser, e sua visibilidade acaba na hora.</p>
        </section>
      ) : (
        <section className="ch-progress">
          <h2 className="metabolic-section-title">Seu progresso</h2>

          {myProgress.pct == null ? (
            <p className="perf-soon-copy">
              {myProgress.blockedReason === "no_target"
                ? "Defina uma meta de frequência semanal — ou peça a frequência ao seu personal — para acompanhar seu progresso."
                : "Seu progresso aparece assim que houver dados suficientes."}
            </p>
          ) : (
            <>
              <div
                className="ch-bar"
                role="progressbar"
                aria-valuenow={myProgress.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Seu progresso no desafio"
              >
                <div
                  className={`ch-bar-fill${myStatus === "completed" ? " is-done" : ""}`}
                  style={{ width: `${myProgress.pct}%` }}
                />
              </div>
              <p className="ch-card-hint">
                {myStatus === "completed"
                  ? "Você concluiu este desafio."
                  : `${myProgress.weeksDone} de ${myProgress.weeksRequired} ${
                      myProgress.weeksRequired === 1 ? "semana" : "semanas"
                    } dentro da sua programação.`}
              </p>
            </>
          )}

          {bands ? (
            <>
              <h2 className="metabolic-section-title">Como está a turma</h2>
              <ul className="ch-bands">
                {bands.map((b) => (
                  <li key={b.band}>
                    <span className="ch-band-label">{b.label}</span>
                    <span className="ch-band-count">
                      {b.count} {b.count === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="ch-card-hint">
                Só contagens: ninguém vê o percentual de ninguém, nem quem está em cada faixa.
              </p>
            </>
          ) : (
            <p className="ch-card-hint">
              O resumo da turma aparece a partir de 5 participantes — com menos que isso, a
              contagem identificaria as pessoas.
            </p>
          )}

          {myStatus === "active" && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={acting}
              onClick={() => void agir("leave")}
            >
              {acting ? "Saindo…" : "Sair do desafio"}
            </button>
          )}
        </section>
      )}

      {actionError && (
        <p className="perf-goal-error" role="alert">
          {actionError}
        </p>
      )}
    </div>
  );
}
