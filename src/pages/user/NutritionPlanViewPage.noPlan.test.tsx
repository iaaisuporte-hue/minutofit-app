/**
 * Aluno SEM nutricionista vinculada (timeline `null`): a tela de Alimentação
 * precisa montar "Seu dia nutricional" (totais + CTA de registro avulso) além
 * da meta própria — antes só a meta aparecia e o aluno não conseguia
 * registrar refeição nem ver os totais do dia.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMealTimeline = vi.fn();
let intakeEnabled = true;

vi.mock("../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutriApi")>();
  return { ...actual, fetchMealTimeline: () => fetchMealTimeline() };
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

vi.mock("../../features/nutrition/usePushSubscription", () => ({ usePushSubscription: () => {} }));
vi.mock("../../features/nutrition/NutritionDaySummary", () => ({
  NutritionDaySummary: () => <div data-testid="day-summary" />,
}));
vi.mock("../../features/nutrition/NutritionTargetCard", () => ({
  default: () => <div data-testid="target-card" />,
}));
vi.mock("../../features/nutrition/DietaryProfileCard", () => ({ default: () => null }));
vi.mock("../../features/nutrition/IntakeLogSheet", () => ({ IntakeLogSheet: () => null }));

import NutritionPlanViewPage from "./NutritionPlanViewPage";

describe("NutritionPlanViewPage — sem plano alimentar ativo", () => {
  beforeEach(() => {
    fetchMealTimeline.mockReset();
    fetchMealTimeline.mockResolvedValue(null);
    intakeEnabled = true;
  });

  it("monta os totais do dia e a meta própria, com o contexto de plano ausente", async () => {
    render(<NutritionPlanViewPage />);
    expect(await screen.findByTestId("day-summary")).toBeInTheDocument();
    expect(screen.getByTestId("target-card")).toBeInTheDocument();
    expect(screen.getByText(/ainda sem plano alimentar prescrito/i)).toBeInTheDocument();
    expect(screen.getByText(/quando sua nutricionista prescrever/i)).toBeInTheDocument();
  });

  it("sem a feature de registro, mantém só a mensagem de plano ausente", async () => {
    intakeEnabled = false;
    render(<NutritionPlanViewPage />);
    expect(await screen.findByText(/nenhum plano alimentar ativo/i)).toBeInTheDocument();
    expect(screen.queryByTestId("day-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("target-card")).not.toBeInTheDocument();
  });
});
