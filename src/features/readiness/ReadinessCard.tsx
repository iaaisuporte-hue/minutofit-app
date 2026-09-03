import { useEffect, useState } from "react";
import {
  getReadinessToday,
  type Confidence,
  type ReadinessToday,
} from "./readinessApi";
import { postReadinessEvent } from "./readinessEvents";

/**
 * Card de prontidão na Hoje (SPEC Mobile P3 §2, §30, §31, §32).
 *
 * ## Nunca só o número
 *
 * A §2 e a §3 são o coração desta fase: o card mostra **estado, número,
 * motivos, confiança e recomendação** — e "Por quê?" abre a lista completa. Um
 * "Readiness 54" sozinho é exatamente o que a §3 chama de caixa preta.
 *
 * ## `null` é um resultado, não um erro
 *
 * Em cold start o score é `null` e o card diz "Estamos calibrando". Ele **não**
 * mostra zero, nem esconde a seção: zero seria lido como "você está péssimo", e
 * esconder faria a pessoa achar que o recurso não existe.
 *
 * ## A seção some quando a flag está desligada
 *
 * `getReadinessToday` devolve `null` no 403 do rollout (§74/§75) e o card não
 * renderiza nada — sem mensagem de erro, porque não há erro nenhum.
 */

const CONFIANCA_LABEL: Record<Confidence, string> = {
  high: "Alta", medium: "Média", low: "Baixa",
};

const CONFIANCA_MOTIVO: Record<Confidence, string> = {
  high: "Temos dados suficientes sobre você.",
  medium: "Ainda estamos aprendendo o seu padrão.",
  low: "Poucos dados disponíveis hoje.",
};

/** Cor por estado. Tokens semânticos — nunca HEX (design system). */
function tokenDoEstado(s: ReadinessToday["state"]): string {
  if (s === "ready_intense" || s === "ready") return "var(--color-success)";
  if (s === "moderate") return "var(--color-warn)";
  if (s === "calibrating") return "var(--color-text-muted)";
  return "var(--color-danger)";
}

export function ReadinessCard({ plannedGroups }: { plannedGroups?: string[] }) {
  const [dados, setDados] = useState<ReadinessToday | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    getReadinessToday(plannedGroups)
      .then((r) => {
        if (!vivo) return;
        setDados(r);
        if (r) postReadinessEvent("readiness_viewed", { state: r.state, confidence: r.confidence, mode: r.mode });
      })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannedGroups?.join(",")]);

  // Flag off, sem sessão ou falha: a seção simplesmente não existe.
  if (carregando || !dados) return null;

  const cor = tokenDoEstado(dados.state);
  const negativos = dados.reasons.filter((r) => r.direction === "negative");
  const positivos = dados.reasons.filter((r) => r.direction === "positive");
  const parciais = dados.muscleRecovery.filter((m) => m.state !== "recovered");

  return (
    <section className="rdn" aria-labelledby="rdn-title">
      <div className="rdn__head">
        <div className="rdn__texts">
          <span className="rdn__eyebrow">Como você está hoje?</span>
          <h2 id="rdn-title" className="rdn__headline" style={{ color: cor }}>
            {dados.headline}
          </h2>
        </div>

        {/* Score. `null` vira "—" e nunca 0: a diferença entre "não sei" e
            "você está mal" é o ponto todo da §11. */}
        <div className="rdn__score" aria-label={dados.score == null ? "Prontidão ainda calibrando" : `Prontidão ${dados.score} de 100`}>
          <span className="rdn__score-value" style={{ color: cor }}>
            {dados.score == null ? "—" : dados.score}
          </span>
          {dados.score != null && <span className="rdn__score-max">/100</span>}
        </div>
      </div>

      <p className="rdn__microcopy">{dados.microcopy}</p>

      {/* Confiança é campo SEPARADO do score (§9): 69 com confiança alta e 69
          com confiança baixa significam coisas diferentes. */}
      <div className="rdn__meta">
        <span className="rdn__confidence" title={CONFIANCA_MOTIVO[dados.confidence]}>
          Confiança: <strong>{CONFIANCA_LABEL[dados.confidence]}</strong>
        </span>
        <button
          type="button"
          className="rdn__why"
          aria-expanded={aberto}
          onClick={() => {
            const proximo = !aberto;
            setAberto(proximo);
            if (proximo) postReadinessEvent("readiness_details_opened", { state: dados.state });
          }}
        >
          Por quê?
        </button>
      </div>

      {aberto && (
        <div className="rdn__why-panel">
          <p className="rdn__why-intro">Sua prontidão de hoje foi influenciada por:</p>
          <ul className="rdn__reasons">
            {negativos.map((r) => (
              <li key={r.id} className="rdn__reason rdn__reason--neg">
                <span aria-hidden="true">−</span> {r.label}
              </li>
            ))}
            {positivos.map((r) => (
              <li key={r.id} className="rdn__reason rdn__reason--pos">
                <span aria-hidden="true">+</span> {r.label}
              </li>
            ))}
            {negativos.length === 0 && positivos.length === 0 && (
              <li className="rdn__reason">Sinais dentro do esperado.</li>
            )}
          </ul>

          {/* Recuperação por grupo (§29): mais útil que um número só. */}
          {parciais.length > 0 && (
            <>
              <p className="rdn__why-intro">Recuperação muscular:</p>
              <ul className="rdn__muscles">
                {parciais.slice(0, 5).map((m) => (
                  <li key={m.group} className="rdn__muscle">
                    <span className="rdn__muscle-name">{m.label}</span>
                    <span className="rdn__muscle-bar" aria-hidden="true">
                      <span className="rdn__muscle-fill" style={{ width: `${m.recovery}%` }} />
                    </span>
                    <span className="rdn__muscle-pct">{m.recovery}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="rdn__confidence-why">
            {CONFIANCA_MOTIVO[dados.confidence]}
            {dados.mode !== "established" && " Quanto mais você usar, melhor fica a leitura."}
          </p>

          {/* §52 — limite de responsabilidade, em linguagem de bem-estar. */}
          <p className="rdn__disclaimer">
            Estas informações têm caráter de orientação de bem-estar e treino e não substituem
            avaliação profissional.
          </p>
        </div>
      )}
    </section>
  );
}
