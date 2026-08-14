import { useCallback, useEffect, useState } from "react";
import { API_URL, parseJson } from "../../services/apiBase";
import { authFetch } from "../../services/apiClient";
import "../../features/performance/challenges.css";

/**
 * Desafios institucionais — painel da academia (Spec 034, C3).
 *
 * O gestor precisa saber se o desafio está funcionando, não quanto cada aluno
 * fez. Por isso a tela é de AGREGADOS: engajamento, distribuição por faixa e a
 * tendência de aderência do grupo. Não há lista de participantes, não há nome,
 * não há percentual individual — e não há porque a API também não devolve.
 *
 * Abaixo de 5 participantes ativos, os agregados que permitiriam identificar
 * alguém vêm `null` do servidor. A tela explica a ausência em vez de mostrar
 * um espaço vazio.
 */

interface ChallengeItem {
  id: string;
  title: string;
  ruleText: string;
  startsOn: string;
  endsOn: string;
  state: "scheduled" | "running" | "ended" | "cancelled";
  counts: { invited: number; active: number; completed: number; left: number };
  eligibleCount: number;
  joinRate: number | null;
}

interface BandCount {
  band: string;
  label: string;
  count: number;
}

interface Panel {
  challenge: ChallengeItem;
  engagement: {
    invited: number;
    joined: number;
    active: number;
    /** `null` abaixo de 5 aderidos: contagem de resultado identifica. */
    completed: number | null;
    left: number | null;
    joinRate: number | null;
    completionRate: number | null;
  };
  bands: BandCount[] | null;
  averageProgressPct: number | null;
  adherenceTrend: { beforePct: number | null; duringPct: number | null; deltaPct: number | null };
}

const STATE_LABEL: Record<ChallengeItem["state"], string> = {
  scheduled: "Começa em breve",
  running: "Em andamento",
  ended: "Encerrado",
  cancelled: "Cancelado",
};

function formatDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function emDias(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Normaliza SÓ no blur.
 *
 * Aplicar `Math.max(min, …)` a cada tecla torna o campo impossível de usar:
 * para chegar em 80 o gestor digita "8", que vira 50 na hora; apagar o campo
 * devolve o valor anterior e ele nunca fica vazio. Os `min`/`max` do input já
 * dão a validação nativa no submit.
 */
function normalizar(valor: string, min: number, max: number, atual: number): number {
  const n = Number(valor);
  if (valor.trim() === '' || !Number.isFinite(n)) return atual;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export default function AcademyChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeItem[] | null>(null);
  const [painel, setPainel] = useState<Panel | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falhouCarregar, setFalhouCarregar] = useState(false);
  /** Erro por card: feedback longe da ação é feedback que ninguém lê. */
  const [erroAcao, setErroAcao] = useState<{ id: string; msg: string } | null>(null);
  const [carregandoPainel, setCarregandoPainel] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    kind: "consistency" as "consistency" | "weekly_goal" | "comeback",
    requiredWeeks: "4" as string | number,
    minPct: "80" as string | number,
    minInactiveDays: "21" as string | number,
    startsOn: hoje(),
    endsOn: emDias(28),
  });

  const carregar = useCallback(async () => {
    const res = await authFetch(`${API_URL}/academy/challenges`);
    const data = await parseJson(res);
    if (!res.ok) {
      // "Nenhum desafio ainda" numa falha de rede faria o gestor criar um
      // duplicado.
      setFalhouCarregar(true);
      setChallenges([]);
      return;
    }
    setFalhouCarregar(false);
    setChallenges(data?.data?.challenges ?? []);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrir = useCallback(
    async (id: string) => {
      if (aberto === id) {
        setAberto(null);
        return;
      }
      setAberto(id);
      setPainel(null);
      setErroAcao(null);
      setCarregandoPainel(true);
      const res = await authFetch(`${API_URL}/academy/challenges/${id}`);
      const data = await parseJson(res);
      setCarregandoPainel(false);
      if (!res.ok) {
        setErroAcao({ id, msg: "Não foi possível abrir o painel." });
        return;
      }
      setPainel(data?.data ?? null);
    },
    [aberto],
  );

  const criar = useCallback(async () => {
    setErro(null);
    setAviso(null);
    setCriando(true);

    const rule =
      form.kind === "consistency"
        ? { minPct: Number(form.minPct), requiredWeeks: Number(form.requiredWeeks) }
        : form.kind === "weekly_goal"
          ? { requiredWeeks: Number(form.requiredWeeks) }
          : {
              minInactiveDays: Number(form.minInactiveDays),
              requiredWeeks: Number(form.requiredWeeks),
            };

    const res = await authFetch(`${API_URL}/academy/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        kind: form.kind,
        rule,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
      }),
    });
    const data = await parseJson(res);
    setCriando(false);

    if (!res.ok) {
      setErro(data?.error ?? "Não foi possível criar o desafio.");
      return;
    }
    setForm((f) => ({ ...f, title: "", description: "" }));
    setAviso("Desafio criado. Agora convide os alunos.");
    await carregar();
  }, [form, carregar]);

  const convidar = useCallback(
    async (id: string, elegiveis: number) => {
      // O backend resolve os elegíveis; a confirmação nomeia o alcance para o
      // gestor não descobrir depois quantas pessoas foram convidadas.
      const ok = window.confirm(
        `Convidar ${elegiveis} aluno(s) ativo(s) da academia para este desafio? ` +
          "Cada um decide se entra — ninguém é inscrito automaticamente, e quem já saiu não " +
          "recebe de novo.",
      );
      if (!ok) return;

      setErroAcao(null);
      const res = await authFetch(`${API_URL}/academy/challenges/${id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setErroAcao({ id, msg: data?.error ?? "Não foi possível convidar." });
        return;
      }
      setAviso(`${data?.data?.invited ?? 0} convite(s) enviado(s).`);
      await carregar();
      if (aberto === id) await abrir(id);
    },
    [carregar, abrir, aberto],
  );

  const cancelar = useCallback(
    async (id: string, ativos: number) => {
      const ok = window.confirm(
        `Cancelar este desafio? ${ativos} pessoa(s) param de acompanhar. ` +
          "Quem já concluiu mantém o resultado.",
      );
      if (!ok) return;

      setErroAcao(null);
      const res = await authFetch(`${API_URL}/academy/challenges/${id}/cancel`, { method: "POST" });
      if (!res.ok) {
        setErroAcao({ id, msg: "Não foi possível cancelar. Tente de novo." });
        return;
      }
      setAviso("Desafio cancelado. Quem já concluiu mantém o resultado.");
      await carregar();
    },
    [carregar],
  );

  return (
    <div className="ch-page">
      <header>
        <h1 className="ch-title">Desafios da academia</h1>
        <p className="ch-card-hint">
          Cada aluno é medido contra a própria frequência prevista. Quem cumpre 3 de 3 aparece
          melhor que quem cumpre 3 de 4 — o desafio mede aderência ao plano de cada um, não volume.
        </p>
      </header>

      <form
        className="ch-invite"
        onSubmit={(e) => {
          e.preventDefault();
          void criar();
        }}
      >
        <h2 className="metabolic-section-title">Criar desafio</h2>

        <label className="ch-field">
          <span>Título</span>
          <input
            value={form.title}
            required
            maxLength={120}
            placeholder="Agosto firme"
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>

        <label className="ch-field">
          <span>Descrição (opcional)</span>
          <input
            value={form.description}
            maxLength={500}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>

        <label className="ch-field">
          <span>Tipo</span>
          <select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as typeof form.kind }))}
          >
            <option value="consistency">Consistência</option>
            <option value="weekly_goal">Meta semanal</option>
            <option value="comeback">Retomada</option>
          </select>
        </label>

        <label className="ch-field">
          <span>Semanas exigidas</span>
          <input
            type="number"
            min={1}
            max={26}
            required
            value={form.requiredWeeks}
            onChange={(e) => setForm((f) => ({ ...f, requiredWeeks: e.target.value }))}
            onBlur={(e) =>
              setForm((f) => ({ ...f, requiredWeeks: normalizar(e.target.value, 1, 26, 1) }))
            }
          />
        </label>

        {form.kind === "consistency" && (
          <label className="ch-field">
            <span>% mínimo da frequência prevista</span>
            <input
              type="number"
              min={50}
              max={100}
              required
              value={form.minPct}
              onChange={(e) => setForm((f) => ({ ...f, minPct: e.target.value }))}
            onBlur={(e) =>
              setForm((f) => ({ ...f, minPct: normalizar(e.target.value, 50, 100, 50) }))
            }
            />
          </label>
        )}

        {form.kind === "comeback" && (
          <label className="ch-field">
            <span>Dias parado que caracterizam a pausa</span>
            <input
              type="number"
              min={7}
              max={180}
              required
              value={form.minInactiveDays}
              onChange={(e) => setForm((f) => ({ ...f, minInactiveDays: e.target.value }))}
              onBlur={(e) =>
                setForm((f) => ({ ...f, minInactiveDays: normalizar(e.target.value, 7, 180, 21) }))
              }
            />
          </label>
        )}

        <label className="ch-field">
          <span>Início</span>
          <input
            type="date"
            required
            /* Desafio retroativo é recusado pelo servidor: barrar aqui evita
               que o gestor descubra pelo erro. */
            min={hoje()}
            value={form.startsOn}
            onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
          />
        </label>

        <label className="ch-field">
          <span>Fim</span>
          <input
            type="date"
            required
            min={form.startsOn}
            value={form.endsOn}
            onChange={(e) => setForm((f) => ({ ...f, endsOn: e.target.value }))}
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={criando}>
          {criando ? "Criando…" : "Criar desafio"}
        </button>

        {erro && (
          <p className="perf-goal-error" role="alert">
            {erro}
          </p>
        )}
        {aviso && (
          <p className="ch-card-hint" role="status">
            {aviso}
          </p>
        )}
      </form>

      <section style={{ display: "grid", gap: "var(--space-3)" }}>
        <h2 className="metabolic-section-title">Desafios</h2>

        {challenges == null ? (
          <p className="ch-card-hint" role="status">
            Carregando…
          </p>
        ) : falhouCarregar ? (
          <section className="perf-soon">
            <span className="perf-soon-title">Não foi possível carregar os desafios</span>
            <p className="ch-card-hint">Pode ser a conexão. Nada foi perdido.</p>
            <button type="button" className="btn btn-primary" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          </section>
        ) : challenges.length === 0 ? (
          <p className="ch-card-hint">
            Nenhum desafio ainda. Um desafio é um compromisso com prazo — funciona melhor curto.
          </p>
        ) : (
          challenges.map((c) => (
            <article key={c.id} className="ch-card">
              <header className="ch-card-head">
                <span className="ch-card-title">{c.title}</span>
                <span className="ch-card-hint">{STATE_LABEL[c.state]}</span>
              </header>
              <p className="ch-card-rule">{c.ruleText}</p>
              <p className="ch-card-hint">
                {formatDay(c.startsOn)} a {formatDay(c.endsOn)} · {c.counts.active} participando ·{" "}
                {c.counts.invited} convidados · {c.counts.completed} concluíram
              </p>

              <div className="ch-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-expanded={aberto === c.id}
                  aria-controls={`painel-${c.id}`}
                  onClick={() => void abrir(c.id)}
                >
                  {aberto === c.id ? "Ocultar" : "Ver painel"}
                </button>
                {(c.state === "running" || c.state === "scheduled") && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void convidar(c.id, c.eligibleCount)}
                    >
                      Convidar alunos
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void cancelar(c.id, c.counts.active)}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>

              {aberto === c.id && erroAcao?.id === c.id && (
                <p className="perf-goal-error" role="alert">
                  {erroAcao.msg}
                </p>
              )}

              {aberto === c.id && carregandoPainel && (
                <p className="ch-card-hint" role="status">
                  Carregando o painel…
                </p>
              )}

              {aberto === c.id && painel && (
                <div className="ch-panel" id={`painel-${c.id}`}>
                  <h3 className="ch-card-title">Engajamento</h3>
                  <dl className="ch-meta">
                    <div>
                      <dt>Convidados sem resposta</dt>
                      <dd>{painel.engagement.invited}</dd>
                    </div>
                    <div>
                      <dt>Aderiram</dt>
                      <dd>
                        {painel.engagement.joined}
                        {painel.engagement.joinRate != null && ` (${painel.engagement.joinRate}%)`}
                      </dd>
                    </div>
                    <div>
                      <dt>Concluíram</dt>
                      <dd>
                        {painel.engagement.completed == null
                          ? "—"
                          : `${painel.engagement.completed}${
                              painel.engagement.completionRate != null
                                ? ` (${painel.engagement.completionRate}%)`
                                : ""
                            }`}
                      </dd>
                    </div>
                    <div>
                      <dt>Saíram</dt>
                      <dd>{painel.engagement.left ?? "—"}</dd>
                    </div>
                  </dl>

                  <h3 className="ch-card-title">Distribuição</h3>
                  {painel.bands ? (
                    <ul className="ch-bands">
                      {painel.bands.map((b) => (
                        <li key={b.band}>
                          <span className="ch-band-label">{b.label}</span>
                          <span className="ch-band-count">
                            {b.count} {b.count === 1 ? "pessoa" : "pessoas"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ch-card-hint">
                      A distribuição aparece a partir de 5 participantes ativos — com menos que
                      isso, a contagem identificaria as pessoas.
                    </p>
                  )}

                  <h3 className="ch-card-title">Aderência do grupo</h3>
                  {painel.adherenceTrend.deltaPct != null ? (
                    <p className="ch-card-hint">
                      {painel.adherenceTrend.beforePct}% antes → {painel.adherenceTrend.duringPct}%
                      durante ({painel.adherenceTrend.deltaPct > 0 ? "+" : ""}
                      {painel.adherenceTrend.deltaPct} pontos). Compara o grupo com ele mesmo, no
                      período anterior de mesma duração.
                    </p>
                  ) : (
                    <p className="ch-card-hint">
                      A comparação aparece quando houver participantes e tempo suficientes.
                    </p>
                  )}

                  <p className="ch-card-hint">
                    Este painel mostra apenas números do grupo. Progresso individual, carga, peso e
                    dados de saúde dos alunos não aparecem aqui. Os campos com "—" só aparecem a
                    partir de 5 pessoas que aderiram — abaixo disso o número identificaria alguém.
                  </p>
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
