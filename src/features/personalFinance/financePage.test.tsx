/**
 * Financeiro do personal — contrato da tela (Onda F2).
 *
 * O que se trava aqui: os KPIs vêm do backend e são só formatados, o status de
 * cada aluno é o que o servidor derivou (a tela não recalcula vencimento), os
 * chips contam a carteira inteira, e abrir um aluno leva ao registro manual de
 * pagamento — que é a razão de o módulo existir.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/personalFinanceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/personalFinanceApi")>();
  return {
    ...actual,
    fetchFinanceOverview: vi.fn(),
    fetchFinanceStudents: vi.fn(),
    fetchStudentFinance: vi.fn(),
    payFinanceCharge: vi.fn(),
  };
});

import FinancePage from "./FinancePage";
import {
  fetchFinanceOverview,
  fetchFinanceStudents,
  fetchStudentFinance,
  payFinanceCharge,
  type FinanceCharge,
  type FinanceOverview,
  type StudentFinanceRow,
} from "../../services/personalFinanceApi";

const charge = (over: Partial<FinanceCharge> = {}): FinanceCharge => ({
  id: 1,
  planId: 1,
  studentId: 10,
  competence: "2026-08-01",
  dueDate: "2026-08-05",
  amountCents: 25_000,
  paidCents: 0,
  status: "open",
  derivedStatus: "overdue",
  daysOverdue: 12,
  paidAt: null,
  paidMethod: null,
  origin: "manual",
  notes: null,
  recordedBy: null,
  ...over,
});

const OVERVIEW: FinanceOverview = {
  kpis: {
    month: "2026-08",
    expectedCents: 50_000,
    receivedCents: 25_000,
    pendingCents: 0,
    overdueCents: 25_000,
    overdueStudents: 1,
    upcomingRenewals: 1,
    mrrCents: 50_000,
  },
  attention: [
    {
      kind: "payment_overdue",
      studentId: 10,
      studentName: "João Atrasado",
      chargeId: 1,
      dueDate: "2026-08-05",
      daysOverdue: 12,
      amountCents: 25_000,
    },
  ],
  renewals: [
    {
      studentId: 20,
      studentName: "Maria Pacote",
      dueDate: "2026-08-28",
      amountCents: 60_000,
      period: "package",
      autoRenew: true,
    },
  ],
};

const ROWS: StudentFinanceRow[] = [
  {
    studentId: 10,
    studentName: "João Atrasado",
    studentEmail: "joao@test.local",
    studentPhone: "11999999999",
    plan: {
      id: 1,
      studentId: 10,
      priceCents: 25_000,
      period: "monthly",
      dueDay: 5,
      packageSessions: null,
      autoRenew: true,
      paymentMethod: "pix",
      status: "active",
      startsOn: "2026-06-01",
      endsOn: null,
      notes: null,
      createdAt: "2026-06-01T12:00:00.000Z",
      updatedAt: "2026-06-01T12:00:00.000Z",
    },
    currentCharge: charge(),
  },
  {
    studentId: 30,
    studentName: "Ana Sem Acordo",
    studentEmail: "ana@test.local",
    studentPhone: null,
    plan: null,
    currentCharge: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchFinanceOverview).mockResolvedValue(OVERVIEW);
  vi.mocked(fetchFinanceStudents).mockResolvedValue(ROWS);
  vi.mocked(fetchStudentFinance).mockResolvedValue({
    plan: ROWS[0].plan,
    charges: [charge()],
    events: [
      {
        id: 5,
        chargeId: 1,
        planId: 1,
        eventType: "charge_created",
        actorId: 1,
        payload: {},
        createdAt: "2026-08-01T12:00:00.000Z",
      },
    ],
  });
});

describe("Financeiro do personal", () => {
  it("mostra os KPIs do servidor e o estado de cada aluno", async () => {
    render(<FinancePage />);

    expect(await screen.findByText("R$ 500,00")).toBeInTheDocument(); // previsto
    expect(screen.getAllByText("R$ 250,00").length).toBeGreaterThan(0); // recebido/vencido

    // O status exibido é o derivado pelo backend, com o atraso que ele contou.
    expect(screen.getByText("Vencido · 12 dias")).toBeInTheDocument();
    expect(screen.getByText("Sem acordo")).toBeInTheDocument();

    // Renovação e pendência ganham superfície própria.
    expect(screen.getByText("Próximas renovações")).toBeInTheDocument();
    expect(screen.getByText("1 aluno com pagamento vencido")).toBeInTheDocument();
  });

  it("os chips contam a carteira inteira e filtram sem nova requisição", async () => {
    const user = userEvent.setup();
    render(<FinancePage />);

    expect(await screen.findByText("Todos (2)")).toBeInTheDocument();
    expect(screen.getByText("Vencidos (1)")).toBeInTheDocument();
    expect(screen.getByText("Sem acordo (1)")).toBeInTheDocument();

    await user.click(screen.getByText("Sem acordo (1)"));

    expect(screen.queryByRole("button", { name: "João Atrasado" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ana Sem Acordo" })).toBeInTheDocument();
    expect(vi.mocked(fetchFinanceStudents)).toHaveBeenCalledTimes(1);
  });

  it("abrir um aluno leva ao registro manual de pagamento", async () => {
    const user = userEvent.setup();
    vi.mocked(payFinanceCharge).mockResolvedValue(
      charge({ status: "paid", derivedStatus: "paid", paidCents: 25_000 }),
    );
    render(<FinancePage />);

    await user.click(await screen.findByRole("button", { name: "João Atrasado" }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Mensal")).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Marcar como pago" }));

    // Valor e data já vêm preenchidos: o caminho comum é um toque em confirmar.
    const amount = within(sheet).getByLabelText(/Valor recebido/i) as HTMLInputElement;
    expect(amount.value).toBe("250.00");

    await user.click(within(sheet).getByRole("button", { name: "Confirmar pagamento" }));

    await waitFor(() => expect(vi.mocked(payFinanceCharge)).toHaveBeenCalledTimes(1));
    const [chargeId, input] = vi.mocked(payFinanceCharge).mock.calls[0];
    expect(chargeId).toBe(1);
    expect(input?.paidCents).toBe(25_000);
    expect(input?.paidMethod).toBe("pix");

    // Pagamento mexe nos KPIs: a página recarrega em vez de adivinhar o novo total.
    await waitFor(() => expect(vi.mocked(fetchFinanceOverview)).toHaveBeenCalledTimes(2));
  });

  it("não oferece cobrança por WhatsApp para aluno sem telefone", async () => {
    render(<FinancePage />);
    await screen.findByRole("button", { name: "Ana Sem Acordo" });

    const [joao, ana] = screen.getAllByRole("button", { name: /Cobrar/ });
    expect(joao).toBeEnabled();
    expect(ana).toBeDisabled();
  });
});
