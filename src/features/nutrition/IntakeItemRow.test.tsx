/**
 * P1 — escolher o alimento na busca para um item NÃO resolvido ("150 ml de iogurte", "1 biscoito") não pode
 * gravar 100 g com o rótulo "150 ml": gramas desconhecidos viram um ponto de partida em gramas, honesto.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IntakeItemRow, recomputeItemGrams } from "./IntakeItemRow";
import { previewToRequest } from "./intakeWorking";
import type { IntakePreviewItem } from "../../services/nutritionIntakeApi";

const searchNutritionFoods = vi.fn();
vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return { ...actual, searchNutritionFoods: (...a: unknown[]) => searchNutritionFoods(...a) };
});

const YOGURT = { id: 31, name: "Iogurte, natural", energyKcal: 51, proteinG: 4.1, carbohydrateG: 1.9, fatG: 3 };

function Harness({ initial, spy }: { initial: IntakePreviewItem; spy: (i: IntakePreviewItem) => void }) {
  const [item, setItem] = useState(initial);
  return (
    <IntakeItemRow
      item={item}
      onChange={(n) => {
        spy(n);
        setItem(n);
      }}
      onRemove={() => {}}
    />
  );
}

beforeEach(() => {
  searchNutritionFoods.mockReset().mockResolvedValue([YOGURT]);
});

describe("IntakeItemRow — escolher alimento para item não resolvido", () => {
  it("'150 ml de iogurte' (sem densidade): vira 100 g em gramas, sem manter o rótulo '150 ml' com macros de 100 g", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} initial={{ resolved: false, rawText: "150 ml de iogurte", foodQuery: "iogurte", quantity: 150, unitLabel: "ml" }} />);

    await userEvent.click(screen.getByRole("button", { name: /Buscar no catálogo/ }));
    await userEvent.type(screen.getByPlaceholderText("Buscar alimento…"), "s");
    await userEvent.click(await screen.findByRole("button", { name: "Iogurte, natural" }));

    const picked = spy.mock.calls.at(-1)![0] as IntakePreviewItem;
    expect(picked.grams).toBe(100);
    expect(picked.unitLabel).toBeUndefined();
    expect(picked.quantity).toBeUndefined();
    // o que é gravado: 100 g, sem "display 150 ml" desacoplado das calorias
    expect(previewToRequest(picked)).toMatchObject({ kind: "food", quantity: 100, displayQuantity: null, displayUnitLabel: null });
    // e o aluno vê o ajuste em gramas, com a explicação
    expect(await screen.findByText("100g")).toBeInTheDocument();
    expect(screen.getByText(/ajuste a quantidade em gramas/i)).toBeInTheDocument();
  });

  it("quando os gramas JÁ são conhecidos (medida resolvida) a unidade dita pelo aluno é preservada", async () => {
    const spy = vi.fn();
    render(
      <Harness
        spy={spy}
        initial={{
          resolved: true, rawText: "200 ml de leite", foodQuery: "leite", foodId: 1, name: "Leite, de vaca, integral", grams: 206,
          per100g: { kcal: 61, p: 3.2, c: 4.8, f: 3.3 }, energyKcal: 125.7, proteinG: 6.5, carbohydrateG: 9.9, fatG: 6.7,
          quantity: 200, unitLabel: "ml", resolver: "measure", confidence: "medium", confirmed: false,
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Buscar outro alimento" }));
    await userEvent.type(screen.getByPlaceholderText("Buscar alimento…"), "s");
    await userEvent.click(await screen.findByRole("button", { name: "Iogurte, natural" }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const picked = spy.mock.calls.at(-1)![0] as IntakePreviewItem;
    expect(picked.grams).toBe(206);
    expect(picked.unitLabel).toBe("ml");
    expect(picked.quantity).toBe(200);
  });

  it("item não resolvido já mostra as opções do catálogo para a consulta do aluno (sem 'Nenhum resultado' falso antes de buscar)", async () => {
    render(<Harness spy={vi.fn()} initial={{ resolved: false, rawText: "150 ml de iogurte", foodQuery: "iogurte", quantity: 150, unitLabel: "ml" }} />);
    expect(await screen.findByRole("button", { name: "Iogurte, natural" })).toBeInTheDocument();
    expect(searchNutritionFoods).toHaveBeenCalledWith("iogurte");
    expect(screen.queryByText(/Nenhum resultado/)).not.toBeInTheDocument();
  });

  it("busca sem resultado de fato mostra 'Nenhum resultado no catálogo'", async () => {
    searchNutritionFoods.mockResolvedValue([]);
    render(<Harness spy={vi.fn()} initial={{ resolved: false, rawText: "1 xyzzy", foodQuery: "xyzzy", quantity: 1, unitLabel: "unidade" }} />);
    expect(await screen.findByText(/Nenhum resultado no catálogo/)).toBeInTheDocument();
  });
});

describe("recomputeItemGrams", () => {
  const rice: IntakePreviewItem = {
    resolved: true, rawText: "100 g de arroz", foodQuery: "arroz", name: "Arroz", grams: 100, quantity: 100, unitLabel: "g",
    per100g: { kcal: 128, p: 2.5, c: 28, f: 0.2 }, energyKcal: 128, proteinG: 2.5, carbohydrateG: 28, fatG: 0.2,
  };
  it("item em gramas: a quantidade exibida acompanha os gramas (nunca '100 g' com calorias de 120 g)", () => {
    const next = recomputeItemGrams(rice, 120);
    expect(next).toMatchObject({ grams: 120, quantity: 120, unitLabel: "g", energyKcal: 153.6 });
    expect(previewToRequest(next)).toMatchObject({ quantity: 120, displayQuantity: 120, displayUnitLabel: "g" });
  });
  it("item sem unidade informada também vira gramas", () => {
    expect(recomputeItemGrams({ ...rice, quantity: undefined, unitLabel: undefined }, 130)).toMatchObject({ quantity: 130, unitLabel: "g" });
  });
});
