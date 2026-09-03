/**
 * Revisão assistida da ficha (Sprint P2B) — decisão SEMPRE explícita do
 * Personal. Cobre: manter (sem chamada), substituir com confirmação
 * explícita, contrato Bi-Set (`requiresManualEdit` — nunca reaplica, só
 * direciona ao `WorkoutBuilderPage`) e erro do backend virando mensagem
 * clara em vez de crua.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseInsight } from "../../../services/personalInsightsApi";

const reviewExerciseInsight = vi.fn();

vi.mock("../../../services/personalInsightsApi", async () => {
  const actual = await vi.importActual<typeof import("../../../services/personalInsightsApi")>(
    "../../../services/personalInsightsApi",
  );
  return {
    ...actual,
    reviewExerciseInsight: (...args: unknown[]) => reviewExerciseInsight(...args),
  };
});

const trackPersonalInsightsEvent = vi.fn();
vi.mock("./personalInsightsEvents", () => ({
  trackPersonalInsightsEvent: (...args: unknown[]) => trackPersonalInsightsEvent(...args),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

import { PersonalInsightsError } from "../../../services/personalInsightsApi";
import { PlanReviewModal } from "./PlanReviewModal";

function insight(over: Partial<ExerciseInsight> = {}): ExerciseInsight {
  return {
    type: "RECURRING_REPLACEMENT",
    originalExerciseId: "ex-original",
    originalExerciseName: "Supino Reto",
    windowSize: 5,
    occurrenceCount: 3,
    mostRecentAt: "2026-08-30T12:00:00.000Z",
    alternatives: [
      { exerciseId: "ex-alt", exerciseName: "Supino Halteres", count: 3, approvedByPersonal: false },
    ],
    predominantReason: { text: "Equipamento ocupado", count: 3 },
    auditSessionIds: [101, 98, 95],
    ...over,
  };
}

function renderModal(over: Partial<ExerciseInsight> = {}) {
  const onClose = vi.fn();
  const onApplied = vi.fn();
  render(
    <PlanReviewModal studentId="42" insight={insight(over)} onClose={onClose} onApplied={onApplied} />,
  );
  return { onClose, onApplied };
}

beforeEach(() => vi.clearAllMocks());

describe("abrir o modal", () => {
  it("dispara 'started' ao montar", () => {
    renderModal();
    expect(trackPersonalInsightsEvent).toHaveBeenCalledWith(
      "personal_plan_review_started",
      expect.objectContaining({ insightType: "RECURRING_REPLACEMENT" }),
    );
  });
});

describe("Manter", () => {
  it("fecha sem chamar a API e reporta cancelamento", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Manter na ficha" }));

    expect(reviewExerciseInsight).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(trackPersonalInsightsEvent).toHaveBeenCalledWith(
      "personal_plan_review_cancelled",
      expect.objectContaining({ insightType: "RECURRING_REPLACEMENT" }),
    );
  });
});

describe("Substituir — fluxo feliz", () => {
  it("pede confirmação explícita antes de aplicar, e só chama a API depois de confirmar", async () => {
    reviewExerciseInsight.mockResolvedValue({ applied: true, plan: {} });
    const user = userEvent.setup();
    const { onClose, onApplied } = renderModal();

    await user.click(screen.getByRole("button", { name: "Substituir na ficha" }));

    // A confirmação explícita (item 28 do harness) precisa aparecer ANTES de qualquer chamada.
    expect(reviewExerciseInsight).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Essa alteração valerá para execuções futuras\. Treinos anteriores não serão modificados\./),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar substituição" }));

    await waitFor(() =>
      expect(reviewExerciseInsight).toHaveBeenCalledWith("42", "ex-original", {
        action: "apply",
        targetExerciseId: "ex-alt",
      }),
    );
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith("ex-original"));
    expect(onClose).toHaveBeenCalled();
    expect(trackPersonalInsightsEvent).toHaveBeenCalledWith(
      "personal_plan_updated_from_insight",
      expect.objectContaining({ insightType: "RECURRING_REPLACEMENT" }),
    );
    // Sucesso não é cancelamento.
    expect(trackPersonalInsightsEvent).not.toHaveBeenCalledWith(
      "personal_plan_review_cancelled",
      expect.anything(),
    );
  });
});

describe("Contrato Bi-Set (D-BISET)", () => {
  it("nunca tenta reaplicar — direciona ao editor completo no dia certo", async () => {
    reviewExerciseInsight.mockResolvedValue({
      applied: false,
      requiresManualEdit: true,
      reason: "BI_SET_MEMBER",
      planId: 123,
      dayIndex: 3, // 1-based no backend
    });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Substituir na ficha" }));
    await user.click(screen.getByRole("button", { name: "Confirmar substituição" }));

    expect(await screen.findByText(/faz parte de uma técnica combinada \(Bi-Set\)/)).toBeInTheDocument();
    expect(reviewExerciseInsight).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Abrir editor de ficha" }));
    // dayIndex 1-based (3) vira 0-based (2) na URL do builder.
    expect(navigate).toHaveBeenCalledWith("/app/personal/students/42/workouts/builder?planId=123&day=2");
    // Não tenta de novo depois de direcionar.
    expect(reviewExerciseInsight).toHaveBeenCalledTimes(1);
  });
});

describe("Erro do backend vira mensagem clara", () => {
  it("NO_ACTIVE_PLAN nunca aparece cru na tela", async () => {
    reviewExerciseInsight.mockRejectedValue(
      new PersonalInsightsError("NO_ACTIVE_PLAN", 404, "Aluno não tem ficha ativa para revisar"),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Substituir na ficha" }));
    await user.click(screen.getByRole("button", { name: "Confirmar substituição" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/não tem uma ficha ativa/i);
    expect(alert.textContent).not.toMatch(/NO_ACTIVE_PLAN/);
  });
});
