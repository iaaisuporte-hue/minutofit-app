import { Trophy } from "lucide-react";
import { useEffect } from "react";
import { KIND_LABEL } from "./RecordsPanel";
import type { PrKind } from "./performanceApi";
import { postPerformanceEvent } from "./performanceEvents";

/** Recorde vindo da resposta do registro de treino. */
export interface PrEventSummary {
  exerciseName: string;
  kind: PrKind;
  value: number;
  previousValue: number | null;
  isFirst: boolean;
}

const UNIT: Record<PrKind, string> = {
  max_load: "kg",
  best_e1rm: "kg",
  session_volume: "kg",
  max_reps: "reps",
};

/**
 * Reconhecimento de recorde no resumo pós-treino (Spec 033, P2).
 *
 * Faixa dentro do fluxo: sem modal, sem confete, sem bloquear o encerramento do
 * treino. O aluno acabou de fazer esforço real — o app registra que percebeu e
 * sai da frente. É o tom do produto: cuidado e clareza, não recompensa infantil.
 *
 * Só superações aparecem. Estreia (`isFirst`) é linha de base: comemorar o
 * primeiro registro de todo exercício transformaria a comemoração em ruído e
 * ensinaria o aluno a ignorá-la justamente quando ela significasse algo.
 */
export function PrCelebration({ events }: { events: PrEventSummary[] }) {
  const conquistas = events.filter((e) => !e.isFirst);

  useEffect(() => {
    if (conquistas.length > 0) {
      postPerformanceEvent("performance.pr_celebrated", { count: conquistas.length });
    }
  }, [conquistas.length]);

  if (conquistas.length === 0) return null;

  return (
    <div className="perf-pr-banner" role="status">
      <span className="perf-pr-banner-title">
        <Trophy size={15} aria-hidden="true" />
        {conquistas.length === 1 ? "Novo recorde pessoal" : `${conquistas.length} novos recordes`}
      </span>
      <ul className="perf-pr-banner-list">
        {conquistas.map((e, i) => (
          <li key={`${e.exerciseName}-${e.kind}-${i}`}>
            {e.exerciseName} · {KIND_LABEL[e.kind]}: {e.value} {UNIT[e.kind]}
            {e.previousValue != null ? ` (antes ${e.previousValue} ${UNIT[e.kind]})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
