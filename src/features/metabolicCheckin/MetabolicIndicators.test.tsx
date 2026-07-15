import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetabolicIndicators } from "./MetabolicIndicators";
import type { MetricCardData } from "./deriveIndicators";

// Garante que os indicadores usam a grade responsiva (que no mobile vira 2 col
// e não estoura a largura). Regressão do corte lateral na Evolução.
describe("MetabolicIndicators", () => {
  const cards: MetricCardData[] = [
    { key: "weight", label: "Peso", value: "80.1kg" },
    { key: "freq", label: "Treinos/semana", value: "1" },
    { key: "load", label: "Carga", value: "estável" },
    { key: "waist", label: "Cintura", value: "—", empty: true },
  ];

  it("renderiza os cards dentro da grade responsiva", () => {
    const { container } = render(<MetabolicIndicators cards={cards} />);
    const grid = container.querySelector(".metabolic-metric-grid");
    expect(grid).not.toBeNull();
    expect(grid!.querySelectorAll(".metabolic-metric").length).toBe(4);
    expect(screen.getByText("Peso")).toBeInTheDocument();
    expect(screen.getByText("Carga")).toBeInTheDocument();
  });
});
