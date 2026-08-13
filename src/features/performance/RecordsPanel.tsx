import { useEffect, useMemo, useState } from "react";
import { getPrRecords, type PrKind, type PrRecord, type PrRecordsResponse } from "./performanceApi";
import { postPerformanceEvent } from "./performanceEvents";
import { PerformanceUpsell } from "./PerformanceUpsell";

/**
 * Recordes pessoais (Spec 033, P2).
 *
 * Agrupa por exercício e mostra as categorias lado a lado, porque é assim que o
 * aluno pensa ("meu supino") e não por tipo de métrica.
 *
 * O agrupamento é por `(exerciseId, exerciseName)` e não só pelo id: exercícios
 * removidos do catálogo ficam todos com `exerciseId = null`, e agrupar só pelo
 * id juntaria recordes de exercícios diferentes num bloco sem nome.
 */

export const KIND_LABEL: Record<PrKind, string> = {
  max_load: "Maior carga",
  best_e1rm: "1RM estimado",
  session_volume: "Maior volume",
  max_reps: "Mais repetições",
};

const KIND_UNIT: Record<PrKind, string> = {
  max_load: "kg",
  best_e1rm: "kg",
  session_volume: "kg",
  max_reps: "reps",
};

const KIND_ORDER: PrKind[] = ["max_load", "best_e1rm", "session_volume", "max_reps"];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(iso));
}

interface Group {
  key: string;
  name: string;
  inCatalog: boolean;
  byKind: Partial<Record<PrKind, PrRecord>>;
}

function groupRecords(records: PrRecord[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of records) {
    // Chave composta: sem o nome, todos os órfãos virariam um grupo só.
    const key = `${r.exerciseId ?? "orphan"}::${r.exerciseName}`;
    let g = map.get(key);
    if (!g) {
      g = { key, name: r.exerciseName, inCatalog: r.exerciseInCatalog, byKind: {} };
      map.set(key, g);
    }
    g.byKind[r.kind] = r;
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function RecordsPanel() {
  const [data, setData] = useState<PrRecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getPrRecords(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res === null) setFailed(true);
        else {
          setData(res);
          postPerformanceEvent("performance.prs_viewed", {
            recordCount: res.records.length,
            gated: res.gated,
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => groupRecords(data?.records ?? []), [data]);

  if (loading) {
    return (
      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div className="metabolic-eyebrow">Recordes</div>
        <p className="metabolic-section-copy">Carregando seus recordes…</p>
      </section>
    );
  }

  if (failed) {
    return (
      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div className="metabolic-eyebrow">Recordes</div>
        <p className="metabolic-section-copy" role="alert">
          Não foi possível carregar seus recordes agora. Tente novamente em instantes.
        </p>
      </section>
    );
  }

  if (data?.gated) return <PerformanceUpsell area="recordes" />;

  if (groups.length === 0) {
    return (
      <div className="metabolic-empty">
        <p className="metabolic-section-copy">
          Seus recordes aparecem aqui assim que você registrar um treino com carga ou repetições.
          Cada exercício guarda a própria marca.
        </p>
      </div>
    );
  }

  const conquistas = (data?.events ?? []).filter((e) => !e.isFirst);

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <div className="metabolic-eyebrow">Suas marcas</div>
          <h2 className="metabolic-section-title">Recordes por exercício</h2>
        </div>

        <div className="perf-record-list">
          {groups.map((g) => (
            <article className="perf-record-card" key={g.key}>
              <div className="perf-record-head">
                <strong className="perf-record-name">{g.name}</strong>
                {!g.inCatalog && (
                  // O exercício saiu da biblioteca; a marca do aluno não sai.
                  <span className="perf-record-flag" title="Exercício não está mais na biblioteca">
                    fora do catálogo
                  </span>
                )}
              </div>
              <dl className="perf-record-kinds">
                {KIND_ORDER.filter((k) => g.byKind[k]).map((k) => {
                  const r = g.byKind[k]!;
                  return (
                    <div key={k}>
                      <dt>{KIND_LABEL[k]}</dt>
                      <dd>
                        <span className="perf-record-value">
                          {r.value}
                          <span className="perf-figure-unit">{KIND_UNIT[k]}</span>
                        </span>
                        <span className="perf-record-date">{formatDate(r.achievedAt)}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      </section>

      {conquistas.length > 0 && (
        <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
          <div style={{ display: "grid", gap: "var(--space-1)" }}>
            <div className="metabolic-eyebrow">Linha do tempo</div>
            <h2 className="metabolic-section-title">Quando você superou</h2>
            <p className="metabolic-section-copy">
              Só as superações aparecem aqui — a primeira marca de cada exercício é o ponto de
              partida, não uma conquista.
            </p>
          </div>
          <div className="metabolic-history-list">
            {conquistas.map((e, i) => (
              <article className="metabolic-history-item" key={`${e.exerciseName}-${e.kind}-${i}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <strong style={{ color: "var(--color-text)" }}>{e.exerciseName}</strong>
                  <span className="metabolic-eyebrow">{formatDate(e.achievedAt)}</span>
                </div>
                <span className="metabolic-eyebrow">
                  {KIND_LABEL[e.kind]}: {e.value} {KIND_UNIT[e.kind]}
                  {e.previousValue != null ? ` · antes ${e.previousValue} ${KIND_UNIT[e.kind]}` : ""}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
