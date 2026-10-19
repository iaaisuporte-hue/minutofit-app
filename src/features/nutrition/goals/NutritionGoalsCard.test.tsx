/**
 * Spec 039 — painel "Metas diárias": 4 indicadores formatados em PT-BR,
 * estados obrigatórios (loading, erro com retry, vazio, parcial) e nutriente
 * sem meta NUNCA aparece como 0.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NutritionGoalsCard } from "./NutritionGoalsCard";
import type { NutritionGoals } from "../../../services/nutritionGoalsApi";
import { formatRange, parseDecimalInput } from "./formatGoals";

const FULL: NutritionGoals = {
  energyKcal: 2300,
  proteinMinG: 150,
  proteinMaxG: 170,
  fiberMinG: 30,
  fiberMaxG: 40,
  waterMinMl: 2500,
  waterMaxMl: 3000,
  objectives: ["weight_loss", "metabolic_health"],
  patientNote: "Ajustaremos as porções conforme a evolução.",
  updatedAt: "2026-10-19T12:00:00Z",
  updatedByName: "Dra. Marina",
};

function renderCard(props: Partial<Parameters<typeof NutritionGoalsCard>[0]> = {}) {
  return render(
    <NutritionGoalsCard title="Metas diárias" state="ready" goals={FULL} emptyMessage="Sem metas ainda." {...props} />,
  );
}

describe("NutritionGoalsCard", () => {
  it("renderiza os 4 indicadores formatados em PT-BR (milhar, faixa com en dash, litros)", () => {
    renderCard();
    expect(within(screen.getByTestId("goal-kcal")).getByText("2.300")).toBeInTheDocument();
    expect(within(screen.getByTestId("goal-kcal")).getByText("kcal")).toBeInTheDocument();
    expect(within(screen.getByTestId("goal-protein")).getByText("150–170")).toBeInTheDocument();
    expect(within(screen.getByTestId("goal-fiber")).getByText("30–40")).toBeInTheDocument();
    expect(within(screen.getByTestId("goal-water")).getByText("2,5–3")).toBeInTheDocument();
    expect(within(screen.getByTestId("goal-water")).getByText("L")).toBeInTheDocument();
  });

  it("mostra objetivos como etiquetas e a observação persistida com autor", () => {
    renderCard();
    expect(screen.getByText("Emagrecimento")).toBeInTheDocument();
    expect(screen.getByText("Saúde metabólica")).toBeInTheDocument();
    expect(screen.getByText("Ajustaremos as porções conforme a evolução.")).toBeInTheDocument();
    expect(screen.getByText(/Dra\. Marina · atualizadas em/)).toBeInTheDocument();
  });

  it("meta parcial: nutriente ausente aparece como 'Não definida', nunca 0", () => {
    renderCard({ goals: { ...FULL, proteinMinG: null, proteinMaxG: null, waterMinMl: null, waterMaxMl: null } });
    expect(within(screen.getByTestId("goal-protein")).getByText("Não definida")).toBeInTheDocument();
    expect(within(screen.getByTestId("goal-water")).getByText("Não definida")).toBeInTheDocument();
    expect(within(screen.getByTestId("goal-kcal")).getByText("2.300")).toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("valor único (sem máximo) mostra só o mínimo", () => {
    renderCard({ goals: { ...FULL, proteinMaxG: null } });
    expect(within(screen.getByTestId("goal-protein")).getByText("150")).toBeInTheDocument();
  });

  it("sem metas: mensagem de vazio, sem grade de indicadores", () => {
    renderCard({ goals: null });
    expect(screen.getByText("Sem metas ainda.")).toBeInTheDocument();
    expect(screen.queryByTestId("goal-kcal")).not.toBeInTheDocument();
  });

  it("erro: alerta com 'Tentar novamente' que dispara o retry", async () => {
    const onRetry = vi.fn();
    renderCard({ state: "error", goals: null, onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar as metas agora.");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("loading: skeleton, sem título nem valores", () => {
    renderCard({ state: "loading", goals: null });
    expect(screen.queryByText("Metas diárias")).not.toBeInTheDocument();
    expect(screen.queryByTestId("goal-kcal")).not.toBeInTheDocument();
  });

  it("sem observação persistida: texto neutro, nunca orientação clínica gerada", () => {
    renderCard({ goals: { ...FULL, patientNote: null } });
    expect(screen.getByText("Metas definidas pelo seu acompanhamento nutricional.")).toBeInTheDocument();
    expect(screen.queryByText(/Ajustaremos/)).not.toBeInTheDocument();
  });
});

describe("formatGoals", () => {
  it("formatRange", () => {
    expect(formatRange(null, null)).toBeNull();
    expect(formatRange(150, null)).toBe("150");
    expect(formatRange(150, 150)).toBe("150");
    expect(formatRange(2.5, 3, 2)).toBe("2,5–3");
  });

  it("parseDecimalInput aceita PT-BR e recusa texto (NaN, nunca outro número)", () => {
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("  ")).toBeNull();
    expect(parseDecimalInput("2,5")).toBe(2.5);
    expect(parseDecimalInput("2.5")).toBe(2.5);
    expect(parseDecimalInput("2.300")).toBe(2300);
    expect(parseDecimalInput("2300")).toBe(2300);
    expect(parseDecimalInput("-10")).toBe(-10);
    expect(parseDecimalInput("abc")).toBeNaN();
    expect(parseDecimalInput("2,5L")).toBeNaN();
  });
});
