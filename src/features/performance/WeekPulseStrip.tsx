import { useEffect, useMemo, useState } from "react";
import { getTrainingCalendar, type ActiveDay } from "./performanceApi";
import { dayKey } from "../../lib/appDay";

// Pulso dos últimos 7 dias (Spec 033, P1).
//
// A fonte é a MESMA do calendário e do `activeDays28`: o UNION de treino
// registrado, execução real e presença marcada pelo personal.
//
// A tentação era usar o `heatmap` que `GET /gamification/summary` já devolve de
// graça (e que nenhuma tela jamais renderizou). Não dá: aquele campo vem de
// `user_daily_checkins`, e um treino retroativo de D-2/D-3 grava
// `user_workout_logs` SEM criar check-in. O dia apareceria aceso no calendário e
// apagado aqui, na mesma tela — a colisão de definição que o Risco #2 da spec
// nomeia, só que entre dois widgets em vez de dois rótulos.

const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Dia da semana a partir da chave 'YYYY-MM-DD', sem passar pelo fuso do aparelho. */
function weekdayFromKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** As chaves dos últimos 7 dias no fuso do ALUNO, do mais antigo para hoje. */
function lastSevenDayKeys(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export function WeekPulseStrip() {
  const [days, setDays] = useState<ActiveDay[] | null>(null);

  const keys = useMemo(() => lastSevenDayKeys(), []);

  useEffect(() => {
    const controller = new AbortController();
    // A janela de 7 dias pode cruzar a virada do mês: busca os dois meses e
    // junta. Sem isso, no dia 3 o pulso perderia os dias do mês anterior.
    const months = Array.from(new Set(keys.map((k) => k.slice(0, 7))));
    Promise.all(months.map((m) => getTrainingCalendar(m, controller.signal)))
      .then((results) => {
        if (!controller.signal.aborted) setDays(results.flat());
      })
      .catch(() => {
        if (!controller.signal.aborted) setDays([]);
      });
    return () => controller.abort();
  }, [keys]);

  if (days === null) return null;

  const active = new Set(days.filter((d) => d.active).map((d) => d.date));
  const todayKey = dayKey();
  const activeCount = keys.filter((k) => active.has(k)).length;

  return (
    <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
      <div style={{ display: "grid", gap: "var(--space-1)" }}>
        <div className="metabolic-eyebrow">Últimos 7 dias</div>
        <h2 className="metabolic-section-title">Seu pulso da semana</h2>
        <p className="metabolic-section-copy">
          {activeCount === 0
            ? "Nenhum registro nos últimos 7 dias. Um treino já reacende a sequência."
            : `${activeCount} ${activeCount === 1 ? "dia registrado" : "dias registrados"} nesta semana.`}
        </p>
      </div>

      <div className="perf-week-pulse" role="list" aria-label="Atividade dos últimos 7 dias">
        {keys.map((key) => {
          const isActive = active.has(key);
          const isToday = key === todayKey;
          const state = isActive ? "com registro" : "sem registro";
          return (
            <div className="perf-week-day" key={key} role="listitem">
              <span className="perf-week-label" aria-hidden="true">
                {WEEKDAY_INITIALS[weekdayFromKey(key)]}
              </span>
              {/* A cor nunca informa sozinha: o rótulo acessível diz o estado. */}
              <span
                className={`perf-week-dot${isActive ? " is-active" : ""}${isToday ? " is-today" : ""}`}
                title={`${key}: ${state}`}
                aria-label={`${key}: ${state}`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
