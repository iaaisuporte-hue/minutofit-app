/**
 * PLAN_NUTRITION_QUICK_MACROS (P1B) — trava o "3 toques" do caminho rápido
 * (chip → confirmar) e a regra "Confirmar desabilitado enquanto houver item
 * não resolvido ou de baixa confiança sem aceite".
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IntakeLogSheet } from "./IntakeLogSheet";

const getIntakeShortcuts = vi.fn();
const parseIntakeText = vi.fn();
const submitIntakeLog = vi.fn();

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return {
    ...actual,
    getIntakeShortcuts: (...args: unknown[]) => getIntakeShortcuts(...args),
    parseIntakeText: (...args: unknown[]) => parseIntakeText(...args),
    submitIntakeLog: (...args: unknown[]) => submitIntakeLog(...args),
  };
});

const EMPTY_SHORTCUTS = { recent: [], favorites: [], yesterdayMeals: [], planMeals: [] };

beforeEach(() => {
  getIntakeShortcuts.mockReset().mockResolvedValue(EMPTY_SHORTCUTS);
  parseIntakeText.mockReset();
  submitIntakeLog.mockReset().mockResolvedValue({ id: 1, dateKey: "2026-09-16", energyKcal: 128 });
});

describe("IntakeLogSheet", () => {
  it("chip do plano → confirmar é o caminho de 3 toques (abrir já contado, chip, confirmar)", async () => {
    getIntakeShortcuts.mockResolvedValue({
      ...EMPTY_SHORTCUTS,
      planMeals: [{ mealId: 10, name: "Almoço", items: [{ id: 500, foodName: "Arroz", energyKcal: 128, proteinG: 2.5, carbohydrateG: 28, fatG: 0.2, grams: 100 }] }],
    });
    const onSaved = vi.fn();
    render(<IntakeLogSheet open onClose={() => {}} onSaved={onSaved} />);

    const chip = await screen.findByRole("button", { name: /Como no plano: Almoço/ });
    await userEvent.click(chip); // toque 2

    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmBtn).not.toBeDisabled();
    await userEvent.click(confirmBtn); // toque 3

    await waitFor(() => expect(submitIntakeLog).toHaveBeenCalled());
    const [call] = submitIntakeLog.mock.calls[0];
    expect(call.items).toEqual([{ kind: "plan", planMealItemId: 500 }]);
    expect(call.source).toBe("plan");
    expect(onSaved).toHaveBeenCalled();
  });

  it("texto → Estimar → item resolvido de alta confiança → Confirmar habilitado", async () => {
    parseIntakeText.mockResolvedValue({
      items: [
        {
          resolved: true, rawText: "200g de frango", foodQuery: "frango", foodId: 7, name: "Frango, peito, grelhado",
          grams: 200, per100g: { kcal: 100, p: 20, c: 0, f: 2 }, energyKcal: 200, proteinG: 40, carbohydrateG: 0, fatG: 4,
          resolver: "catalog", confidence: "high", confirmed: true,
        },
      ],
      totals: { energyKcal: 200, proteinG: 40, carbohydrateG: 0, fatG: 4 },
      needsConfirmation: false,
    });
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
    await userEvent.type(input, "200g de frango");
    await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

    await screen.findByText(/Frango, peito, grelhado/);
    expect(screen.getByRole("button", { name: "Confirmar" })).not.toBeDisabled();
  });

  it("item de baixa confiança mantém Confirmar desabilitado até o toque de aceite", async () => {
    parseIntakeText.mockResolvedValue({
      items: [
        {
          resolved: true, rawText: "um pouco de comida", foodQuery: "comida", foodId: 9, name: "Comida qualquer",
          grams: 100, per100g: { kcal: 100, p: 10, c: 10, f: 5 }, energyKcal: 100, proteinG: 10, carbohydrateG: 10, fatG: 5,
          resolver: "catalog", confidence: "low", confirmed: false,
        },
      ],
      totals: { energyKcal: 100, proteinG: 10, carbohydrateG: 10, fatG: 5 },
      needsConfirmation: true,
    });
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
    await userEvent.type(input, "um pouco de comida");
    await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

    await screen.findByText(/Comida qualquer/);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Confirme" }));
    expect(screen.getByRole("button", { name: "Confirmar" })).not.toBeDisabled();
  });

  it("item não resolvido mantém Confirmar desabilitado e NÃO mostra total 0 kcal (PLAN P1B corrective §13)", async () => {
    parseIntakeText.mockResolvedValue({
      items: [{ resolved: false, rawText: "xyz123", foodQuery: "xyz123" }],
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 },
      needsConfirmation: true,
    });
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
    await userEvent.type(input, "xyz123");
    await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

    await screen.findByText(/"xyz123"/);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    // 0 significa "zero kcal real", nunca "não identificado" — com item
    // unresolved a tela pede identificação, nunca mostra "0 kcal".
    expect(screen.queryByText(/0 kcal/)).not.toBeInTheDocument();
    expect(screen.getByText(/Identifique os alimentos/)).toBeInTheDocument();
  });

  // PLAN P1B corrective §14/§21 — o caso "1 pão francês": fuzzy match médio
  // mostra "Você quis dizer?" e resolve com um único toque, sem busca manual.
  it('confiança "medium" mostra "Você quis dizer?" com "Usar este" — mesmo caminho do "1 pão francês"', async () => {
    parseIntakeText.mockResolvedValue({
      items: [
        {
          resolved: true, rawText: "1 pao francez", foodQuery: "pao francez", foodId: 42, name: "Pão, trigo, francês",
          grams: 50, per100g: { kcal: 300, p: 8, c: 58, f: 3 }, energyKcal: 150, proteinG: 4, carbohydrateG: 29, fatG: 1.5,
          resolver: "catalog", confidence: "medium", confirmed: false, matchScore: 0.83,
        },
      ],
      totals: { energyKcal: 150, proteinG: 4, carbohydrateG: 29, fatG: 1.5 },
      needsConfirmation: true,
    });
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
    await userEvent.type(input, "1 pao francez");
    await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

    await screen.findByText(/Você quis dizer/);
    expect(screen.getByText(/Pão, trigo, francês/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    // Nenhum detalhe técnico do resolver aparece para o usuário.
    expect(screen.queryByText(/matchScore|0\.83|fuzzy|resolver/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Usar este" }));
    expect(screen.getByRole("button", { name: "Confirmar" })).not.toBeDisabled();
  });

  it('confiança "medium" oferece "Buscar outro alimento" sem sair da jornada', async () => {
    parseIntakeText.mockResolvedValue({
      items: [
        {
          resolved: true, rawText: "1 pao francez", foodQuery: "pao francez", foodId: 42, name: "Pão, trigo, francês",
          grams: 50, per100g: { kcal: 300, p: 8, c: 58, f: 3 }, energyKcal: 150, proteinG: 4, carbohydrateG: 29, fatG: 1.5,
          resolver: "catalog", confidence: "medium", confirmed: false,
        },
      ],
      totals: { energyKcal: 150, proteinG: 4, carbohydrateG: 29, fatG: 1.5 },
      needsConfirmation: true,
    });
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
    await userEvent.type(input, "1 pao francez");
    await userEvent.click(screen.getByRole("button", { name: "Estimar" }));
    await screen.findByText(/Você quis dizer/);

    await userEvent.click(screen.getByRole("button", { name: "Buscar outro alimento" }));
    expect(screen.getByPlaceholderText("Buscar alimento…")).toBeInTheDocument();
  });

  // PLAN P1B corrective "Agrupamento por Refeição" §7-§10/§22 — registro
  // extra de baixa fricção: texto → Estimar → momento sugerido → Confirmar.
  describe("refeição extra (fora do plano)", () => {
    it('depois de "Estimar" (sem chip), mostra o seletor "Refeição" com sugestão pelo horário e usa como rótulo ao confirmar', async () => {
      parseIntakeText.mockResolvedValue({
        items: [
          {
            resolved: true, rawText: "30g de whey", foodQuery: "whey", foodId: 99, name: "Whey protein (30g)",
            grams: 30, per100g: { kcal: 400, p: 80, c: 10, f: 3 }, energyKcal: 120, proteinG: 24, carbohydrateG: 3, fatG: 1,
            resolver: "manual", confidence: "high", confirmed: true,
          },
        ],
        totals: { energyKcal: 120, proteinG: 24, carbohydrateG: 3, fatG: 1 },
        needsConfirmation: false,
      });
      const onSaved = vi.fn();
      render(<IntakeLogSheet open onClose={() => {}} onSaved={onSaved} />);

      const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
      await userEvent.type(input, "30g de whey");
      await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

      await screen.findByText(/Whey protein/);
      expect(screen.getByLabelText("Refeição")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

      await waitFor(() => expect(submitIntakeLog).toHaveBeenCalled());
      const [call] = submitIntakeLog.mock.calls[0];
      expect(call.mealId).toBeNull(); // nunca associada ao plano — é extra (§7)
      expect(typeof call.label).toBe("string");
      expect(call.label.length).toBeGreaterThan(0);
      expect(onSaved).toHaveBeenCalled();
    });

    it('selecionar "Outro" revela campo de texto curto e usa o texto digitado como rótulo', async () => {
      parseIntakeText.mockResolvedValue({
        items: [
          {
            resolved: true, rawText: "30g de whey", foodQuery: "whey", foodId: 99, name: "Whey protein (30g)",
            grams: 30, per100g: { kcal: 400, p: 80, c: 10, f: 3 }, energyKcal: 120, proteinG: 24, carbohydrateG: 3, fatG: 1,
            resolver: "manual", confidence: "high", confirmed: true,
          },
        ],
        totals: { energyKcal: 120, proteinG: 24, carbohydrateG: 3, fatG: 1 },
        needsConfirmation: false,
      });
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

      const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
      await userEvent.type(input, "30g de whey");
      await userEvent.click(screen.getByRole("button", { name: "Estimar" }));
      await screen.findByText(/Whey protein/);

      await userEvent.selectOptions(screen.getByLabelText("Refeição"), "Outro");
      const customInput = screen.getByPlaceholderText("Ex.: Pré-treino");
      await userEvent.type(customInput, "Pré-treino");

      await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
      await waitFor(() => expect(submitIntakeLog).toHaveBeenCalledWith(expect.objectContaining({ label: "Pré-treino" })));
    });

    it("um chip de atalho já define o rótulo — o seletor de momento não aparece nem sobrescreve", async () => {
      getIntakeShortcuts.mockResolvedValue({
        ...EMPTY_SHORTCUTS,
        planMeals: [{ mealId: 10, name: "Almoço", items: [{ id: 500, foodName: "Arroz", energyKcal: 128, proteinG: 2.5, carbohydrateG: 28, fatG: 0.2, grams: 100 }] }],
      });
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

      await userEvent.click(await screen.findByRole("button", { name: /Como no plano: Almoço/ }));
      expect(screen.queryByLabelText("Refeição")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
      await waitFor(() => expect(submitIntakeLog).toHaveBeenCalledWith(expect.objectContaining({ label: "Como no plano: Almoço" })));
    });
  });

  // PLAN CANONICAL_FOOD_MODEL_SPIKE.md §6/§10/§23 — nome canônico em vez da
  // taxonomia bruta da fonte, preparo como legenda própria, e chips de
  // desambiguação de 1 toque reaproveitando os candidatos já calculados.
  describe("Canonical Food + candidatos (§6/§10)", () => {
    it('mostra o nome canônico ("Peito de frango") e o preparo como legenda ("grelhado") — nunca a string bruta da fonte', async () => {
      parseIntakeText.mockResolvedValue({
        items: [
          {
            resolved: true, rawText: "200g de frango grelhado", foodQuery: "frango grelhado", foodId: 7,
            name: "Frango, peito, sem pele, grelhado",
            canonicalFood: { baseFood: "peito de frango", variant: null, preparation: "grelhado" },
            grams: 200, per100g: { kcal: 159, p: 32, c: 0, f: 2.5 }, energyKcal: 318, proteinG: 64, carbohydrateG: 0, fatG: 5,
            resolver: "catalog", confidence: "high", confirmed: true,
          },
        ],
        totals: { energyKcal: 318, proteinG: 64, carbohydrateG: 0, fatG: 5 },
        needsConfirmation: false,
      });
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

      const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
      await userEvent.type(input, "200g de frango grelhado");
      await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

      await screen.findByText("Peito de frango");
      expect(screen.getByText("grelhado")).toBeInTheDocument();
      expect(screen.queryByText(/Frango, peito, sem pele, grelhado/)).not.toBeInTheDocument();
    });

    it('ambiguidade genuína mostra chips de candidatos — tocar um resolve direto, sem busca manual', async () => {
      parseIntakeText.mockResolvedValue({
        items: [
          {
            resolved: true, rawText: "2 ovos mexidos", foodQuery: "ovo mexidos", foodId: 478,
            name: "Ovo, de galinha, inteiro, frito",
            canonicalFood: { baseFood: "ovo", variant: null, preparation: null },
            grams: 100, per100g: { kcal: 240, p: 15.6, c: 1.2, f: 18.6 }, energyKcal: 240, proteinG: 15.6, carbohydrateG: 1.2, fatG: 18.6,
            resolver: "catalog", confidence: "low", confirmed: false,
            candidates: [
              { foodId: 474, canonicalFood: { baseFood: "Ovo, de galinha, clara", variant: null, preparation: "cozido" }, per100g: { kcal: 50, p: 11, c: 0, f: 0.2 } },
              { foodId: 475, canonicalFood: { baseFood: "Ovo, de galinha, gema", variant: null, preparation: "cozido" }, per100g: { kcal: 350, p: 16, c: 1, f: 30 } },
            ],
          },
        ],
        totals: { energyKcal: 240, proteinG: 15.6, carbohydrateG: 1.2, fatG: 18.6 },
        needsConfirmation: true,
      });
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

      const input = screen.getByPlaceholderText(/Ex\.: 200g de frango/);
      await userEvent.type(input, "2 ovos mexidos");
      await userEvent.click(screen.getByRole("button", { name: "Estimar" }));

      await screen.findByRole("toolbar", { name: "Alternativas" });
      expect(screen.getByRole("button", { name: /Ovo, de galinha, clara · cozido/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();

      await userEvent.click(screen.getByRole("button", { name: /Ovo, de galinha, gema · cozido/ }));
      expect(screen.getByRole("button", { name: "Confirmar" })).not.toBeDisabled();
    });
  });

  it("Cancelar fecha sem chamar submitIntakeLog", async () => {
    const onClose = vi.fn();
    render(<IntakeLogSheet open onClose={onClose} onSaved={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(submitIntakeLog).not.toHaveBeenCalled();
  });
});
