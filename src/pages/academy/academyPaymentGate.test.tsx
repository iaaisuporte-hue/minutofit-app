import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Regra 3.1.1 das lojas: no app empacotado nenhuma superfície mostra preço nem
 * caminho de pagamento. Estas duas telas da academia eram as únicas que ainda
 * não tinham o gate que outras 11 já aplicavam.
 */

const plataforma = vi.hoisted(() => ({ nativo: false }));
const api = vi.hoisted(() => ({
  fetchAcademyPayments: vi.fn(async () => ({ rows: [], total: 0, kpis: null })),
  fetchPlans: vi.fn(async () => []),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  archivePlan: vi.fn(),
  startAcademyCheckout: vi.fn(),
}));

vi.mock("../../lib/platform", () => ({
  isNativeApp: () => plataforma.nativo,
  getPlatform: () => (plataforma.nativo ? "ios" : "web"),
}));

vi.mock("../../services/academyApi", () => api);

const { default: AcademyFinancePage } = await import("./AcademyFinancePage");
const { default: AcademyPlansPage } = await import("./AcademyPlansPage");

beforeEach(() => {
  plataforma.nativo = false;
  api.fetchAcademyPayments.mockClear();
  api.fetchPlans.mockClear();
});

describe("Financeiro da academia", () => {
  it("no app empacotado, manda gerenciar na web e nem consulta a API", async () => {
    plataforma.nativo = true;
    render(<AcademyFinancePage />);

    expect(screen.getByText(/versão web do S2Core/i)).toBeInTheDocument();
    expect(screen.queryByText(/Receita do mês/i)).not.toBeInTheDocument();
    expect(api.fetchAcademyPayments).not.toHaveBeenCalled();
  });

  it("na web continua carregando os pagamentos", async () => {
    render(<AcademyFinancePage />);
    await waitFor(() => expect(api.fetchAcademyPayments).toHaveBeenCalled());
    expect(screen.queryByText(/versão web do S2Core/i)).not.toBeInTheDocument();
  });
});

describe("Planos da academia", () => {
  it("no app empacotado, esconde os valores de mensalidade", async () => {
    plataforma.nativo = true;
    render(<AcademyPlansPage />);

    expect(screen.getByText(/versão web do S2Core/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /novo plano/i })).not.toBeInTheDocument();
    expect(api.fetchPlans).not.toHaveBeenCalled();
  });

  it("na web continua listando os planos", async () => {
    render(<AcademyPlansPage />);
    await waitFor(() => expect(api.fetchPlans).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /novo plano/i })).toBeInTheDocument();
  });
});
