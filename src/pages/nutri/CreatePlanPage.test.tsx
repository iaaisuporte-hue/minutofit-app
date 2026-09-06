/**
 * SPEC 037 / P2.8 — rascunho local + dirty-state do builder de plano.
 * Cobre: prompt de restauração (nunca silencioso), persistência em
 * localStorage, confirmação ao tentar sair com alterações, e limpeza do
 * rascunho após salvar com sucesso.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CreatePlanPage from "./CreatePlanPage";

const createNutritionPlan = vi.fn();
const checkDietAgainstProfile = vi.fn();
const suggestSubstitution = vi.fn();
const searchFoods = vi.fn();
const fetchFoodMeasures = vi.fn();

vi.mock("../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutriApi")>();
  return {
    ...actual,
    createNutritionPlan: (...args: unknown[]) => createNutritionPlan(...args),
    checkDietAgainstProfile: (...args: unknown[]) => checkDietAgainstProfile(...args),
    suggestSubstitution: (...args: unknown[]) => suggestSubstitution(...args),
    searchFoods: (...args: unknown[]) => searchFoods(...args),
    fetchFoodMeasures: (...args: unknown[]) => fetchFoodMeasures(...args),
  };
});

const DRAFT_KEY = "s2core:nutri:plan-draft:42";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/nutri/pacientes/42/plano/novo"]}>
      <Routes>
        <Route path="/app/nutri/pacientes/:patientId/plano/novo" element={<CreatePlanPage />} />
        <Route path="/app/nutri/pacientes/:patientId" element={<div>Detalhe do paciente</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  createNutritionPlan.mockReset();
  checkDietAgainstProfile.mockReset().mockResolvedValue([]);
  suggestSubstitution.mockReset();
  searchFoods.mockReset().mockResolvedValue([
    { id: 3, kind: "catalog", name: "Arroz, tipo 1, cozido", category: "Cereais e derivados", source: "taco", referenceAmountG: 100, energyKcal: 128.26, proteinG: 2.52, carbohydrateG: 28.06, fatG: 0.23, fiberG: 1.56, sodiumMg: 1.2 },
  ]);
  fetchFoodMeasures.mockReset().mockResolvedValue([{ id: 1, name: "colher de sopa cheia", grams: 25 }]);
});

function v2Draft(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    version: 2,
    title: "Rascunho antigo", objective: "weight_loss", generalNotes: "",
    meals: [{ name: "Café", orientation: "Ovos", meal_time: "", tolerance_minutes: "", metabolic_goal: "", workout_relation: "", hydration_note: "", supplement_note: "", alternatives: [], items: [] }],
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("CreatePlanPage — rascunho e dirty-state", () => {
  it("não restaura rascunho em silêncio — mostra prompt com Continuar/Descartar", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(v2Draft()));

    renderPage();

    expect(screen.getByText("Encontramos um rascunho não salvo")).toBeInTheDocument();
    // Não populou o formulário sozinho — não há título nenhum ainda visível.
    expect(screen.queryByDisplayValue("Rascunho antigo")).not.toBeInTheDocument();
  });

  it("Continuar rascunho hidrata o formulário com o conteúdo salvo", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(v2Draft()));

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Continuar rascunho" }));

    expect(screen.getByDisplayValue("Rascunho antigo")).toBeInTheDocument();
  });

  it("rascunho de versão incompatível (sem `version`, formato pré-P3A) oferece só Descartar (SPEC 038 §55)", async () => {
    // Formato v1: sem `version`, sem `items` por refeição — exatamente o
    // shape de antes da P3A. Hidratar isso quebraria em runtime.
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: "Rascunho v1", objective: "weight_loss", generalNotes: "",
      meals: [{ name: "Café", orientation: "Ovos", meal_time: "", tolerance_minutes: "", metabolic_goal: "", workout_relation: "", hydration_note: "", supplement_note: "", alternatives: [] }],
      savedAt: new Date().toISOString(),
    }));

    renderPage();

    expect(screen.getByText("Encontramos um rascunho de uma versão antiga")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continuar rascunho" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeInTheDocument();
  });

  it("Descartar remove o rascunho e abre o formulário vazio", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(v2Draft()));

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getByLabelText(/Título do plano/)).toHaveValue("");
  });

  it("editar um campo persiste rascunho em localStorage (debounced)", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/Título do plano/), "Meu plano novo");

    await waitFor(() => {
      const raw = localStorage.getItem(DRAFT_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).title).toBe("Meu plano novo");
    }, { timeout: 2000 });
  });

  it("tentar sair com alterações pede confirmação; sair sem salvar preserva o rascunho", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/Título do plano/), "Ainda editando");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));

    await waitFor(() => {
      const raw = localStorage.getItem(DRAFT_KEY);
      expect(raw).not.toBeNull();
    });
  });

  it("sair sem alterações não pede confirmação nenhuma", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("salvar com sucesso limpa o rascunho", async () => {
    createNutritionPlan.mockResolvedValue({ id: 1 });
    renderPage();

    await userEvent.type(screen.getByLabelText(/Título do plano/), "Plano final");
    await userEvent.selectOptions(screen.getByLabelText(/Objetivo/), "weight_loss");
    await userEvent.type(screen.getByLabelText(/Refeição 1/), "Almoço");
    await userEvent.type(screen.getByLabelText(/Orientações para esta refeição/), "Arroz e feijão");

    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: /Salvar plano/ }));

    await waitFor(() => expect(createNutritionPlan).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
  });
});

describe("CreatePlanPage — itens estruturados (SPEC 038 / P3A)", () => {
  it("buscar, adicionar um alimento e ver o subtotal calculado", async () => {
    createNutritionPlan.mockResolvedValue({ id: 1 });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /Adicionar alimento/ }));
    await userEvent.type(screen.getByRole("combobox", { name: "Buscar alimento" }), "arroz");

    const option = await screen.findByRole("option", { name: /Arroz, tipo 1, cozido/ });
    await userEvent.click(option);

    // Quantidade default é 100g — kcal deve bater com o mock (128.26 por 100g).
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText(/Arroz, tipo 1, cozido/)).toBeInTheDocument();
    // Texto quebrado em nós separados pelo JSX (`{n} kcal`) — casa por
    // textContent em vez de nó único. `getAllByText` porque vários
    // ancestrais (subtotal da refeição + total diário) contêm o mesmo valor.
    expect(screen.getAllByText((_, el) => /128\.26\s*kcal/.test(el?.textContent ?? "")).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, el) => (el?.textContent ?? "").startsWith("Subtotal:") && (el?.textContent ?? "").includes("128.26")).length).toBeGreaterThan(0);
  });

  it("o payload enviado ao backend inclui os itens adicionados", async () => {
    createNutritionPlan.mockResolvedValue({ id: 1 });
    renderPage();

    await userEvent.type(screen.getByLabelText(/Título do plano/), "Plano com item");
    await userEvent.selectOptions(screen.getByLabelText(/Objetivo/), "weight_loss");
    await userEvent.type(screen.getByLabelText(/Refeição 1/), "Almoço");
    await userEvent.type(screen.getByLabelText(/Orientações para esta refeição/), "Arroz e feijão");

    await userEvent.click(screen.getByRole("button", { name: /Adicionar alimento/ }));
    await userEvent.type(screen.getByRole("combobox", { name: "Buscar alimento" }), "arroz");
    await userEvent.click(await screen.findByRole("option", { name: /Arroz, tipo 1, cozido/ }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await userEvent.click(screen.getByRole("button", { name: /Salvar plano/ }));

    await waitFor(() => expect(createNutritionPlan).toHaveBeenCalled());
    const [, payload] = createNutritionPlan.mock.calls[0];
    expect(payload.meals[0].items).toEqual([
      expect.objectContaining({ foodId: 3, quantity: 100, unitType: "grams" }),
    ]);
  });
});
