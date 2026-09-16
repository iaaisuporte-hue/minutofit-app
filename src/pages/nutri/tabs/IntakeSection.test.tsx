/**
 * PLAN_NUTRITION_QUICK_MACROS (P1C) — a seção nunca aparece como inbox: sem
 * dados vira empty state neutro, sem exceção some sem alarde, e o selo de
 * fonte da meta ("Meta do plano" vs "Estimativa do paciente") nunca some.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IntakeSection } from "./IntakeSection";

const fetchPatientIntakeSummary = vi.fn();
const fetchPatientIntakeLogs = vi.fn();

vi.mock("../../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/nutriApi")>();
  return {
    ...actual,
    fetchPatientIntakeSummary: (...args: unknown[]) => fetchPatientIntakeSummary(...args),
    fetchPatientIntakeLogs: (...args: unknown[]) => fetchPatientIntakeLogs(...args),
  };
});

beforeEach(() => {
  fetchPatientIntakeSummary.mockReset();
  fetchPatientIntakeLogs.mockReset().mockResolvedValue([]);
});

describe("IntakeSection", () => {
  it("state 'none': mostra empty state, nunca um alerta", async () => {
    fetchPatientIntakeSummary.mockResolvedValue({
      summary: { state: "none", daysLogged7d: 0, highCoverageDays7d: 0, avgKcal7d: null, avgProteinG7d: null, avgCarbG7d: null, avgFatG7d: null, target: null, kcalTrend: null, exception: null },
      days: [],
    });
    render(<IntakeSection patientId={1} />);
    expect(await screen.findByText(/Sem registros de ingestão/)).toBeInTheDocument();
  });

  it("state 'ready' com exceção: mostra tiles, selo do plano e o card de exceção", async () => {
    fetchPatientIntakeSummary.mockResolvedValue({
      summary: {
        state: "ready", daysLogged7d: 6, highCoverageDays7d: 5,
        avgKcal7d: 1800, avgProteinG7d: 90, avgCarbG7d: 200, avgFatG7d: 60,
        target: { kcal: 2100, p: 150, c: 210, f: 70, source: "plan_items" },
        kcalTrend: "stable",
        exception: { type: "intake_protein_low", detail: "Proteína média 90 g vs meta 150 g em 4 dos últimos 5 dias" },
      },
      days: [{ dateKey: "2026-09-16", loggedMeals: 4, totalKcal: 1800, proteinG: 90, carbohydrateG: 200, fatG: 60, coverageRatio: 1, confidence: 1, level: "high" }],
    });
    render(<IntakeSection patientId={1} />);

    expect(await screen.findByText(/6 dias registrados · 5 com alta cobertura/)).toBeInTheDocument();
    expect(screen.getByText("Meta do plano")).toBeInTheDocument();
    expect(screen.getByText(/Proteína abaixo da meta/)).toBeInTheDocument();
    expect(screen.getByText(/Proteína média 90 g vs meta 150 g/)).toBeInTheDocument();
  });

  it("meta de estimativa própria mostra o selo correto (nunca confundido com o plano)", async () => {
    fetchPatientIntakeSummary.mockResolvedValue({
      summary: {
        state: "ready", daysLogged7d: 5, highCoverageDays7d: 4,
        avgKcal7d: 2000, avgProteinG7d: 140, avgCarbG7d: 200, avgFatG7d: 65,
        target: { kcal: 2100, p: 150, c: 210, f: 70, source: "self_estimate" },
        kcalTrend: "stable", exception: null,
      },
      days: [],
    });
    render(<IntakeSection patientId={1} />);
    expect(await screen.findByText("Estimativa do paciente")).toBeInTheDocument();
    expect(screen.queryByText("Meta do plano")).not.toBeInTheDocument();
  });

  it("abrir o drawer e expandir um dia busca as refeições daquele dia", async () => {
    fetchPatientIntakeSummary.mockResolvedValue({
      summary: { state: "ready", daysLogged7d: 4, highCoverageDays7d: 4, avgKcal7d: 2000, avgProteinG7d: 140, avgCarbG7d: 200, avgFatG7d: 65, target: null, kcalTrend: null, exception: null },
      days: [{ dateKey: "2026-09-16", loggedMeals: 3, totalKcal: 1800, proteinG: 130, carbohydrateG: 190, fatG: 60, coverageRatio: 0.75, confidence: 0.9, level: "high" }],
    });
    fetchPatientIntakeLogs.mockResolvedValue([
      { id: 1, loggedAt: "2026-09-16T12:00:00Z", label: "Almoço", energyKcal: 600, proteinG: 40, carbohydrateG: 60, fatG: 20, items: [{ name: "Arroz", grams: 100, energyKcal: 128, proteinG: 2.5, carbohydrateG: 28, fatG: 0.2, resolver: "catalog" }], source: "manual" },
    ]);
    render(<IntakeSection patientId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: "Ver registros" }));
    await userEvent.click(screen.getByText(/seg|ter|qua|qui|sex|sáb|dom/i));

    await waitFor(() => expect(fetchPatientIntakeLogs).toHaveBeenCalledWith(1, "2026-09-16"));
    expect(await screen.findByText("Almoço")).toBeInTheDocument();
  });
});
