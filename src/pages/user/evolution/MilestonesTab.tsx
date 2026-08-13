import { useCallback, useEffect, useId, useState } from "react";
import { AlertCircle, Check, Target } from "lucide-react";
import {
  getMilestones,
  setMilestoneShared,
  type Milestone,
} from "../../../features/performance/performanceApi";
import { postPerformanceEvent } from "../../../features/performance/performanceEvents";

/**
 * Aba Marcos (Spec 034, Onda C1).
 *
 * O objetivo é mostrar **trajetória**, não uma coleção de medalhas. Por isso:
 *
 * - os conquistados vêm primeiro, com data e a evidência resumida — o número
 *   que sustenta o marco, não um parabéns genérico;
 * - os que faltam aparecem com o **critério**, porque saber o que falta é útil;
 *   uma vitrine de cadeados sem regra seria só frustração decorativa;
 * - sem marco nenhum, a copy fala de caminho, nunca de vazio ("você não
 *   conquistou nada" é exatamente o tom que o produto proíbe);
 * - nada de confete ou animação de entrada: o realce é uma borda.
 *
 * A iconografia foge de propósito do vocabulário de jogo: `Check` para o que
 * está feito e `Target` para o que está em curso, em vez de medalha e cadeado —
 * cadeado sugere portão, e aqui não há nada trancado, só ainda não acontecido.
 */

/** Um marco vira uma linha de evidência legível, sem despejar JSON na tela. */
function evidenceLine(m: Milestone): string | null {
  const e = m.evidence;
  if (!e) return null;

  switch (m.code) {
    case "first_full_week": {
      const dias = Number(e.activeDays);
      const alvo = Number(e.targetDays);
      if (!Number.isFinite(dias) || !Number.isFinite(alvo)) return null;
      return `${dias} de ${alvo} dias previstos na semana de ${formatDay(String(e.weekStart))}.`;
    }
    case "four_consistent_weeks": {
      const semanas = Array.isArray(e.weeks) ? e.weeks.length : null;
      return semanas ? `${semanas} semanas seguidas dentro da programação.` : null;
    }
    case "ten_goals": {
      const total = Number(e.totalGoalsAchieved);
      return Number.isFinite(total) ? `${total} metas concluídas.` : null;
    }
    case "three_months_active": {
      const comAtividade = Number(e.weeksWithActivity);
      const avaliadas = Number(e.weeksEvaluated);
      if (!Number.isFinite(comAtividade)) return null;
      return `${comAtividade} das ${avaliadas} semanas avaliadas tiveram treino.`;
    }
    case "comeback": {
      const dias = Number(e.inactivityDays);
      const semanas = Number(e.weeksCompletedAfterReturn);
      if (!Number.isFinite(dias)) return null;
      return `Voltou depois de ${dias} dias e sustentou ${semanas} semanas.`;
    }
    case "first_pr":
      return "Primeiro recorde pessoal superado.";
    default:
      return null;
  }
}

/** Uma gramática de data só na tela inteira: dd/mm/aaaa. */
function formatDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDay(date.toISOString());
}

export default function MilestonesTab() {
  const [data, setData] = useState<Milestone[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /** Erro por marco: a mensagem precisa aparecer ao lado do controle que falhou. */
  const [shareError, setShareError] = useState<{ code: string; msg: string } | null>(null);
  /** Códigos com PATCH em voo — impede dois toques rápidos de se atropelarem. */
  const [pending, setPending] = useState<string[]>([]);
  const idBase = useId();

  const load = useCallback(async (signal?: AbortSignal) => {
    const res = await getMilestones(signal);
    if (signal?.aborted) return;
    if (!res) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setData(res);
    setFailed(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    setFailed(false);
    void load();
  }, [load]);

  const toggleShare = useCallback(
    async (m: Milestone) => {
      if (pending.includes(m.code)) return;
      const proximo = !m.shared;
      setShareError(null);
      setPending((cur) => [...cur, m.code]);

      // Assimetria deliberada. LIGAR pode ser otimista: o pior caso mostra
      // "compartilhado" a mais, e o dado continua onde estava. DESLIGAR não
      // pode: afirmar "só você vê" antes do servidor confirmar é prometer
      // privacidade que talvez não exista — e o pacto do produto é justamente
      // esse. Então o opt-out espera a resposta.
      if (proximo) {
        setData((cur) =>
          cur ? cur.map((x) => (x.code === m.code ? { ...x, shared: true } : x)) : cur,
        );
      }

      const res = await setMilestoneShared(m.code, proximo);
      setPending((cur) => cur.filter((c) => c !== m.code));

      if (!res) {
        if (proximo) {
          setData((cur) =>
            cur ? cur.map((x) => (x.code === m.code ? { ...x, shared: false } : x)) : cur,
          );
        }
        setShareError({ code: m.code, msg: "Não foi possível salvar essa escolha. Tente de novo." });
        return;
      }

      setData((cur) =>
        cur ? cur.map((x) => (x.code === m.code ? { ...x, shared: res.shared } : x)) : cur,
      );
      postPerformanceEvent("community.milestone_share_changed", { code: m.code, shared: proximo });
    },
    [pending],
  );

  if (loading) {
    return (
      <p className="perf-soon-copy" role="status">
        Carregando seus marcos…
      </p>
    );
  }

  if (failed || !data) {
    return (
      <section className="perf-soon">
        <AlertCircle size={18} className="perf-milestone-lock" aria-hidden="true" />
        <span className="perf-soon-title">Não foi possível carregar agora</span>
        <p className="perf-soon-copy">Seus marcos continuam salvos.</p>
        <button type="button" className="btn btn-secondary" onClick={retry}>
          Tentar novamente
        </button>
      </section>
    );
  }

  const conquistados = data.filter((m) => m.unlockedAt != null);
  const proximos = data.filter((m) => m.unlockedAt == null);

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      {conquistados.length === 0 ? (
        <section className="perf-soon">
          <span className="perf-soon-title">Seus marcos aparecem aqui</span>
          <p className="perf-soon-copy">
            Cada um nasce de algo que você fez de verdade — o primeiro treino, a primeira semana
            completa, o primeiro recorde pessoal. Eles são seus e ficam privados.
          </p>
        </section>
      ) : (
        <section style={{ display: "grid", gap: "var(--space-3)" }}>
          <h2 className="metabolic-section-title">Conquistados</h2>
          {conquistados.map((m) => {
            const evidencia = evidenceLine(m);
            const emVoo = pending.includes(m.code);
            const erro = shareError?.code === m.code ? shareError.msg : null;
            const descId = `${idBase}-${m.code}-desc`;
            return (
              <article key={m.code} className="perf-goal-card is-achieved">
                <header className="perf-goal-head">
                  <Check size={18} className="perf-goal-icon" aria-hidden="true" />
                  <span className="perf-goal-title">{m.title}</span>
                  <span className="perf-milestone-date">{formatDate(m.unlockedAt!)}</span>
                </header>
                <p className="perf-soon-copy">{m.description}</p>
                {evidencia && <p className="perf-milestone-evidence">{evidencia}</p>}
                <label className="perf-milestone-share">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={m.shared}
                    disabled={emVoo}
                    aria-describedby={descId}
                    onChange={() => void toggleShare(m)}
                  />
                  {/* Rótulo FIXO: o nome acessível de um controle não pode mudar
                      quando ele é acionado — o estado vive no `checked`. */}
                  <span>Compartilhar este marco com quem acompanha você</span>
                </label>
                <p id={descId} className="perf-milestone-hint">
                  {emVoo
                    ? "Salvando sua escolha…"
                    : m.shared
                      ? "Seu personal vê o título e a data. Os números por trás continuam só seus."
                      : "Privado — só você vê."}
                </p>
                {erro && (
                  <p className="perf-goal-error" role="alert">
                    {erro}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}

      {proximos.length > 0 && (
        <section style={{ display: "grid", gap: "var(--space-3)" }}>
          <h2 className="metabolic-section-title">Em aberto</h2>
          {proximos.map((m) => (
            <article key={m.code} className="perf-goal-card perf-milestone-open">
              <header className="perf-goal-head">
                <Target size={16} className="perf-milestone-lock" aria-hidden="true" />
                <span className="perf-goal-title">{m.title}</span>
              </header>
              {/* Marco sem caminho no estado atual da conta diz o que falta
                  destravar, em vez de exibir um critério inalcançável — quem
                  não tem ficha nunca terá frequência prevista para comparar. */}
              <p className="perf-soon-copy">
                {m.available ? m.criterion : (m.unavailableReason ?? m.criterion)}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
