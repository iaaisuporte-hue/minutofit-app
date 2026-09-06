/**
 * SPEC 037 / P2.2 — busca, filtro (aria-pressed) e ordenação da carteira.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import NutritionPatientsPage from "./NutritionPatientsPage";
import type { PatientSummary } from "../../services/nutriApi";

const fetchPatients = vi.fn();
vi.mock("../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutriApi")>();
  return { ...actual, fetchPatients: (...args: unknown[]) => fetchPatients(...args) };
});

function makePatient(overrides: Partial<PatientSummary>): PatientSummary {
  return {
    id: 1, name: "Nome", email: "nome@example.com", photo_url: null, academy_id: null,
    activePlan: { plan_id: 1, title: "Plano", started_at: new Date().toISOString() },
    adherence7d: 0, adherence30d: 0, mealAdherence7dPct: 80, mealAdherence30dPct: 80,
    lastCheckinDate: new Date().toISOString().slice(0, 10),
    riskFlag: false, adherenceDropFlag: false, adherenceState: "ready",
    streakDays: 3, trend: "stable", consentRevoked: false,
    ...overrides,
  };
}

const PATIENTS: PatientSummary[] = [
  makePatient({ id: 1, name: "Ana Estável" }),
  makePatient({ id: 2, name: "Bruno Em Queda", adherenceDropFlag: true, trend: "down" }),
  makePatient({ id: 3, name: "Carla Sem Plano", activePlan: null }),
];

beforeEach(() => {
  fetchPatients.mockReset().mockResolvedValue(PATIENTS);
});

function renderPage() {
  return render(<MemoryRouter><NutritionPatientsPage /></MemoryRouter>);
}

describe("NutritionPatientsPage — busca, filtro e ordenação", () => {
  it("lista todos os pacientes por padrão", async () => {
    renderPage();
    expect(await screen.findByText("Ana Estável")).toBeInTheDocument();
    expect(screen.getByText("Bruno Em Queda")).toBeInTheDocument();
    expect(screen.getByText("Carla Sem Plano")).toBeInTheDocument();
  });

  it("busca por nome filtra a lista", async () => {
    renderPage();
    await screen.findByText("Ana Estável");
    await userEvent.type(screen.getByLabelText("Buscar paciente"), "bruno");
    expect(screen.queryByText("Ana Estável")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Em Queda")).toBeInTheDocument();
  });

  it("filtro 'Em queda' usa aria-pressed e mostra só quem está em queda", async () => {
    renderPage();
    await screen.findByText("Ana Estável");
    const toolbar = screen.getByRole("toolbar", { name: "Filtrar pacientes" });
    const chip = within(toolbar).getByRole("button", { name: /Em queda/ });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Ana Estável")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Em Queda")).toBeInTheDocument();
  });

  it("filtro 'Sem plano' mostra só quem não tem plano ativo", async () => {
    renderPage();
    await screen.findByText("Ana Estável");
    const toolbar = screen.getByRole("toolbar", { name: "Filtrar pacientes" });
    await userEvent.click(within(toolbar).getByRole("button", { name: /Sem plano/ }));
    expect(screen.getByText("Carla Sem Plano")).toBeInTheDocument();
    expect(screen.queryByText("Ana Estável")).not.toBeInTheDocument();
  });

  it("ordenar por Nome reordena a lista alfabeticamente", async () => {
    renderPage();
    await screen.findByText("Ana Estável");
    await userEvent.selectOptions(screen.getByLabelText("Ordenar por"), "name");

    await waitFor(() => {
      const rows = screen.getAllByText(/Ana Estável|Bruno Em Queda|Carla Sem Plano/);
      expect(rows.map((r) => r.textContent)).toEqual(["Ana Estável", "Bruno Em Queda", "Carla Sem Plano"]);
    });
  });

  it("carteira vazia abre o drawer de convite ao clicar no CTA, não navega para link morto", async () => {
    fetchPatients.mockResolvedValue([]);
    renderPage();
    const cta = await screen.findByRole("button", { name: "Convidar paciente" });
    await userEvent.click(cta);
    expect(await screen.findByRole("dialog", { name: "Convidar paciente" })).toBeInTheDocument();
  });
});
