/**
 * Registro alimentar incremental (P0) — a folha é o ESPAÇO DE TRABALHO da refeição:
 * cada alimento confirmado é gravado na hora, a folha continua aberta, "Pronto" só fecha.
 * Preserva as regras de confiança (alta entra direto; média/baixa/não resolvida espera o toque do aluno).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IntakeLogSheet } from "./IntakeLogSheet";

const getIntakeShortcuts = vi.fn();
const parseIntakeText = vi.fn();
const submitIntakeLog = vi.fn();
const updateIntakeLog = vi.fn();
const deleteIntakeLog = vi.fn();
const getDayIntake = vi.fn();

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return {
    ...actual,
    getIntakeShortcuts: (...args: unknown[]) => getIntakeShortcuts(...args),
    parseIntakeText: (...args: unknown[]) => parseIntakeText(...args),
    submitIntakeLog: (...args: unknown[]) => submitIntakeLog(...args),
    updateIntakeLog: (...args: unknown[]) => updateIntakeLog(...args),
    deleteIntakeLog: (...args: unknown[]) => deleteIntakeLog(...args),
    getDayIntake: (...args: unknown[]) => getDayIntake(...args),
  };
});

const EMPTY_SHORTCUTS = { recent: [], favorites: [], yesterdayMeals: [], planMeals: [] };

function highItem(name: string, kcal: number, extra: Record<string, unknown> = {}) {
  return {
    resolved: true, rawText: name, foodQuery: name, foodId: 7, name,
    grams: 100, per100g: { kcal, p: 5, c: 20, f: 1 }, energyKcal: kcal, proteinG: 5, carbohydrateG: 20, fatG: 1,
    resolver: "catalog", confidence: "high", confirmed: true, ...extra,
  };
}

function persisted(name: string, kcal: number, extra: Record<string, unknown> = {}) {
  return {
    name, grams: 100, energyKcal: kcal, proteinG: 5, carbohydrateG: 20, fatG: 1, fiberG: null,
    resolver: "catalog", confidence: "high", confirmed: true, foodId: 7, per100g: { kcal, p: 5, c: 20, f: 1 }, ...extra,
  };
}

function logOf(id: number, items: ReturnType<typeof persisted>[], extra: Record<string, unknown> = {}) {
  return {
    id, dateKey: "2026-10-14", loggedAt: "2026-10-14T10:00:00Z", mealId: null, label: "Café da manhã", rawText: null,
    energyKcal: items.reduce((s, i) => s + i.energyKcal, 0), proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, fiberPartial: false,
    items, confidenceScore: 1, source: "parse", isFavorite: false, updatedAt: null, ...extra,
  };
}

function parsed(items: unknown[]) {
  return { items, totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 }, needsConfirmation: false };
}

async function typeAndAdd(text: string) {
  const input = screen.getByLabelText("Adicionar alimento");
  await userEvent.clear(input);
  await userEvent.type(input, text);
  await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
}

beforeEach(() => {
  getIntakeShortcuts.mockReset().mockResolvedValue(EMPTY_SHORTCUTS);
  parseIntakeText.mockReset();
  submitIntakeLog.mockReset();
  updateIntakeLog.mockReset();
  deleteIntakeLog.mockReset().mockResolvedValue(undefined);
  getDayIntake.mockReset().mockResolvedValue({ date: "2026-10-14", logs: [], meals: [], totals: {}, coverage: {}, target: null, plannedMeals: [] });
});

describe("IntakeLogSheet — espaço de trabalho da refeição", () => {
  it("alta confiança entra direto, a folha continua aberta e o total acumula", async () => {
    parseIntakeText
      .mockResolvedValueOnce(parsed([highItem("Pão francês", 135)]))
      .mockResolvedValueOnce(parsed([highItem("Ovo mexido", 90)]));
    submitIntakeLog
      .mockResolvedValueOnce(logOf(1, [persisted("Pão francês", 135)]))
      .mockResolvedValueOnce(logOf(1, [persisted("Pão francês", 135), persisted("Ovo mexido", 90)]));
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<IntakeLogSheet open onClose={onClose} onSaved={onSaved} />);

    await typeAndAdd("1 pão francês");
    await screen.findByText("1 alimento salvo");
    await typeAndAdd("1 ovo mexido");
    await screen.findByText("2 alimentos salvos");

    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("workspace-totals")).toHaveTextContent("225 kcal");
    // 2ª gravação anexa à MESMA linha e cada item tem a sua chave de idempotência
    expect(submitIntakeLog.mock.calls[0][0].logId).toBeNull();
    expect(submitIntakeLog.mock.calls[1][0].logId).toBe(1);
    expect(submitIntakeLog.mock.calls[0][0].items[0].clientKey).toBeTruthy();
    expect(submitIntakeLog.mock.calls[0][0].items[0].clientKey).not.toBe(submitIntakeLog.mock.calls[1][0].items[0].clientKey);
  });

  it("dois adicionar seguidos são serializados — o 2º só sai depois do 1º e usa o id dele", async () => {
    parseIntakeText
      .mockResolvedValueOnce(parsed([highItem("Pão francês", 135)]))
      .mockResolvedValueOnce(parsed([highItem("Ovo mexido", 90)]));
    let release!: (v: unknown) => void;
    submitIntakeLog
      .mockImplementationOnce(() => new Promise((r) => { release = r; }))
      .mockResolvedValueOnce(logOf(5, [persisted("Pão francês", 135), persisted("Ovo mexido", 90)]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("pão");
    await typeAndAdd("ovo");
    await waitFor(() => expect(submitIntakeLog).toHaveBeenCalledTimes(1));
    expect(submitIntakeLog).toHaveBeenCalledTimes(1); // 2º aguarda o 1º

    release(logOf(5, [persisted("Pão francês", 135)]));
    await waitFor(() => expect(submitIntakeLog).toHaveBeenCalledTimes(2));
    expect(submitIntakeLog.mock.calls[1][0].logId).toBe(5);
  });

  it("falha mostra 'Tentar de novo' e o retry reutiliza a MESMA clientKey (sem duplicar)", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([highItem("Pão francês", 135)]));
    submitIntakeLog
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(logOf(1, [persisted("Pão francês", 135)]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("pão");
    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("1 alimento salvo");

    const k1 = submitIntakeLog.mock.calls[0][0].items[0].clientKey;
    const k2 = submitIntakeLog.mock.calls[1][0].items[0].clientKey;
    expect(k1).toBeTruthy();
    expect(k2).toBe(k1);
  });

  it("'Pronto' não fecha com alimento que falhou; oferece voltar ou descartar", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([highItem("Pão francês", 135)]));
    submitIntakeLog.mockRejectedValueOnce(new Error("offline"));
    const onClose = vi.fn();
    render(<IntakeLogSheet open onClose={onClose} onSaved={() => {}} />);

    await typeAndAdd("pão");
    await screen.findByRole("button", { name: "Tentar de novo" });
    await userEvent.click(screen.getByRole("button", { name: "Pronto" }));
    await screen.findByText(/Um alimento não foi salvo/);
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Descartar e sair" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("'Pronto' fecha a folha e não cria nada além do já salvo", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([highItem("Pão francês", 135)]));
    submitIntakeLog.mockResolvedValueOnce(logOf(1, [persisted("Pão francês", 135)]));
    const onClose = vi.fn();
    render(<IntakeLogSheet open onClose={onClose} onSaved={() => {}} />);

    await typeAndAdd("pão");
    await screen.findByText("1 alimento salvo");
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pronto" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(submitIntakeLog).toHaveBeenCalledTimes(1);
  });

  it("Cancelar (nada salvo) fecha sem gravar", async () => {
    const onClose = vi.fn();
    render(<IntakeLogSheet open onClose={onClose} onSaved={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(submitIntakeLog).not.toHaveBeenCalled();
  });

  it("Desfazer logo após adicionar remove o item recém-gravado (pela clientKey, não pela posição)", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([highItem("Pão francês", 135)]));
    submitIntakeLog.mockImplementationOnce(async (input: { items: { clientKey: string }[] }) =>
      logOf(1, [persisted("Pão francês", 135, { clientKey: input.items[0].clientKey })]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("pão");
    await screen.findByText("1 alimento salvo");
    await userEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    // sendo o único item, desfazer apaga a refeição
    await waitFor(() => expect(deleteIntakeLog).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByTestId("workspace-count")).toHaveTextContent("Nenhum alimento salvo ainda"));
  });

  it("média confiança não é gravada: fica em 'Falta confirmar' até 'Usar este' + 'Adicionar à refeição'", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([
      highItem("Pão, trigo, francês", 150, { confidence: "medium", confirmed: false, matchScore: 0.83 }),
    ]));
    submitIntakeLog.mockResolvedValueOnce(logOf(1, [persisted("Pão, trigo, francês", 150)]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("1 pao francez");
    await screen.findByText(/Você quis dizer/);
    expect(submitIntakeLog).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Adicionar à refeição" })).toBeDisabled();
    // Nenhum detalhe técnico do resolver aparece para o usuário.
    expect(screen.queryByText(/matchScore|0\.83|fuzzy/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Usar este" }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar à refeição" }));
    await screen.findByText("1 alimento salvo");
    expect(submitIntakeLog.mock.calls[0][0].items[0].confirmed).toBe(true);
  });

  it("baixa confiança exige o toque 'Confirme' antes de poder adicionar", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([
      highItem("Comida qualquer", 100, { confidence: "low", confirmed: false }),
    ]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("um pouco de comida");
    await screen.findByText(/Comida qualquer/);
    expect(screen.getByRole("button", { name: "Adicionar à refeição" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Confirme" }));
    expect(screen.getByRole("button", { name: "Adicionar à refeição" })).not.toBeDisabled();
    expect(submitIntakeLog).not.toHaveBeenCalled();
  });

  it("item não resolvido nunca mostra 0 kcal nem é gravado (PLAN P1B corrective §13)", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([{ resolved: false, rawText: "xyz123", foodQuery: "xyz123" }]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("xyz123");
    await screen.findByText(/"xyz123"/);
    expect(screen.getByRole("button", { name: "Adicionar à refeição" })).toBeDisabled();
    expect(screen.queryByText(/0 kcal/)).not.toBeInTheDocument();
    expect(screen.getByText(/Identifique os alimentos/)).toBeInTheDocument();
    expect(submitIntakeLog).not.toHaveBeenCalled();
  });

  it('média confiança oferece "Buscar outro alimento" sem sair da jornada', async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([
      highItem("Pão, trigo, francês", 150, { confidence: "medium", confirmed: false }),
    ]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("1 pao francez");
    await screen.findByText(/Você quis dizer/);
    await userEvent.click(screen.getByRole("button", { name: "Buscar outro alimento" }));
    expect(screen.getByPlaceholderText("Buscar alimento…")).toBeInTheDocument();
  });

  it("ambiguidade genuína mostra chips de candidatos — tocar um resolve direto", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([
      highItem("Ovo, de galinha, inteiro, frito", 240, {
        canonicalFood: { baseFood: "ovo", variant: null, preparation: null },
        confidence: "low", confirmed: false,
        candidates: [
          { foodId: 474, canonicalFood: { baseFood: "Ovo, de galinha, clara", variant: null, preparation: "cozido" }, per100g: { kcal: 50, p: 11, c: 0, f: 0.2 } },
          { foodId: 475, canonicalFood: { baseFood: "Ovo, de galinha, gema", variant: null, preparation: "cozido" }, per100g: { kcal: 350, p: 16, c: 1, f: 30 } },
        ],
      }),
    ]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("2 ovos mexidos");
    await screen.findByRole("toolbar", { name: "Alternativas" });
    expect(screen.getByRole("button", { name: "Adicionar à refeição" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Ovo, de galinha, gema · cozido/ }));
    expect(screen.getByRole("button", { name: "Adicionar à refeição" })).not.toBeDisabled();
  });

  it("mostra o nome canônico e o preparo como legenda na lista salva", async () => {
    parseIntakeText.mockResolvedValueOnce(parsed([
      highItem("Frango, peito, sem pele, grelhado", 318, { canonicalFood: { baseFood: "peito de frango", variant: null, preparation: "grelhado" } }),
    ]));
    submitIntakeLog.mockResolvedValueOnce(logOf(1, [
      persisted("Frango, peito, sem pele, grelhado", 318, { canonicalFood: { baseFood: "peito de frango", variant: null, preparation: "grelhado" } }),
    ]));
    render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

    await typeAndAdd("200g de frango grelhado");
    const list = await screen.findByRole("list", { name: "Alimentos salvos" });
    expect(within(list).getByText(/Peito de frango/)).toBeInTheDocument();
    expect(within(list).queryByText(/Frango, peito, sem pele, grelhado/)).not.toBeInTheDocument();
  });

  describe("atalhos e rótulo", () => {
    const planShortcut = {
      ...EMPTY_SHORTCUTS,
      planMeals: [{ mealId: 10, name: "Almoço", items: [{ id: 500, foodName: "Arroz", energyKcal: 128, proteinG: 2.5, carbohydrateG: 28, fatG: 0.2, grams: 100 }] }],
    };

    it("'Como no plano' → Adicionar à refeição grava o item do plano (planMealItemId) com origem 'plan'", async () => {
      getIntakeShortcuts.mockResolvedValue(planShortcut);
      submitIntakeLog.mockResolvedValueOnce(logOf(1, [persisted("Arroz", 128, { resolver: "plan" })], { label: "Como no plano: Almoço" }));
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

      await userEvent.click(await screen.findByRole("button", { name: /Como no plano: Almoço/ }));
      expect(screen.queryByLabelText("Refeição")).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Adicionar à refeição" }));

      await waitFor(() => expect(submitIntakeLog).toHaveBeenCalled());
      const [call] = submitIntakeLog.mock.calls[0];
      expect(call.items[0]).toMatchObject({ kind: "plan", planMealItemId: 500 });
      expect(call.source).toBe("plan");
      expect(call.label).toBe("Como no plano: Almoço");
    });

    it("atalhos somem depois de salvar algo (acrescentam, nunca substituem)", async () => {
      getIntakeShortcuts.mockResolvedValue(planShortcut);
      parseIntakeText.mockResolvedValueOnce(parsed([highItem("Suco", 80)]));
      submitIntakeLog.mockResolvedValueOnce(logOf(1, [persisted("Suco", 80)]));
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

      await screen.findByRole("button", { name: /Como no plano: Almoço/ });
      await typeAndAdd("suco");
      await screen.findByText("1 alimento salvo");
      expect(screen.queryByRole("button", { name: /Como no plano: Almoço/ })).not.toBeInTheDocument();
    });

    it("refeição do plano sem rótulo explícito usa o nome da refeição (ramo 'idle' do check-in)", async () => {
      parseIntakeText.mockResolvedValueOnce(parsed([highItem("Pão", 100)]));
      submitIntakeLog.mockResolvedValueOnce(logOf(1, [persisted("Pão", 100)], { mealId: 10, label: "Café da manhã" }));
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Café da manhã" />);

      await typeAndAdd("pão");
      await waitFor(() => expect(submitIntakeLog).toHaveBeenCalled());
      expect(submitIntakeLog.mock.calls[0][0]).toMatchObject({ mealId: 10, label: "Café da manhã" });
    });

    it("refeição extra: seletor de momento só antes do 1º item; 'Outro' usa o texto digitado; mealId nulo", async () => {
      parseIntakeText.mockResolvedValueOnce(parsed([highItem("Whey protein (30g)", 120)]));
      submitIntakeLog.mockResolvedValueOnce(logOf(1, [persisted("Whey protein (30g)", 120)], { label: "Pré-treino" }));
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} />);

      await userEvent.selectOptions(screen.getByLabelText("Refeição"), "Outro");
      await userEvent.type(screen.getByPlaceholderText("Ex.: Pré-treino"), "Pré-treino");
      await typeAndAdd("30g de whey");

      await screen.findByText("1 alimento salvo");
      const [call] = submitIntakeLog.mock.calls[0];
      expect(call.mealId).toBeNull();
      expect(call.label).toBe("Pré-treino");
      expect(screen.queryByLabelText("Refeição")).not.toBeInTheDocument();
    });
  });

  describe("retomada e edição", () => {
    it("refeição do plano com registro hoje reabre com os itens salvos e adiciona na MESMA linha", async () => {
      getDayIntake.mockResolvedValue({
        date: "2026-10-14",
        logs: [logOf(9, [persisted("Pão", 135)], { mealId: 10, updatedAt: "2026-10-14T10:05:00Z" })],
        meals: [{
          groupKey: "p10", mealId: 10, label: "Café da manhã", loggedAt: "2026-10-14T10:00:00Z", isExtra: false,
          items: [persisted("Pão", 135)], energyKcal: 135, proteinG: 5, carbohydrateG: 20, fatG: 1, fiberG: null, fiberPartial: false,
          confidenceScore: 1, sourceLogIds: [9],
        }],
        totals: {}, coverage: {}, target: null, plannedMeals: [],
      });
      parseIntakeText.mockResolvedValueOnce(parsed([highItem("Leite", 120)]));
      submitIntakeLog.mockResolvedValueOnce(logOf(9, [persisted("Pão", 135), persisted("Leite", 120)], { mealId: 10 }));
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Café da manhã" />);

      await screen.findByText("1 alimento salvo");
      await typeAndAdd("leite");
      await screen.findByText("2 alimentos salvos");
      expect(submitIntakeLog.mock.calls[0][0].logId).toBe(9);
    });

    it("remover um item (com outros salvos) envia 'existing' para os mantidos e não reenvia os snapshots", async () => {
      getDayIntake.mockResolvedValue({
        date: "2026-10-14",
        logs: [logOf(9, [persisted("Pão", 135), persisted("Leite", 120)], { mealId: 10 })],
        meals: [{
          groupKey: "p10", mealId: 10, label: "Café da manhã", loggedAt: "2026-10-14T10:00:00Z", isExtra: false,
          items: [persisted("Pão", 135), persisted("Leite", 120)], energyKcal: 255, proteinG: 10, carbohydrateG: 40, fatG: 2, fiberG: null,
          fiberPartial: false, confidenceScore: 1, sourceLogIds: [9],
        }],
        totals: {}, coverage: {}, target: null, plannedMeals: [],
      });
      updateIntakeLog.mockResolvedValue(logOf(9, [persisted("Leite", 120)], { mealId: 10 }));
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Café da manhã" />);
        await screen.findByText("2 alimentos salvos");
        await userEvent.click(screen.getByRole("button", { name: "Remover Pão" }));
        expect(screen.getByText("Item removido")).toBeInTheDocument();
        await vi.advanceTimersByTimeAsync(5100);
        await waitFor(() => expect(updateIntakeLog).toHaveBeenCalled());
        const [id, body] = updateIntakeLog.mock.calls[0];
        expect(id).toBe(9);
        expect(body.items).toEqual([{ kind: "existing", index: 1 }]);
      } finally {
        vi.useRealTimers();
      }
    });

    const THREE = {
      date: "2026-10-14",
      logs: [logOf(9, [persisted("Pão", 135), persisted("Ovo", 90), persisted("Leite", 120)], { mealId: 10 })],
      meals: [{
        groupKey: "p10", mealId: 10, label: "Café da manhã", loggedAt: "2026-10-14T10:00:00Z", isExtra: false,
        items: [persisted("Pão", 135), persisted("Ovo", 90), persisted("Leite", 120)], energyKcal: 345, proteinG: 15, carbohydrateG: 60,
        fatG: 3, fiberG: null, fiberPartial: false, confidenceScore: 1, sourceLogIds: [9],
      }],
      totals: {}, coverage: {}, target: null, plannedMeals: [],
    };

    it("duas remoções seguidas dentro da janela vão num PATCH só e apagam exatamente os itens tocados (índices não ficam velhos)", async () => {
      getDayIntake.mockResolvedValue(THREE);
      updateIntakeLog.mockResolvedValue(logOf(9, [persisted("Ovo", 90)], { mealId: 10 }));
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Café da manhã" />);
        await screen.findByText("3 alimentos salvos");
        await userEvent.click(screen.getByRole("button", { name: "Remover Pão" }));
        await userEvent.click(screen.getByRole("button", { name: "Remover Leite" }));
        expect(screen.getByText("2 itens removidos")).toBeInTheDocument();
        await vi.advanceTimersByTimeAsync(5100);
        await waitFor(() => expect(updateIntakeLog).toHaveBeenCalledTimes(1));
        expect(updateIntakeLog.mock.calls[0][1].items).toEqual([{ kind: "existing", index: 1 }]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("remover um item e editar outro em seguida: um único PATCH, o editado é o certo (não o que ocupou o índice)", async () => {
      getDayIntake.mockResolvedValue(THREE);
      updateIntakeLog.mockResolvedValue(logOf(9, [persisted("Ovo", 90), persisted("Leite", 120)], { mealId: 10 }));
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Café da manhã" />);
      await screen.findByText("3 alimentos salvos");

      await userEvent.click(screen.getByRole("button", { name: "Remover Pão" }));
      await userEvent.click(screen.getByRole("button", { name: "Editar Ovo" }));
      const qty = screen.getByLabelText("Quantidade (g)");
      await userEvent.clear(qty);
      await userEvent.type(qty, "150");
      await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));

      await waitFor(() => expect(updateIntakeLog).toHaveBeenCalledTimes(1));
      // saiu o Pão; o Ovo (editado) e o Leite (intacto) vão com o índice ATUAL do servidor, tudo num PATCH só
      expect(updateIntakeLog.mock.calls[0][1].items).toEqual([
        { kind: "existing", index: 1, quantity: 150 },
        { kind: "existing", index: 2 },
      ]);
    });

    it("item 'Como no plano' agora é editável na quantidade; item sem gramas conhecidos não oferece Editar", async () => {
      const planItem = persisted("Arroz", 128, { resolver: "plan", grams: 100 });
      const noGrams = persisted("Prato do restaurante", 600, { resolver: "manual", grams: null });
      getDayIntake.mockResolvedValue({
        date: "2026-10-14",
        logs: [logOf(9, [planItem, noGrams], { mealId: 10 })],
        meals: [{
          groupKey: "p10", mealId: 10, label: "Almoço", loggedAt: "2026-10-14T12:00:00Z", isExtra: false, items: [planItem, noGrams],
          energyKcal: 728, proteinG: 10, carbohydrateG: 40, fatG: 2, fiberG: null, fiberPartial: false, confidenceScore: 1, sourceLogIds: [9],
        }],
        totals: {}, coverage: {}, target: null, plannedMeals: [],
      });
      updateIntakeLog.mockResolvedValue(logOf(9, [planItem, noGrams], { mealId: 10 }));
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Almoço" />);
      await screen.findByText("2 alimentos salvos");

      expect(screen.queryByRole("button", { name: "Editar Prato do restaurante" })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Editar Arroz" }));
      const qty = screen.getByLabelText("Quantidade (g)");
      await userEvent.clear(qty);
      await userEvent.type(qty, "150");
      await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));
      await waitFor(() => expect(updateIntakeLog).toHaveBeenCalledTimes(1));
      expect(updateIntakeLog.mock.calls[0][1].items).toEqual([{ kind: "existing", index: 0, quantity: 150 }, { kind: "existing", index: 1 }]);
    });

    it("editar a quantidade em ml e em unidade mantém a unidade e não envia gramas nem nutrientes do cliente", async () => {
      const leite = persisted("Leite", 125, { grams: 206, quantity: 200, unitLabel: "ml" });
      const ovo = persisted("Ovo", 143, { grams: 100, quantity: 2, unitLabel: "unidade" });
      getDayIntake.mockResolvedValue({
        date: "2026-10-14",
        logs: [logOf(9, [leite, ovo], { mealId: 10 })],
        meals: [{
          groupKey: "p10", mealId: 10, label: "Café", loggedAt: "2026-10-14T08:00:00Z", isExtra: false, items: [leite, ovo],
          energyKcal: 268, proteinG: 10, carbohydrateG: 40, fatG: 2, fiberG: null, fiberPartial: false, confidenceScore: 1, sourceLogIds: [9],
        }],
        totals: {}, coverage: {}, target: null, plannedMeals: [],
      });
      updateIntakeLog.mockResolvedValue(logOf(9, [leite, ovo], { mealId: 10 }));
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Café" />);
      await screen.findByText("2 alimentos salvos");

      await userEvent.click(screen.getByRole("button", { name: "Editar Ovo" }));
      const qty = screen.getByLabelText("Quantidade (unidade)");
      await userEvent.clear(qty);
      await userEvent.type(qty, "3");
      await userEvent.click(screen.getByRole("button", { name: "Salvar item" }));
      await waitFor(() => expect(updateIntakeLog).toHaveBeenCalledTimes(1));
      const items = updateIntakeLog.mock.calls[0][1].items;
      expect(items).toEqual([{ kind: "existing", index: 0 }, { kind: "existing", index: 1, quantity: 3 }]);
      expect(JSON.stringify(items)).not.toMatch(/grams|energyKcal|proteinG/);
    });

    it("enquanto a quantidade de um item é editada, o rodapé (campo + Pronto) some — não cobre o editor em tela curta com teclado", async () => {
      getDayIntake.mockResolvedValue(THREE);
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Café da manhã" />);
      await screen.findByText("3 alimentos salvos");
      expect(screen.getByLabelText("Adicionar alimento")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Editar Ovo" }));
      expect(screen.getByLabelText("Quantidade (g)")).toBeInTheDocument();
      expect(screen.queryByLabelText("Adicionar alimento")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Pronto" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Cancelar edição" }));
      expect(screen.getByLabelText("Adicionar alimento")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Pronto" })).toBeInTheDocument();
    });

    it("sair com item em 'Falta confirmar' avisa antes de descartar", async () => {
      parseIntakeText.mockResolvedValueOnce(parsed([highItem("Comida", 100, { confidence: "low", confirmed: false })]));
      const onClose = vi.fn();
      render(<IntakeLogSheet open onClose={onClose} onSaved={() => {}} />);
      await typeAndAdd("comida");
      await screen.findByRole("button", { name: "Adicionar à refeição" });

      await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(await screen.findByText("Sair sem adicionar?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Sair sem adicionar" }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("remover o último item pede confirmação 'Remover a refeição inteira?'", async () => {
      getDayIntake.mockResolvedValue({
        date: "2026-10-14",
        logs: [logOf(9, [persisted("Pão", 135)], { mealId: 10 })],
        meals: [{
          groupKey: "p10", mealId: 10, label: "Café da manhã", loggedAt: "2026-10-14T10:00:00Z", isExtra: false,
          items: [persisted("Pão", 135)], energyKcal: 135, proteinG: 5, carbohydrateG: 20, fatG: 1, fiberG: null, fiberPartial: false,
          confidenceScore: 1, sourceLogIds: [9],
        }],
        totals: {}, coverage: {}, target: null, plannedMeals: [],
      });
      render(<IntakeLogSheet open onClose={() => {}} onSaved={() => {}} defaultMealId={10} defaultMealLabel="Café da manhã" />);
      await screen.findByText("1 alimento salvo");
      await userEvent.click(screen.getByRole("button", { name: "Remover Pão" }));
      expect(await screen.findByText("Remover a refeição inteira?")).toBeInTheDocument();
      expect(deleteIntakeLog).not.toHaveBeenCalled();
    });
  });
});
