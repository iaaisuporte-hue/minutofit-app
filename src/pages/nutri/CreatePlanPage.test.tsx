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

vi.mock("../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutriApi")>();
  return {
    ...actual,
    createNutritionPlan: (...args: unknown[]) => createNutritionPlan(...args),
    checkDietAgainstProfile: (...args: unknown[]) => checkDietAgainstProfile(...args),
    suggestSubstitution: (...args: unknown[]) => suggestSubstitution(...args),
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
});

describe("CreatePlanPage — rascunho e dirty-state", () => {
  it("não restaura rascunho em silêncio — mostra prompt com Continuar/Descartar", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: "Rascunho antigo", objective: "weight_loss", generalNotes: "",
      meals: [{ name: "Café", orientation: "Ovos", meal_time: "", tolerance_minutes: "", metabolic_goal: "", workout_relation: "", hydration_note: "", supplement_note: "", alternatives: [] }],
      savedAt: new Date().toISOString(),
    }));

    renderPage();

    expect(screen.getByText("Encontramos um rascunho não salvo")).toBeInTheDocument();
    // Não populou o formulário sozinho — não há título nenhum ainda visível.
    expect(screen.queryByDisplayValue("Rascunho antigo")).not.toBeInTheDocument();
  });

  it("Continuar rascunho hidrata o formulário com o conteúdo salvo", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: "Rascunho antigo", objective: "weight_loss", generalNotes: "",
      meals: [{ name: "Café", orientation: "Ovos", meal_time: "", tolerance_minutes: "", metabolic_goal: "", workout_relation: "", hydration_note: "", supplement_note: "", alternatives: [] }],
      savedAt: new Date().toISOString(),
    }));

    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Continuar rascunho" }));

    expect(screen.getByDisplayValue("Rascunho antigo")).toBeInTheDocument();
  });

  it("Descartar remove o rascunho e abre o formulário vazio", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: "Rascunho antigo", objective: "weight_loss", generalNotes: "",
      meals: [{ name: "Café", orientation: "Ovos", meal_time: "", tolerance_minutes: "", metabolic_goal: "", workout_relation: "", hydration_note: "", supplement_note: "", alternatives: [] }],
      savedAt: new Date().toISOString(),
    }));

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
