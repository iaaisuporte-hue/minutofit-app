/**
 * Aluno SEM nutricionista vinculada (timeline `null`): o card do Hoje deixa
 * de sumir quando `nutrition_intake` está liberado e vira atalho de registro
 * avulso (refeição extra, `mealId: null`). Sem a feature, segue silencioso.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMealTimeline = vi.fn();
const getDayIntake = vi.fn();
let intakeEnabled = true;
const sheetProps: Array<{ open: boolean; defaultMealId?: number | null }> = [];

vi.mock("../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutriApi")>();
  return { ...actual, fetchMealTimeline: () => fetchMealTimeline(), recordMealCheckin: vi.fn() };
});

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return { ...actual, getDayIntake: () => getDayIntake() };
});

vi.mock("../../auth/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    loading: false,
    planName: "Free",
    features: [],
    hasFeature: (key: string) => key === "nutrition_intake" && intakeEnabled,
    refresh: vi.fn(),
  }),
}));

vi.mock("./IntakeLogSheet", () => ({
  IntakeLogSheet: (props: { open: boolean; defaultMealId?: number | null }) => {
    sheetProps.push(props);
    return props.open ? <div data-testid="intake-sheet" /> : null;
  },
}));

import { NutritionCheckinCard } from "./NutritionCheckinCard";

function renderCard() {
  return render(
    <MemoryRouter>
      <NutritionCheckinCard />
    </MemoryRouter>
  );
}

describe("NutritionCheckinCard — sem plano alimentar", () => {
  beforeEach(() => {
    fetchMealTimeline.mockReset();
    getDayIntake.mockReset();
    sheetProps.length = 0;
    intakeEnabled = true;
    fetchMealTimeline.mockResolvedValue(null);
    getDayIntake.mockResolvedValue({
      date: "2026-10-09", logs: [], meals: [], plannedMeals: [], target: null,
      totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: null, fiberPartial: false },
      coverage: { level: "none" },
    });
  });

  it("mostra o atalho de registro avulso e abre o sheet sem refeição do plano", async () => {
    renderCard();
    const button = await screen.findByRole("button", { name: /registrar alimento/i });
    expect(screen.getByRole("link", { name: /ver dia/i })).toHaveAttribute("href", "/app/user/plano-alimentar");

    await userEvent.click(button);
    expect(screen.getByTestId("intake-sheet")).toBeInTheDocument();
    expect(sheetProps.at(-1)?.defaultMealId).toBeNull();
  });

  it("continua silencioso quando o registro de refeição não está liberado", async () => {
    intakeEnabled = false;
    const { container } = renderCard();
    await waitFor(() => expect(fetchMealTimeline).toHaveBeenCalled());
    // Deixa a promise da timeline resolver e o estado sair de "loading".
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: /registrar (refeição|alimento)/i })).not.toBeInTheDocument();
  });

  describe("com plano alimentar — 'Registrar alimento' existe em todos os estados", () => {
    const meal = (id: number, name: string, status: string) => ({
      id, name, status, checkin: null, order_index: id, meal_time: "12:00", items: [], orientation: "x",
    });
    const timeline = (meals: ReturnType<typeof meal>[]) => ({
      plan_id: 1, title: "Plano", objective: "maintenance", general_notes: null, nutri_name: "Nutri", today: "2026-10-14",
      meals, workoutToday: null, streak: 0,
    });

    it("idle: a refeição do plano continua primária e 'Registrar alimento' (livre, sem mealId) vem ao lado", async () => {
      fetchMealTimeline.mockResolvedValue(timeline([meal(11, "Almoço", "due_now")]));
      renderCard();
      const plan = await screen.findByRole("button", { name: /registrar refeição/i });
      const free = screen.getByRole("button", { name: /registrar alimento/i });

      await userEvent.click(free);
      expect(sheetProps.at(-1)).toMatchObject({ open: true, defaultMealId: null });
      expect(screen.getAllByTestId("intake-sheet")).toHaveLength(1);

      await userEvent.click(plan);
      // a folha da refeição prevista usa o id do plano; a livre não
      expect(sheetProps.some((p) => p.open && p.defaultMealId === 11)).toBe(true);
    });

    it("all_done: 'Registrar alimento' abre o registro livre", async () => {
      fetchMealTimeline.mockResolvedValue(timeline([meal(11, "Almoço", "done")]));
      renderCard();
      await userEvent.click(await screen.findByRole("button", { name: /registrar alimento/i }));
      expect(sheetProps.at(-1)).toMatchObject({ open: true, defaultMealId: null });
    });
  });
});
