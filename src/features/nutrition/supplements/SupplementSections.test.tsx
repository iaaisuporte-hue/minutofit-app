/**
 * Spec 040 — suplementação: o aluno vê e registra uso sem alterar a
 * orientação; o nutri cria, suspende/reativa, encerra (com confirmação) e
 * lê só fatos do uso ("Nenhuma utilização registrada" quando não há).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NutriSupplement, StudentSupplement, SupplementUsageLog } from "../../../services/supplementsApi";

const getMySupplements = vi.fn();
const logMySupplementUsage = vi.fn();
const undoMySupplementUsage = vi.fn();
const fetchPatientSupplements = vi.fn();
const createPatientSupplement = vi.fn();
const updatePatientSupplement = vi.fn();

vi.mock("../../../services/supplementsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/supplementsApi")>();
  return {
    ...actual,
    getMySupplements: (...a: unknown[]) => getMySupplements(...a),
    logMySupplementUsage: (...a: unknown[]) => logMySupplementUsage(...a),
    undoMySupplementUsage: (...a: unknown[]) => undoMySupplementUsage(...a),
    fetchPatientSupplements: (...a: unknown[]) => fetchPatientSupplements(...a),
    createPatientSupplement: (...a: unknown[]) => createPatientSupplement(...a),
    updatePatientSupplement: (...a: unknown[]) => updatePatientSupplement(...a),
  };
});

import { SupplementApiError } from "../../../services/supplementsApi";
import { StudentSupplementsSection } from "./StudentSupplementsSection";
import { PatientSupplementsSection } from "./PatientSupplementsSection";
import { formatDose, formatFrequency } from "./supplementLabels";

const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const BASE = {
  id: 1,
  name: "Creatina monohidratada",
  doseAmount: 5,
  doseUnit: "g" as const,
  frequency: "daily" as const,
  frequencyDetail: null,
  timing: "Junto com o almoço",
  purpose: "Suporte ao treino de força",
  notes: "Beber água ao longo do dia.",
  startDate: "2026-10-01",
  endDate: null,
  status: "active" as const,
  statusChangedAt: null,
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-01T12:00:00Z",
  updatedByName: "Dra. Fernanda",
};

const studentItem = (over: Partial<StudentSupplement> = {}): StudentSupplement => ({ ...BASE, usedTodayCount: 0, ...over });
const nutriItem = (over: Partial<NutriSupplement> = {}): NutriSupplement => ({ ...BASE, usage: { lastUsedAt: null, count7d: 0 }, ...over });
const log = (over: Partial<SupplementUsageLog> = {}): SupplementUsageLog => ({
  id: 10, supplementId: 1, supplementName: "Creatina monohidratada", dateKey: todayKey, takenAt: new Date().toISOString(), note: null, ...over,
});

beforeEach(() => {
  [getMySupplements, logMySupplementUsage, undoMySupplementUsage, fetchPatientSupplements, createPatientSupplement, updatePatientSupplement].forEach((f) => f.mockReset());
});

describe("rótulos", () => {
  it("dose e frequência em PT-BR, com plural e detalhe do nutri", () => {
    expect(formatDose(5, "g")).toBe("5 g");
    expect(formatDose(1, "capsule")).toBe("1 cápsula");
    expect(formatDose(2, "capsule")).toBe("2 cápsulas");
    expect(formatDose(2000, "ui")).toBe("2.000 UI");
    expect(formatDose(2.5, "ml")).toBe("2,5 ml");
    expect(formatFrequency("weekly", "seg, qua, sex")).toBe("Semanal · seg, qua, sex");
  });
});

describe("StudentSupplementsSection (aluno)", () => {
  it("mostra a orientação do nutri: dose, frequência, horário, finalidade e cuidados", async () => {
    getMySupplements.mockResolvedValue({ supplements: [studentItem()], recentLogs: [] });
    render(<StudentSupplementsSection />);
    const card = await screen.findByRole("article", { name: "Creatina monohidratada" });
    expect(within(card).getByText("5 g · 1x ao dia")).toBeInTheDocument();
    expect(within(card).getByText("Junto com o almoço")).toBeInTheDocument();
    expect(within(card).getByText("Suporte ao treino de força")).toBeInTheDocument();
    expect(within(card).getByText("Beber água ao longo do dia.")).toBeInTheDocument();
    expect(within(card).getByText("Ainda não registrado hoje")).toBeInTheDocument();
    // O aluno não tem nenhuma ação de alterar a orientação.
    expect(screen.queryByRole("button", { name: /Editar|Suspender|Encerrar/ })).not.toBeInTheDocument();
  });

  it("registrar uso: envia uma chave por toque, trava durante o envio e recarrega o estado do servidor", async () => {
    getMySupplements
      .mockResolvedValueOnce({ supplements: [studentItem()], recentLogs: [] })
      .mockResolvedValueOnce({ supplements: [studentItem({ usedTodayCount: 1 })], recentLogs: [log()] });
    let resolveLog!: (l: SupplementUsageLog) => void;
    logMySupplementUsage.mockImplementation(() => new Promise((r) => { resolveLog = r; }));
    render(<StudentSupplementsSection />);

    await userEvent.click(await screen.findByRole("button", { name: "Registrar uso" }));
    const busy = screen.getByRole("button", { name: "Registrando..." });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(logMySupplementUsage).toHaveBeenCalledTimes(1);
    const [id, key] = logMySupplementUsage.mock.calls[0];
    expect(id).toBe(1);
    expect(typeof key).toBe("string");
    expect((key as string).length).toBeGreaterThanOrEqual(8);

    resolveLog(log());
    expect(await screen.findByText("Usado hoje")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Uso de Creatina monohidratada registrado.");
  });

  it("registros recentes: desfazer só aparece nos de hoje", async () => {
    getMySupplements
      .mockResolvedValueOnce({
        supplements: [studentItem({ usedTodayCount: 1 })],
        recentLogs: [log({ id: 11 }), log({ id: 12, dateKey: "2026-01-01", takenAt: "2026-01-01T12:00:00Z" })],
      })
      .mockResolvedValueOnce({ supplements: [studentItem()], recentLogs: [log({ id: 12, dateKey: "2026-01-01", takenAt: "2026-01-01T12:00:00Z" })] });
    undoMySupplementUsage.mockResolvedValue(undefined);
    render(<StudentSupplementsSection />);

    await userEvent.click(await screen.findByRole("button", { name: /Registros recentes \(2\)/ }));
    const undoButtons = screen.getAllByRole("button", { name: "Desfazer" });
    expect(undoButtons).toHaveLength(1);
    await userEvent.click(undoButtons[0]);
    expect(undoMySupplementUsage).toHaveBeenCalledWith(11);
    expect(await screen.findByText("Ainda não registrado hoje")).toBeInTheDocument();
  });

  it("sem orientação e sem registros: a seção não aparece", async () => {
    getMySupplements.mockResolvedValue({ supplements: [], recentLogs: [] });
    const { container } = render(<StudentSupplementsSection />);
    await waitFor(() => expect(getMySupplements).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("erro: alerta com nova tentativa", async () => {
    getMySupplements.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ supplements: [studentItem()], recentLogs: [] });
    render(<StudentSupplementsSection />);
    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("article", { name: "Creatina monohidratada" })).toBeInTheDocument();
  });
});

describe("PatientSupplementsSection (nutri)", () => {
  it("linha de uso: 'Nenhuma utilização registrada' ou último registro + contagem de 7 dias", async () => {
    fetchPatientSupplements.mockResolvedValue([
      nutriItem(),
      nutriItem({ id: 2, name: "Vitamina D3", doseAmount: 2000, doseUnit: "ui", usage: { lastUsedAt: new Date().toISOString(), count7d: 3 } }),
    ]);
    render(<PatientSupplementsSection patientId={42} />);
    const creatina = await screen.findByRole("article", { name: "Creatina monohidratada" });
    expect(within(creatina).getByText("Nenhuma utilização registrada")).toBeInTheDocument();
    const vitD = screen.getByRole("article", { name: "Vitamina D3" });
    expect(within(vitD).getByText(/Último registro hoje às .* · 3 registros em 7 dias/)).toBeInTheDocument();
    expect(within(vitD).getByText("Ativa")).toBeInTheDocument();
  });

  it("criar: nada pré-escolhido, quantidade PT-BR convertida, e lista recarregada do servidor", async () => {
    fetchPatientSupplements.mockResolvedValueOnce([]).mockResolvedValueOnce([nutriItem({ doseAmount: 2.5 })]);
    createPatientSupplement.mockResolvedValue({ ...BASE, doseAmount: 2.5 });
    render(<PatientSupplementsSection patientId={42} />);

    expect(await screen.findByText("Nenhuma suplementação orientada para este paciente.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    const dialog = screen.getByRole("dialog", { name: "Nova suplementação" });
    expect(within(dialog).getByLabelText("Unidade")).toHaveValue("");
    expect(within(dialog).getByLabelText("Frequência")).toHaveValue("");

    await userEvent.type(within(dialog).getByLabelText("Suplemento"), "Creatina monohidratada");
    await userEvent.type(within(dialog).getByLabelText("Quantidade"), "2,5");
    // Sem unidade → erro local, nada enviado.
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Escolha a unidade.")).toBeInTheDocument();
    expect(createPatientSupplement).not.toHaveBeenCalled();

    await userEvent.selectOptions(within(dialog).getByLabelText("Unidade"), "g");
    await userEvent.selectOptions(within(dialog).getByLabelText("Frequência"), "daily");
    await userEvent.type(within(dialog).getByLabelText("Horário sugerido (opcional)"), "Junto com o almoço");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createPatientSupplement).toHaveBeenCalledTimes(1));
    expect(createPatientSupplement).toHaveBeenCalledWith(42, {
      name: "Creatina monohidratada", doseAmount: 2.5, doseUnit: "g", frequency: "daily",
      frequencyDetail: null, timing: "Junto com o almoço", purpose: null, notes: null, startDate: null, endDate: null,
    });
    expect(await screen.findByText("2,5 g · 1x ao dia")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("400 do backend com campo: erro aparece no campo nomeado", async () => {
    fetchPatientSupplements.mockResolvedValue([nutriItem()]);
    updatePatientSupplement.mockRejectedValue(new SupplementApiError(400, "A data de término não pode ser anterior à de início", "endDate"));
    render(<PatientSupplementsSection patientId={42} />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar suplementação" });
    expect(within(dialog).getByLabelText("Suplemento")).toHaveValue("Creatina monohidratada");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(within(dialog).getByLabelText("Término (opcional)")).toHaveAttribute("aria-invalid", "true"));
    expect(within(dialog).getByText("A data de término não pode ser anterior à de início")).toBeInTheDocument();
  });

  it("suspender e reativar enviam só o status", async () => {
    fetchPatientSupplements
      .mockResolvedValueOnce([nutriItem()])
      .mockResolvedValueOnce([nutriItem({ status: "suspended" })])
      .mockResolvedValueOnce([nutriItem()]);
    updatePatientSupplement.mockResolvedValue(BASE);
    render(<PatientSupplementsSection patientId={42} />);

    await userEvent.click(await screen.findByRole("button", { name: "Suspender" }));
    expect(updatePatientSupplement).toHaveBeenLastCalledWith(42, 1, { status: "suspended" });
    expect(await screen.findByText("Suspensa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reativar" }));
    expect(updatePatientSupplement).toHaveBeenLastCalledWith(42, 1, { status: "active" });
  });

  it("encerrar pede confirmação; encerradas ficam recolhidas", async () => {
    fetchPatientSupplements
      .mockResolvedValueOnce([nutriItem()])
      .mockResolvedValueOnce([nutriItem({ status: "ended" })]);
    updatePatientSupplement.mockResolvedValue(BASE);
    render(<PatientSupplementsSection patientId={42} />);

    await userEvent.click(await screen.findByRole("button", { name: "Encerrar" }));
    expect(updatePatientSupplement).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Encerrar" }));
    expect(updatePatientSupplement).toHaveBeenCalledWith(42, 1, { status: "ended" });

    const toggle = await screen.findByRole("button", { name: /Encerradas \(1\)/ });
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByRole("article", { name: "Creatina monohidratada" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("consentimento revogado: a seção não aparece", async () => {
    fetchPatientSupplements.mockRejectedValue(new SupplementApiError(403, "consent_required", null));
    const { container } = render(<PatientSupplementsSection patientId={42} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
