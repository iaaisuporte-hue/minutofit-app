import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTrainingCalendar, type ActiveDay } from "./performanceApi";
import { dayKey } from "../../lib/appDay";

// Calendário mensal de treino (Spec 033, P1) — o "training log" em grade.
//
// Grade fluida de 7 colunas em vez de tabela: numa tabela de largura fixa o
// mês não cabe em 320px sem scroll horizontal, que é proibido no produto.

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const SOURCE_LABEL: Record<string, string> = {
  session: "treino registrado",
  log: "treino registrado",
  personal: "presença registrada pelo personal",
};

/** 'YYYY-MM' do mês corrente no fuso do aluno. */
function currentMonthKey(): string {
  return dayKey().slice(0, 7);
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Células do mês: os vazios do começo alinham o dia 1 ao dia da semana certo.
 * `Date.UTC` de propósito — a grade é um calendário, não um instante, e usar
 * hora local aqui deslocaria o mês inteiro em fusos negativos.
 */
function buildCells(monthKey: string): (number | null)[] {
  const [y, m] = monthKey.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  return cells;
}

export function MonthHeatmap() {
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [days, setDays] = useState<ActiveDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getTrainingCalendar(monthKey, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setDays(rows);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [monthKey]);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const cells = useMemo(() => buildCells(monthKey), [monthKey]);
  const todayKey = dayKey();
  const thisMonth = currentMonthKey();

  return (
    <div className="perf-month">
      <div className="perf-month-head">
        <span className="perf-month-title">{monthLabel(monthKey)}</span>
        <div className="perf-month-nav">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonthKey((m) => shiftMonth(m, -1))}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            // Mês futuro não tem treino para mostrar — navegar para lá só entrega
            // uma grade vazia que parece falha de carregamento.
            disabled={monthKey >= thisMonth}
            onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/*
        Sem `role="grid"`: uma grade ARIA exige `role="row"` entre a grade e as
        células, e a CSS Grid aqui é uma lista contínua de 7 colunas, sem
        elemento de linha. Declarar grid sem linhas entrega ao leitor de tela
        uma estrutura inválida. Uma lista com rótulo por dia descreve o
        calendário corretamente e é o que o leitor sabe navegar.
      */}
      <ul className="perf-month-grid" aria-label={`Dias de treino em ${monthLabel(monthKey)}`}>
        {WEEKDAYS.map((w, i) => (
          <li className="perf-month-weekday" key={`${w}-${i}`} aria-hidden="true">
            {w}
          </li>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <li className="perf-month-cell is-empty" key={`empty-${i}`} aria-hidden="true" />;
          }
          const date = `${monthKey}-${String(day).padStart(2, "0")}`;
          const entry = byDate.get(date);
          const isActive = !!entry;
          const isToday = date === todayKey;
          const sources = entry?.sources ?? [];
          const what = sources.length > 0
            ? Array.from(new Set(sources.map((s) => SOURCE_LABEL[s] ?? s))).join(" · ")
            : "sem registro";
          return (
            <li
              key={date}
              className={`perf-month-cell${isActive ? " is-active" : ""}${isToday ? " is-today" : ""}`}
              title={`${day}: ${what}`}
              aria-label={`Dia ${day}: ${what}${isToday ? " (hoje)" : ""}`}
            >
              {day}
            </li>
          );
        })}
      </ul>

      <div className="perf-legend">
        <span className="perf-legend-item">
          <span className="perf-legend-swatch is-active" aria-hidden="true" />
          Dia com registro
        </span>
        <span className="perf-legend-item">
          <span className="perf-legend-swatch" aria-hidden="true" />
          Sem registro
        </span>
        {loading && <span className="perf-legend-item">Carregando…</span>}
      </div>
    </div>
  );
}
