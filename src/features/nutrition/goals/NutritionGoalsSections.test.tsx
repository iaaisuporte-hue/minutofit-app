/**
 * Spec 039 — fluxos das duas pontas sobre a MESMA fonte:
 *  - nutri ajusta → o painel passa a mostrar o que o servidor devolveu;
 *  - editor converte litros → ml, recusa texto, mostra o erro no campo que
 *    o backend nomear e não envia duas vezes;
 *  - aluno vê a meta e os atalhos usam a rota existente do plano.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NutritionGoals } from "../../../services/nutritionGoalsApi";

const getMyNutritionGoals = vi.fn();
const fetchPatientNutritionGoals = vi.fn();
const savePatientNutritionGoals = vi.fn();

vi.mock("../../../services/nutritionGoalsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/nutritionGoalsApi")>();
  return {
    ...actual,
    getMyNutritionGoals: (...a: unknown[]) => getMyNutritionGoals(...a),
    fetchPatientNutritionGoals: (...a: unknown[]) => fetchPatientNutritionGoals(...a),
    savePatientNutritionGoals: (...a: unknown[]) => savePatientNutritionGoals(...a),
  };
});

import { NutritionGoalsApiError } from "../../../services/nutritionGoalsApi";
import { PatientNutritionGoalsSection } from "./PatientNutritionGoalsSection";
import { StudentNutritionGoalsSection } from "./StudentNutritionGoalsSection";

const GOALS: NutritionGoals = {
  energyKcal: 2300,
  proteinMinG: 150,
  proteinMaxG: 170,
  fiberMinG: 30,
  fiberMaxG: 40,
  waterMinMl: 2500,
  waterMaxMl: 3000,
  objectives: ["weight_loss"],
  patientNote: null,
  updatedAt: "2026-10-19T12:00:00Z",
  updatedByName: "Dra. Marina",
};

beforeEach(() => {
  getMyNutritionGoals.mockReset();
  fetchPatientNutritionGoals.mockReset();
  savePatientNutritionGoals.mockReset();
});

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{`${loc.pathname}|${JSON.stringify(loc.state)}`}</div>;
}

function renderStudent(props: { hasNutri: boolean; canLogMeals: boolean }) {
  return render(
    <MemoryRouter initialEntries={["/app/user/profile"]}>
      <Routes>
        <Route path="/app/user/profile" element={<StudentNutritionGoalsSection {...props} />} />
        <Route path="/app/user/plano-alimentar" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StudentNutritionGoalsSection", () => {
  it("aluno com nutri e meta: vê os valores e 'Ver plano alimentar' usa a rota existente", async () => {
    getMyNutritionGoals.mockResolvedValue(GOALS);
    renderStudent({ hasNutri: true, canLogMeals: true });
    expect(await screen.findByText("2.300")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ver plano alimentar/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/app/user/plano-alimentar|null");
  });

  it("'Registrar refeição' abre o plano pedindo o sheet do diário (sem fluxo novo)", async () => {
    getMyNutritionGoals.mockResolvedValue(GOALS);
    renderStudent({ hasNutri: true, canLogMeals: true });
    await userEvent.click(await screen.findByRole("button", { name: /Registrar refeição/ }));
    expect(screen.getByTestId("location")).toHaveTextContent('/app/user/plano-alimentar|{"openIntakeSheet":true}');
  });

  it("sem a feature de registro, o atalho de registrar não aparece", async () => {
    getMyNutritionGoals.mockResolvedValue(GOALS);
    renderStudent({ hasNutri: true, canLogMeals: false });
    await screen.findByText("2.300");
    expect(screen.queryByRole("button", { name: /Registrar refeição/ })).not.toBeInTheDocument();
  });

  it("aluno com nutri, sem meta: estado vazio explicando quem define", async () => {
    getMyNutritionGoals.mockResolvedValue(null);
    renderStudent({ hasNutri: true, canLogMeals: true });
    expect(await screen.findByText(/Seu nutricionista ainda não definiu metas/)).toBeInTheDocument();
  });

  it("aluno sem nutri e sem meta: o painel não aparece", async () => {
    getMyNutritionGoals.mockResolvedValue(null);
    const { container } = renderStudent({ hasNutri: false, canLogMeals: true });
    await waitFor(() => expect(getMyNutritionGoals).toHaveBeenCalled());
    expect(container.querySelector(".nutritionGoals__grid")).toBeNull();
    expect(screen.queryByText("Metas diárias")).not.toBeInTheDocument();
  });

  it("erro na leitura: retry busca de novo", async () => {
    getMyNutritionGoals.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(GOALS);
    renderStudent({ hasNutri: true, canLogMeals: true });
    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("2.300")).toBeInTheDocument();
  });
});

describe("PatientNutritionGoalsSection + editor", () => {
  it("nutri define metas: payload em ml, e o painel mostra o que o servidor devolveu", async () => {
    fetchPatientNutritionGoals.mockResolvedValue(null);
    savePatientNutritionGoals.mockResolvedValue({ ...GOALS, energyKcal: 2100 });
    render(<PatientNutritionGoalsSection patientId={42} />);

    await userEvent.click(await screen.findByRole("button", { name: /Definir metas/ }));
    await userEvent.type(screen.getByLabelText("Calorias (kcal)"), "2.100");
    await userEvent.type(screen.getAllByLabelText("Mínimo")[0], "150");
    await userEvent.type(screen.getAllByLabelText("Máximo (opcional)")[0], "170");
    await userEvent.type(screen.getAllByLabelText("Mínimo")[2], "2,5");
    await userEvent.type(screen.getAllByLabelText("Máximo (opcional)")[2], "3");
    await userEvent.click(screen.getByRole("button", { name: "Emagrecimento" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar metas" }));

    await waitFor(() => expect(savePatientNutritionGoals).toHaveBeenCalledTimes(1));
    expect(savePatientNutritionGoals).toHaveBeenCalledWith(42, {
      energyKcal: 2100,
      proteinMinG: 150,
      proteinMaxG: 170,
      fiberMinG: null,
      fiberMaxG: null,
      waterMinMl: 2500,
      waterMaxMl: 3000,
      objectives: ["weight_loss"],
      patientNote: null,
    });
    // Painel atualizado imediatamente com o valor do SERVIDOR (2100), editor fechado.
    expect(await screen.findByText("2.100")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Metas salvas");
  });

  it("texto que não é número: erro no campo, nada é enviado", async () => {
    fetchPatientNutritionGoals.mockResolvedValue(GOALS);
    render(<PatientNutritionGoalsSection patientId={42} />);
    await userEvent.click(await screen.findByRole("button", { name: /Ajustar metas/ }));
    const kcal = screen.getByLabelText("Calorias (kcal)");
    await userEvent.clear(kcal);
    await userEvent.type(kcal, "muito");
    await userEvent.click(screen.getByRole("button", { name: "Salvar metas" }));
    expect(await screen.findByText("Digite apenas números.")).toBeInTheDocument();
    expect(savePatientNutritionGoals).not.toHaveBeenCalled();
  });

  it("400 do backend com campo: a mensagem aparece no campo nomeado (água em litros)", async () => {
    fetchPatientNutritionGoals.mockResolvedValue(GOALS);
    savePatientNutritionGoals.mockRejectedValue(
      new NutritionGoalsApiError(400, "O máximo de água não pode ser menor que o mínimo", "waterMaxMl"),
    );
    render(<PatientNutritionGoalsSection patientId={42} />);
    await userEvent.click(await screen.findByRole("button", { name: /Ajustar metas/ }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar metas" }));

    const waterMax = screen.getAllByLabelText("Máximo (opcional)")[2];
    await waitFor(() => expect(waterMax).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("O máximo de água não pode ser menor que o mínimo")).toBeInTheDocument();
    // Editor continua aberto e o painel segue com o valor antigo.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("salvar não duplica: botão desabilitado enquanto a requisição está em voo", async () => {
    fetchPatientNutritionGoals.mockResolvedValue(GOALS);
    let resolveSave!: (g: NutritionGoals) => void;
    savePatientNutritionGoals.mockImplementation(() => new Promise((r) => { resolveSave = r; }));
    render(<PatientNutritionGoalsSection patientId={42} />);
    await userEvent.click(await screen.findByRole("button", { name: /Ajustar metas/ }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar metas" }));
    const busy = screen.getByRole("button", { name: "Salvando..." });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(savePatientNutritionGoals).toHaveBeenCalledTimes(1);
    resolveSave(GOALS);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("editor parte do valor atual (litros com vírgula) e o painel do nutri mostra as mesmas metas do aluno", async () => {
    fetchPatientNutritionGoals.mockResolvedValue(GOALS);
    getMyNutritionGoals.mockResolvedValue(GOALS);
    const nutri = render(<PatientNutritionGoalsSection patientId={42} />);
    await nutri.findByText("2.300");
    const nutriValues = ["kcal", "protein", "fiber", "water"].map((k) => within(nutri.getByTestId(`goal-${k}`)).getByRole("definition").textContent);
    await userEvent.click(nutri.getByRole("button", { name: /Ajustar metas/ }));
    expect(nutri.getAllByLabelText("Mínimo")[2]).toHaveValue("2,5");
    nutri.unmount();

    renderStudent({ hasNutri: true, canLogMeals: true });
    await screen.findByText("2.300");
    const studentValues = ["kcal", "protein", "fiber", "water"].map((k) => within(screen.getByTestId(`goal-${k}`)).getByRole("definition").textContent);
    expect(studentValues).toEqual(nutriValues);
  });

  it("consentimento revogado: o painel não aparece (o Resumo já mostra o aviso)", async () => {
    fetchPatientNutritionGoals.mockRejectedValue(new NutritionGoalsApiError(403, "consent_required", null));
    const { container } = render(<PatientNutritionGoalsSection patientId={42} />);
    await waitFor(() => expect(fetchPatientNutritionGoals).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector(".nutritionGoals")).toBeNull());
  });
});
