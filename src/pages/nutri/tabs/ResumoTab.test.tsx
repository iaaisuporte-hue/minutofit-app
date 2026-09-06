/**
 * SPEC 037 / P2.4 (consolidação) + P2.9 (ação rápida de observação).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ResumoTab } from "./ResumoTab";

const fetchPatientPlans = vi.fn();
const fetchMealHeatmap = vi.fn();
const fetchClinicalProfile = vi.fn();
const fetchPatientInsights = vi.fn();
const createObservation = vi.fn();

vi.mock("../../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/nutriApi")>();
  return {
    ...actual,
    fetchPatientPlans: (...args: unknown[]) => fetchPatientPlans(...args),
    fetchMealHeatmap: (...args: unknown[]) => fetchMealHeatmap(...args),
    fetchClinicalProfile: (...args: unknown[]) => fetchClinicalProfile(...args),
    fetchPatientInsights: (...args: unknown[]) => fetchPatientInsights(...args),
    createObservation: (...args: unknown[]) => createObservation(...args),
  };
});

beforeEach(() => {
  fetchPatientPlans.mockReset().mockResolvedValue({ active: null, history: [] });
  fetchMealHeatmap.mockReset().mockResolvedValue({ plan: null, meals: [], checkins: [], adherence: null });
  fetchClinicalProfile.mockReset().mockResolvedValue({ items: [], hasSevereAllergy: false });
  fetchPatientInsights.mockReset().mockResolvedValue([]);
  createObservation.mockReset().mockResolvedValue({ id: 1, body: "x", created_at: "", updated_at: "" });
});

describe("ResumoTab", () => {
  it("mostra CTA de criar plano quando não há plano ativo", async () => {
    render(<ResumoTab patientId={1} onNavigateTab={vi.fn()} />);
    expect(await screen.findByText("Nenhum plano ativo.")).toBeInTheDocument();
  });

  it("clicar em 'Abrir plano'/'Criar plano' navega para a aba certa", async () => {
    const onNavigateTab = vi.fn();
    render(<ResumoTab patientId={1} onNavigateTab={onNavigateTab} />);
    await userEvent.click(await screen.findByRole("button", { name: "Criar plano" }));
    expect(onNavigateTab).toHaveBeenCalledWith("plano");
  });

  it("ação rápida: adicionar observação chama createObservation sem abrir segundo sistema de notas", async () => {
    render(<ResumoTab patientId={1} onNavigateTab={vi.fn()} />);
    await screen.findByText("Nenhum plano ativo.");

    await userEvent.click(screen.getByRole("button", { name: /Adicionar observação/ }));
    await userEvent.type(screen.getByPlaceholderText(/Observação rápida/), "Paciente relatou fome noturna.");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createObservation).toHaveBeenCalledWith(1, "Paciente relatou fome noturna."));
    expect(await screen.findByText("Observação salva.")).toBeInTheDocument();
  });
});
