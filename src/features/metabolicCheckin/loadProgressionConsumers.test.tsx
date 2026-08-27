/**
 * Exercício com UM ponto de carga não é tendência.
 *
 * O servidor deixou de filtrar `points.length >= 2` em `exerciseProgression`
 * (ago/2026) porque o chip "última: X kg" do Modo Treino precisa do exercício
 * registrado uma única vez. O mesmo dado alimenta três leitores que falam de
 * EVOLUÇÃO — e para eles um ponto só vira afirmação falsa: "50 → 50 kg",
 * "Carga: estável", índice semanal colado em 100. O corte passou a ser de cada
 * consumidor, e é isso que estes testes seguram.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { loadDirection } from "./metabolicSignals";
import { WeightLoadTrendChart } from "./WeightLoadTrendChart";
import { WorkoutProgressSection } from "../../pages/user/components/WorkoutProgressSection";
import type { WorkoutStats } from "../../services/workoutSessionApi";

function stats(exercises: WorkoutStats["exerciseProgression"]): WorkoutStats {
  return { totalSessions: 4, thisWeek: 1, last30Days: 4, exerciseProgression: exercises };
}

const umPonto = {
  exerciseId: "ex-1",
  name: "Supino reto",
  firstLoadKg: 50,
  lastLoadKg: 50,
  deltaKg: 0,
  points: [{ date: "2026-08-10", maxLoadKg: 50 }],
};

const outroUmPonto = {
  ...umPonto,
  exerciseId: "ex-2",
  name: "Remada curvada",
  points: [{ date: "2026-08-20", maxLoadKg: 50 }],
};

const doisPontos = {
  exerciseId: "ex-3",
  name: "Agachamento",
  firstLoadKg: 40,
  lastLoadKg: 50,
  deltaKg: 10,
  points: [
    { date: "2026-08-10", maxLoadKg: 40 },
    { date: "2026-08-20", maxLoadKg: 50 },
  ],
};

describe("loadDirection", () => {
  it("carga registrada uma vez não vira 'estável'", () => {
    expect(loadDirection(stats([umPonto, outroUmPonto]))).toBeNull();
  });

  it("com dois pontos a direção volta a ser afirmada", () => {
    expect(loadDirection(stats([doisPontos]))).toBe("up");
  });

  it("sem estatística nenhuma continua nulo", () => {
    expect(loadDirection(null)).toBeNull();
    expect(loadDirection(stats([]))).toBeNull();
  });
});

describe("WorkoutProgressSection", () => {
  it("não exibe 'Sua evolução de carga' quando nenhum exercício tem dois pontos", () => {
    const { container } = render(<WorkoutProgressSection stats={stats([umPonto])} loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lista só o exercício com progressão real, no plural certo", () => {
    render(<WorkoutProgressSection stats={stats([umPonto, doisPontos])} loading={false} />);
    expect(screen.getByText("Agachamento")).toBeInTheDocument();
    expect(screen.queryByText("Supino reto")).toBeNull();
    expect(screen.getByText(/2 sessões com carga/)).toBeInTheDocument();
  });
});

describe("WeightLoadTrendChart", () => {
  it("exercícios de um ponto só não sustentam o índice de carga", () => {
    // Duas semanas diferentes: sem o corte, cada uma renderia índice 100 e a
    // seção apareceria como se houvesse tendência.
    const { container } = render(
      <WeightLoadTrendChart records={[]} stats={stats([umPonto, outroUmPonto])} cutoff={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
