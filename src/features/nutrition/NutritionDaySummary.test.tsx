/**
 * PLAN_NUTRITION_QUICK_MACROS (P1B, adendo "Seu dia nutricional") — contratos
 * do §21: sem meta nunca inventa percentual, fibra parcial nunca aparece como
 * dado definitivo, selo "Meta do seu plano" vs "Estimativa diária" nunca se
 * confunde, e um refreshToken novo refaz a busca (atualização sem F5).
 *
 * PLAN P1B corrective ("Agrupamento por Refeição") — a unidade visual virou
 * REFEIÇÃO (`meals[]`), não log; os mocks abaixo constroem `meals` no MESMO
 * formato que `groupLogsIntoMeals` produziria no backend.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NutritionDaySummary } from "./NutritionDaySummary";

const getDayIntake = vi.fn();
const deleteIntakeLog = vi.fn();
const updateIntakeLog = vi.fn();
const getIntakeShortcuts = vi.fn();

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return {
    ...actual,
    getDayIntake: (...args: unknown[]) => getDayIntake(...args),
    deleteIntakeLog: (...args: unknown[]) => deleteIntakeLog(...args),
    updateIntakeLog: (...args: unknown[]) => updateIntakeLog(...args),
    getIntakeShortcuts: (...args: unknown[]) => getIntakeShortcuts(...args),
  };
});

const BASE_ITEM = {
  foodId: 7, name: "Ovo, de galinha, inteiro, cru", grams: 100,
  energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15,
  fiberG: null, resolver: "catalog" as const, confidence: "high" as const, confirmed: true,
};

const BASE_LOG = {
  id: 1, dateKey: "2026-09-17", loggedAt: "2026-09-17T12:00:00Z", mealId: null,
  label: "Almoço", rawText: null, energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15,
  fiberG: 5, fiberPartial: false, items: [] as (typeof BASE_ITEM)[], confidenceScore: 1, source: "manual", isFavorite: false,
};

/** Espelha `groupLogsIntoMeals` — 1 log sem `mealId` = 1 refeição extra, própria. */
function toMeal(log: typeof BASE_LOG) {
  return {
    groupKey: `log:${log.id}`,
    mealId: log.mealId,
    label: log.label,
    loggedAt: log.loggedAt,
    isExtra: log.mealId == null,
    items: log.items,
    energyKcal: log.energyKcal,
    proteinG: log.proteinG,
    carbohydrateG: log.carbohydrateG,
    fatG: log.fatG,
    fiberG: log.fiberG,
    fiberPartial: log.fiberPartial,
    confidenceScore: log.confidenceScore,
    sourceLogIds: [log.id],
  };
}

beforeEach(() => {
  getDayIntake.mockReset();
  deleteIntakeLog.mockReset().mockResolvedValue(undefined);
  updateIntakeLog.mockReset();
  getIntakeShortcuts.mockReset().mockResolvedValue({ recent: [], favorites: [], yesterdayMeals: [], planMeals: [] });
});

describe("NutritionDaySummary", () => {
  it("sem meta: mostra só valores absolutos, nunca percentual/barra inventados", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      meals: [toMeal(BASE_LOG)],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 5, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 3, coverageRatio: 0.33, confidence: 1, level: "low" },
      target: null,
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    // "500 kcal" aparece 2x hoje: no total absoluto (sem meta) e na linha da
    // lista "Refeições de hoje" — ambíguo por design, não é bug.
    expect((await screen.findAllByText("500 kcal")).length).toBeGreaterThan(0);
    expect(screen.getByText("Refeições de hoje")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText("Meta do seu plano")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimativa diária")).not.toBeInTheDocument();
  });

  it("meta do plano: selo 'Meta do seu plano', percentual real, gráfico com refeições do plano", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      meals: [toMeal(BASE_LOG)],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 5, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 3, coverageRatio: 0.33, confidence: 1, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      plannedMeals: [
        { mealId: 1, name: "Café da manhã", orderIndex: 0, energyKcal: 400 },
        { mealId: 2, name: "Almoço", orderIndex: 1, energyKcal: 600 },
      ],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText("Meta do seu plano")).toBeInTheDocument();
    expect(screen.getByText("500 / 2000 kcal")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    // Distribuição orientativa NUNCA aparece quando existe plano estruturado real.
    expect(screen.queryByText(/Distribuição orientativa/)).not.toBeInTheDocument();
  });

  it("estimativa própria: selo 'Estimativa diária', kcal com ≈, gráfico rotulado como orientativo", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      meals: [toMeal(BASE_LOG)],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 4, coverageRatio: 0.25, confidence: 1, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "self_estimate" },
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText("Estimativa diária")).toBeInTheDocument();
    expect(screen.getByText(/≈ 500 \/ 2000 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/Distribuição orientativa/)).toBeInTheDocument();
  });

  it("fibra parcial: mostra o valor com aviso 'dados parciais', nunca como dado definitivo", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      meals: [toMeal(BASE_LOG)],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 8, fiberPartial: true },
      coverage: { loggedMeals: 1, expectedMeals: 4, coverageRatio: 0.25, confidence: 1, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText(/dados parciais/)).toBeInTheDocument();
  });

  it("sem fibra conhecida em nenhum item: indicador de fibra não aparece", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [BASE_LOG],
      meals: [toMeal(BASE_LOG)],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 4, coverageRatio: 0.25, confidence: 1, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    await screen.findByText("Meta do seu plano");
    expect(screen.queryByText("Fibra")).not.toBeInTheDocument();
  });

  it("zero registros com meta: mostra estado leve no lugar do gráfico, sem quebrar", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [],
      meals: [],
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 0, expectedMeals: 4, coverageRatio: 0, confidence: 0, level: "low" },
      target: { energyKcal: 2000, proteinG: 150, carbohydrateG: 200, fatG: 60, mealsPerDay: 4, source: "plan_items" },
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);

    expect(await screen.findByText("Nenhuma refeição registrada ainda.")).toBeInTheDocument();
    expect(screen.getByText("0 / 2000 kcal")).toBeInTheDocument();
  });

  it("mudar refreshToken refaz a busca (atualização sem F5)", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [],
      meals: [],
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 0, expectedMeals: 3, coverageRatio: 0, confidence: 0, level: "low" },
      target: null,
      plannedMeals: [],
    });
    const { rerender } = render(<NutritionDaySummary refreshToken={0} />);
    await waitFor(() => expect(getDayIntake).toHaveBeenCalledTimes(1));

    rerender(<NutritionDaySummary refreshToken={1} />);
    await waitFor(() => expect(getDayIntake).toHaveBeenCalledTimes(2));
  });

  it("erro na busca mostra estado compacto com retry", async () => {
    getDayIntake.mockRejectedValue(new Error("network"));
    render(<NutritionDaySummary />);
    expect(await screen.findByText(/Não foi possível carregar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it('"+ Registrar alimento" sempre visível — mesmo sem nenhuma refeição hoje e sem plano', async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [],
      meals: [],
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 0, expectedMeals: 3, coverageRatio: 0, confidence: 0, level: "low" },
      target: null,
      plannedMeals: [],
    });
    render(<NutritionDaySummary />);
    expect(await screen.findByRole("button", { name: /Registrar alimento/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corrigir refeição de ontem" })).toBeInTheDocument();
  });

  // PLAN P1B corrective — "Consulta + Edição de Refeição Registrada" /
  // "Agrupamento por Refeição".
  describe("Consulta / Edição / Exclusão de refeição registrada", () => {
    const LOG_WITH_ITEMS = { ...BASE_LOG, items: [BASE_ITEM] };
    const MEAL_WITH_ITEMS = toMeal(LOG_WITH_ITEMS);
    const DAY_RESPONSE = {
      date: "2026-09-17",
      logs: [LOG_WITH_ITEMS],
      meals: [MEAL_WITH_ITEMS],
      totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 1, expectedMeals: 3, coverageRatio: 0.33, confidence: 1, level: "low" as const },
      target: null,
      plannedMeals: [],
    };

    it('tocar na linha "Refeições de hoje" abre o detalhe com itens e total', async () => {
      getDayIntake.mockResolvedValue(DAY_RESPONSE);
      render(<NutritionDaySummary />);

      await userEvent.click(await screen.findByRole("button", { name: /Almoço/ }));

      // O nome do item aparece na linha compacta E no card do detalhe — ambos coexistem no DOM.
      expect((await screen.findAllByText("Ovo, de galinha, inteiro, cru")).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
      // Log não tem mealId → é registro livre. SEM plano não há "fora de quê": nenhuma etiqueta (nem "Extra").
      expect(screen.queryByText("Fora do plano")).not.toBeInTheDocument();
      expect(screen.queryByText("Extra")).not.toBeInTheDocument();
    });

    it('COM plano estruturado o registro livre ganha a etiqueta neutra "Fora do plano" e a divisão do dia', async () => {
      const planLog = { ...BASE_LOG, id: 2, mealId: 42, label: "Café da manhã", energyKcal: 300, items: [BASE_ITEM] };
      const freeLog = { ...LOG_WITH_ITEMS, id: 3, label: "Lanche da tarde", energyKcal: 200 };
      getDayIntake.mockResolvedValue({
        ...DAY_RESPONSE,
        logs: [planLog, freeLog],
        meals: [toMeal(planLog), toMeal(freeLog)],
        plannedMeals: [{ mealId: 42, name: "Café da manhã", orderIndex: 0, energyKcal: 400 }],
      });
      render(<NutritionDaySummary />);
      expect(await screen.findByTestId("plan-split")).toHaveTextContent("Do plano 300 kcal · Fora do plano 200 kcal");
      // na lista: só o registro livre leva a etiqueta
      const tags = screen.getAllByText("Fora do plano").filter((el) => el.className.includes("badge"));
      expect(tags).toHaveLength(1);
      await userEvent.click(await screen.findByRole("button", { name: /Lanche da tarde/ }));
      expect(screen.getAllByText("Fora do plano").length).toBeGreaterThan(1); // lista + detalhe
    });

    it("sem plano: nenhuma divisão 'Do plano / Fora do plano' (não há plano para comparar)", async () => {
      getDayIntake.mockResolvedValue(DAY_RESPONSE);
      render(<NutritionDaySummary />);
      await screen.findByRole("button", { name: /Almoço/ });
      expect(screen.queryByTestId("plan-split")).not.toBeInTheDocument();
    });

    it('"Editar" fecha o detalhe e abre o MESMO editor (espaço de trabalho) já com os itens salvos', async () => {
      getDayIntake.mockResolvedValue(DAY_RESPONSE);
      render(<NutritionDaySummary />);

      await userEvent.click(await screen.findByRole("button", { name: /Almoço/ }));
      await screen.findByRole("button", { name: "Editar" });
      await userEvent.click(screen.getByRole("button", { name: "Editar" }));

      expect(await screen.findByRole("dialog", { name: "Editar refeição" })).toBeInTheDocument();
      expect(screen.getByRole("list", { name: "Alimentos salvos" })).toBeInTheDocument();
      expect(screen.getAllByText("Ovo, de galinha, inteiro, cru").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Pronto" })).toBeInTheDocument();
    });

    it("salvar um item editado atualiza o dia em silêncio: a folha continua aberta, sem skeleton", async () => {
      getDayIntake.mockResolvedValue(DAY_RESPONSE);
      updateIntakeLog.mockResolvedValue({ ...LOG_WITH_ITEMS, energyKcal: 750, updatedAt: "2026-09-17T12:05:00Z" });
      render(<NutritionDaySummary />);

      await userEvent.click(await screen.findByRole("button", { name: /Almoço/ }));
      await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
      await screen.findByRole("dialog", { name: "Editar refeição" });

      await userEvent.click(screen.getByRole("button", { name: `Editar ${BASE_ITEM.name}` }));
      const qty = screen.getByLabelText("Quantidade (g)");
      await userEvent.clear(qty);
      await userEvent.type(qty, "150");
      await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

      // PATCH no id físico da refeição (nunca POST), rótulo preservado; o cliente só manda a quantidade nova —
      // gramas e nutrientes são do servidor
      await waitFor(() =>
        expect(updateIntakeLog).toHaveBeenCalledWith(
          MEAL_WITH_ITEMS.sourceLogIds[0],
          expect.objectContaining({ label: "Almoço", items: [{ kind: "existing", index: 0, quantity: 150 }] })
        )
      );
      // O dia é relido (2ª chamada) sem desmontar a folha: nada de skeleton, diálogo segue aberto
      await waitFor(() => expect(getDayIntake).toHaveBeenCalledTimes(2));
      expect(screen.getByRole("dialog", { name: "Editar refeição" })).toBeInTheDocument();
      expect(document.querySelector(".pp-skeleton-card")).toBeNull();
    });

    it('"Excluir" pede confirmação e só chama deleteIntakeLog após confirmar', async () => {
      getDayIntake.mockResolvedValue(DAY_RESPONSE);
      render(<NutritionDaySummary />);

      await userEvent.click(await screen.findByRole("button", { name: /Almoço/ }));
      await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

      expect(await screen.findByText("Excluir esta refeição?")).toBeInTheDocument();
      expect(screen.getByText(/deixará de contar nos totais de hoje/)).toBeInTheDocument();
      expect(deleteIntakeLog).not.toHaveBeenCalled();

      // 2 botões "Excluir" agora (o do detalhe + o do ConfirmDialog) — o
      // último no DOM é o do diálogo de confirmação.
      const excluirButtons = screen.getAllByRole("button", { name: "Excluir" });
      await userEvent.click(excluirButtons[excluirButtons.length - 1]);

      await waitFor(() => expect(deleteIntakeLog).toHaveBeenCalledWith(LOG_WITH_ITEMS.id));
      await waitFor(() => expect(getDayIntake).toHaveBeenCalledTimes(2)); // reload após excluir
    });

    it('"Pronto" sem alterar nada fecha o editor sem gravar nem recarregar o dia', async () => {
      getDayIntake.mockResolvedValue(DAY_RESPONSE);
      render(<NutritionDaySummary />);

      await userEvent.click(await screen.findByRole("button", { name: /Almoço/ }));
      await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
      await screen.findByRole("dialog", { name: "Editar refeição" });

      await userEvent.click(screen.getByRole("button", { name: "Pronto" }));

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar refeição" })).not.toBeInTheDocument());
      expect(updateIntakeLog).not.toHaveBeenCalled();
      expect(getDayIntake).toHaveBeenCalledTimes(1);
    });

    it('refeição associada a um plan meal (mealId != null) NÃO mostra o selo "Fora do plano"', async () => {
      const planLog = { ...LOG_WITH_ITEMS, mealId: 42, label: "Café da manhã" };
      getDayIntake.mockResolvedValue({ ...DAY_RESPONSE, logs: [planLog], meals: [toMeal(planLog)] });
      render(<NutritionDaySummary />);

      await userEvent.click(await screen.findByRole("button", { name: /Café da manhã/ }));
      expect(screen.queryByText("Fora do plano")).not.toBeInTheDocument();
    });
  });

  // Spec 039 — meta prescrita pelo nutri vence por nutriente; consumo segue
  // vindo só dos registros. Carb/gordura do plano preservados.
  describe("meta prescrita pelo nutri", () => {
    const NUTRI_TARGET = {
      energyKcal: 2300, proteinG: 150, carbohydrateG: 210, fatG: 70, mealsPerDay: 4,
      source: "nutri_goal", proteinRange: { minG: 150, maxG: 170 },
    };

    it("selo 'Meta do seu nutricionista', sem ≈, proteína contra o mínimo com a faixa indicada", async () => {
      getDayIntake.mockResolvedValue({
        date: "2026-09-17",
        logs: [BASE_LOG],
        meals: [toMeal(BASE_LOG)],
        totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 5, fiberPartial: false },
        coverage: { loggedMeals: 1, expectedMeals: 4, coverageRatio: 0.25, confidence: 1, level: "low" },
        target: NUTRI_TARGET,
        plannedMeals: [{ mealId: 1, name: "Almoço", orderIndex: 0, energyKcal: 1500 }],
      });
      render(<NutritionDaySummary />);

      expect(await screen.findByText("Meta do seu nutricionista")).toBeInTheDocument();
      // Texto exato: com prefixo "≈ " (estimativa) não casaria.
      expect(screen.getByText("500 / 2300 kcal")).toBeInTheDocument();
      expect(screen.getByText("40 / 150 g")).toBeInTheDocument();
      expect(screen.getByText("Faixa recomendada: 150–170 g")).toBeInTheDocument();
      expect(screen.getByText("50 / 210 g")).toBeInTheDocument();
    });

    it("meta só com calorias: macros sem meta mostram só o registrado (nunca '/0')", async () => {
      getDayIntake.mockResolvedValue({
        date: "2026-09-17",
        logs: [BASE_LOG],
        meals: [toMeal(BASE_LOG)],
        totals: { energyKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 5, fiberPartial: false },
        coverage: { loggedMeals: 1, expectedMeals: 3, coverageRatio: 0.33, confidence: 1, level: "low" },
        target: { energyKcal: 2000, proteinG: null, carbohydrateG: null, fatG: null, mealsPerDay: 3, source: "nutri_goal", proteinRange: null },
        plannedMeals: [],
      });
      render(<NutritionDaySummary />);

      expect(await screen.findByText("500 / 2000 kcal")).toBeInTheDocument();
      expect(screen.queryByText(/\/ 0 g/)).not.toBeInTheDocument();
    });
  });

  it("openSheetOnMount (atalho do perfil) abre o sheet de registro já existente", async () => {
    getDayIntake.mockResolvedValue({
      date: "2026-09-17",
      logs: [],
      meals: [],
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, fiberPartial: false },
      coverage: { loggedMeals: 0, expectedMeals: 3, coverageRatio: 0, confidence: 0, level: "none" },
      target: null,
      plannedMeals: [],
    });
    render(<NutritionDaySummary openSheetOnMount />);
    // Mesmo fluxo do CTA do diário (refeição extra / registro incremental).
    expect(await screen.findByRole("dialog", { name: "Registrar alimento" })).toBeInTheDocument();
  });
});
