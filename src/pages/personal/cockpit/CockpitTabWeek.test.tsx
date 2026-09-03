/**
 * D-BUG1 (Sprint P2B) — o sparkline da aba Semana estava rotulado "Aderência"
 * mas sempre plotou `history.adherence14d`, que é histórico de SCORE
 * METABÓLICO (`personalDashboardService.ts`), sem relação com execução de
 * treino. O dado plotado sempre esteve correto — só o texto visível mentia.
 * Este teste trava o texto certo para não regredir.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PersonalStudentSnapshot } from "../../../services/personalDashboardApi";
import { CockpitTabWeek } from "./CockpitTabWeek";

function snapshot(over: Partial<PersonalStudentSnapshot> = {}): PersonalStudentSnapshot {
  return {
    id: "42",
    name: "Aluna Teste",
    metabolismDetail: null,
    streakDays: 0,
    today: { checkedInToday: false },
    week: { days: [], avgFormScore: null, movementSessions7d: 0, latestMessagePreview: null },
    history: {
      // Um único ponto: força o fallback `AdherenceSparkline` em vez do
      // gráfico completo (`MetabolicChart`, que exige >= 2 pontos) — o rótulo
      // fixo (`CockpitTabWeek.tsx`) é o mesmo nos dois caminhos.
      adherence14d: [{ date: "2026-08-30", score: 62 }],
      wellbeingHistory14d: [],
    },
    ...over,
  } as unknown as PersonalStudentSnapshot;
}

describe("CockpitTabWeek — rótulo do sparkline (D-BUG1)", () => {
  it("chama o histórico de score metabólico pelo nome certo, nunca 'Aderência'", () => {
    render(<CockpitTabWeek data={snapshot()} />);
    expect(screen.getByText("Score metabólico (14 dias)")).toBeInTheDocument();
    expect(screen.queryByText(/^Aderência/)).not.toBeInTheDocument();
  });

  it("a narrativa também fala de score metabólico, não de aderência à ficha", () => {
    const history = {
      adherence14d: [
        { date: "2026-08-24", score: 40 },
        { date: "2026-08-25", score: 42 },
        { date: "2026-08-29", score: 60 },
        { date: "2026-08-30", score: 65 },
      ],
      wellbeingHistory14d: [],
    };
    const data = snapshot({ history: history as unknown as PersonalStudentSnapshot["history"] });
    render(<CockpitTabWeek data={data} />);
    expect(screen.getByText(/Score metabólico subindo/)).toBeInTheDocument();
  });
});
