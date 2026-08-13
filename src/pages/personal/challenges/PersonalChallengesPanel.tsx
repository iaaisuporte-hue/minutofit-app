import { useCallback, useEffect, useState } from "react";
import { API_URL, parseJson } from "../../../services/apiBase";
import { authFetch } from "../../../services/apiClient";
import "../../../features/performance/challenges.css";

/**
 * Desafios do personal (Spec 034, C2).
 *
 * Acompanhamento, não ranking: a lista de participantes vem do servidor em
 * ordem alfabética e a tela não reordena por desempenho. Ordenar por progresso
 * transformaria a ferramenta de accountability numa tabela classificatória, que
 * é justamente o que a spec proíbe.
 *
 * O personal vê o progresso dos PRÓPRIOS alunos porque já acompanha o treino
 * deles — e some na hora se o aluno revogar o consentimento.
 */

interface ChallengeItem {
  id: string;
  title: string;
  ruleText: string;
  startsOn: string;
  endsOn: string;
  state: "scheduled" | "running" | "ended" | "cancelled";
  counts: { invited: number; active: number; completed: number; left: number };
}

interface Participant {
  userId: number;
  name: string;
  status: "invited" | "active" | "left" | "completed";
  progressPct: number | null;
  consentGranted: boolean;
}

interface Student {
  id: number;
  name: string;
}

const STATE_LABEL: Record<ChallengeItem["state"], string> = {
  scheduled: "Começa em breve",
  running: "Em andamento",
  ended: "Encerrado",
  cancelled: "Cancelado",
};

const PARTICIPANT_LABEL: Record<Participant["status"], string> = {
  invited: "Convidado",
  active: "Participando",
  completed: "Concluiu",
  left: "Saiu",
};

function formatDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Campo numérico vazio virava `NaN` no corpo da requisição. */
function clamp(valor: string, min: number, max: number, atual: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return atual;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function emDias(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

export default function PersonalChallengesPanel() {
  const [challenges, setChallenges] = useState<ChallengeItem[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [criando, setCriando] = useState(false);
  /** Quem o personal escolheu convidar, por desafio. */
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    kind: "consistency" as "consistency" | "weekly_goal" | "comeback",
    requiredWeeks: 4,
    minPct: 80,
    minInactiveDays: 21,
    startsOn: hoje(),
    endsOn: emDias(28),
  });

  const carregar = useCallback(async () => {
    const res = await authFetch(`${API_URL}/personal/challenges`);
    const data = await parseJson(res);
    setChallenges(res.ok ? (data?.data?.challenges ?? []) : []);
  }, []);

  useEffect(() => {
    void carregar();
    void (async () => {
      // Alunos elegíveis: a lista do dashboard já traz só quem tem vínculo
      // ativo. Mesmo assim, o servidor revalida cada um no convite — lista de
      // tela nunca autoriza nada.
      const res = await authFetch(`${API_URL}/personal/dashboard`);
      const data = await parseJson(res);
      const lista = (data?.data?.students ?? []) as Array<{ id: number; name: string }>;
      setStudents(lista.map((s) => ({ id: s.id, name: s.name })));
    })();
  }, [carregar]);

  const abrir = useCallback(async (id: string) => {
    setAberto(id);
    setParticipants(null);
    const res = await authFetch(`${API_URL}/personal/challenges/${id}/participants`);
    const data = await parseJson(res);
    setParticipants(res.ok ? (data?.data?.participants ?? []) : []);
  }, []);

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

    const res = await authFetch(`${API_URL}/personal/challenges`, {
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
    async (challengeId: string, ids: number[]) => {
      setErro(null);
      const res = await authFetch(`${API_URL}/personal/challenges/${challengeId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: ids }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setErro(data?.error ?? "Não foi possível convidar.");
        return;
      }
      setAviso(`${data?.data?.invited ?? 0} convite(s) enviado(s).`);
      setSelecionados([]);
      await abrir(challengeId);
      await carregar();
    },
    [abrir, carregar],
  );

  const cancelar = useCallback(
    async (challengeId: string, participando: number) => {
      // Cancelar afeta todo mundo de uma vez: a confirmação NOMEIA a
      // consequência em vez de perguntar "tem certeza?".
      const ok = window.confirm(
        `Cancelar este desafio? ${participando} pessoa(s) param de acompanhar. ` +
          "Quem já concluiu mantém o resultado.",
      );
      if (!ok) return;

      setErro(null);
      const res = await authFetch(`${API_URL}/personal/challenges/${challengeId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        // Falhar em silêncio faria o botão parecer ter funcionado.
        setErro("Não foi possível cancelar. Tente de novo.");
        return;
      }
      setAviso("Desafio cancelado. Quem já concluiu mantém o resultado.");
      await carregar();
    },
    [carregar],
  );

  return (
    <div className="ch-page">
      <form
        className="ch-invite"
        onSubmit={(e) => {
          e.preventDefault();
          void criar();
        }}
      >
        <h2 className="metabolic-section-title">Criar desafio</h2>
        <p className="ch-card-hint">
          Cada aluno é medido contra a própria frequência prevista — quem treina 3 de 3 cumpre
          mais que quem treina 3 de 4.
        </p>

        <label className="ch-field">
          <span>Título</span>
          <input
            value={form.title}
            required
            maxLength={120}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Quatro semanas firmes"
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
            onChange={(e) =>
              setForm((f) => ({ ...f, kind: e.target.value as typeof form.kind }))
            }
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
            value={form.requiredWeeks}
            required
            onChange={(e) =>
              setForm((f) => ({ ...f, requiredWeeks: clamp(e.target.value, 1, 26, f.requiredWeeks) }))
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
              value={form.minPct}
              required
            onChange={(e) => setForm((f) => ({ ...f, minPct: clamp(e.target.value, 50, 100, f.minPct) }))}
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
              value={form.minInactiveDays}
              required
            onChange={(e) =>
              setForm((f) => ({ ...f, minInactiveDays: clamp(e.target.value, 7, 180, f.minInactiveDays) }))
            }
            />
          </label>
        )}

        <label className="ch-field">
          <span>Início</span>
          <input
            type="date"
            value={form.startsOn}
            onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
          />
        </label>

        <label className="ch-field">
          <span>Fim</span>
          <input
            type="date"
            value={form.endsOn}
            /* O fim nunca antes do início: o navegador barra sem ida ao
               servidor, e o personal não descobre pelo erro. */
            min={form.startsOn}
            required
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
        {/* `role="status"` para que criar e convidar não sejam mudos no
            leitor de tela. */}
        {aviso && (
          <p className="ch-card-hint" role="status">
            {aviso}
          </p>
        )}
      </form>

      <section style={{ display: "grid", gap: "var(--space-3)" }}>
        <h2 className="metabolic-section-title">Seus desafios</h2>

        {challenges == null ? (
          <p className="ch-card-hint" role="status">
            Carregando…
          </p>
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
                <button type="button" className="btn btn-secondary" onClick={() => void abrir(c.id)}>
                  {aberto === c.id ? "Ocultar" : "Acompanhar"}
                </button>
                {(c.state === "running" || c.state === "scheduled") && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void cancelar(c.id, c.counts.active)}
                  >
                    Cancelar desafio
                  </button>
                )}
              </div>

              {aberto === c.id && (c.state === "running" || c.state === "scheduled") && (
                <section className="ch-invite-picker">
                  <h3 className="ch-card-title">Convidar</h3>
                  {/* Escolha explícita, não disparo em massa: um desafio de
                      Retomada enviado à carteira inteira chega a quem nunca
                      parou — e isso é exatamente o constrangimento que o
                      produto proíbe. */}
                  <p className="ch-card-hint">
                    Escolha quem faz sentido para este desafio. Quem já foi convidado não recebe
                    de novo.
                  </p>
                  {students.length === 0 ? (
                    <p className="ch-card-hint">Você ainda não tem alunos com vínculo ativo.</p>
                  ) : (
                    <ul className="ch-picker-list">
                      {students.map((aluno) => (
                        <li key={aluno.id}>
                          <label className="perf-milestone-share">
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={selecionados.includes(aluno.id)}
                              onChange={(e) =>
                                setSelecionados((cur) =>
                                  e.target.checked
                                    ? [...cur, aluno.id]
                                    : cur.filter((id) => id !== aluno.id),
                                )
                              }
                            />
                            <span>{aluno.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={selecionados.length === 0}
                    onClick={() => void convidar(c.id, selecionados)}
                  >
                    {selecionados.length === 0
                      ? "Selecione os alunos"
                      : `Convidar ${selecionados.length} aluno${selecionados.length === 1 ? "" : "s"}`}
                  </button>
                </section>
              )}

              {aberto === c.id && (
                <ul className="ch-participants">
                  {participants == null ? (
                    <li>Carregando participantes…</li>
                  ) : participants.length === 0 ? (
                    <li>Ninguém convidado ainda.</li>
                  ) : (
                    participants.map((p) => (
                      <li key={p.userId}>
                        <span className="ch-band-label">{p.name}</span>
                        <span className="ch-band-count">
                          {PARTICIPANT_LABEL[p.status]}
                          {/* Sem consentimento não há número — e "sem acesso"
                              é diferente de zero, que diria que ele não treinou. */}
                          {!p.consentGranted
                            ? " · sem acesso aos dados"
                            : p.progressPct != null
                              ? ` · ${p.progressPct}%`
                              : ""}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
