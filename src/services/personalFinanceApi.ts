/**
 * Cliente do módulo Financeiro do personal (`/api/personal/finance/*`).
 *
 * A plataforma não processa pagamento: o personal recebe fora (PIX, dinheiro,
 * MP próprio) e aqui só registra o acordo e o status. Todo número exibido na
 * tela — previsto, recebido, vencido, dias de atraso — vem calculado do
 * servidor; o cliente formata, nunca deriva.
 */
import { API_URL } from "./apiBase";
import { authFetch } from "./apiClient";

// ---------------------------------------------------------------------------
// Tipos (espelho de backend/src/services/personalFinanceService.ts)
// ---------------------------------------------------------------------------

export const FINANCE_PERIODS = [
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "package",
  "single",
] as const;
export type FinancePeriod = (typeof FINANCE_PERIODS)[number];

export const PAYMENT_METHODS = ["pix", "cash", "card", "transfer", "mp", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PlanStatus = "active" | "paused" | "ended";
export type ChargeStatus = "open" | "paid" | "partial" | "waived" | "canceled";

/** O que a tela mostra: o armazenado, com `open`/`partial` resolvidos pela data. */
export type DerivedChargeStatus =
  | "paid"
  | "partial"
  | "overdue"
  | "upcoming"
  | "waived"
  | "canceled";

export type FinancePlan = {
  id: number;
  studentId: number;
  priceCents: number;
  period: FinancePeriod;
  dueDay: number | null;
  packageSessions: number | null;
  autoRenew: boolean;
  paymentMethod: PaymentMethod | null;
  status: PlanStatus;
  startsOn: string;
  endsOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceCharge = {
  id: number;
  planId: number;
  studentId: number;
  competence: string;
  dueDate: string;
  amountCents: number;
  paidCents: number;
  status: ChargeStatus;
  derivedStatus: DerivedChargeStatus;
  daysOverdue: number;
  paidAt: string | null;
  paidMethod: PaymentMethod | null;
  origin: "manual" | "mp";
  notes: string | null;
  recordedBy: number | null;
};

export type FinanceEvent = {
  id: number;
  chargeId: number | null;
  planId: number | null;
  eventType: string;
  actorId: number;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type FinanceKpis = {
  month: string;
  expectedCents: number;
  receivedCents: number;
  pendingCents: number;
  overdueCents: number;
  overdueStudents: number;
  upcomingRenewals: number;
  mrrCents: number;
};

export type FinanceAttentionItem = {
  kind: "payment_overdue";
  studentId: number;
  studentName: string | null;
  chargeId: number;
  dueDate: string;
  daysOverdue: number;
  amountCents: number;
};

export type FinanceRenewalItem = {
  studentId: number;
  studentName: string | null;
  dueDate: string;
  amountCents: number;
  period: FinancePeriod;
  autoRenew: boolean;
};

export type FinanceOverview = {
  kpis: FinanceKpis;
  attention: FinanceAttentionItem[];
  renewals: FinanceRenewalItem[];
};

/** Uma linha da carteira sob a lente financeira (aluno sem acordo entra também). */
export type StudentFinanceRow = {
  studentId: number;
  studentName: string | null;
  studentEmail: string | null;
  studentPhone: string | null;
  plan: FinancePlan | null;
  currentCharge: FinanceCharge | null;
};

export type StudentFinanceDetail = {
  plan: FinancePlan | null;
  charges: FinanceCharge[];
  events: FinanceEvent[];
};

export type FinanceHistoryPoint = {
  month: string;
  expectedCents: number;
  receivedCents: number;
};

export type FinanceStudentsFilter = "all" | "overdue" | "upcoming" | "paid" | "no_plan";

export type FinancePlanInput = {
  priceCents: number;
  period: FinancePeriod;
  dueDay?: number | null;
  packageSessions?: number | null;
  autoRenew?: boolean;
  paymentMethod?: PaymentMethod | null;
  startsOn?: string | null;
  endsOn?: string | null;
  notes?: string | null;
};

export type PayChargeInput = {
  paidCents?: number | null;
  paidAt?: string | null;
  paidMethod?: PaymentMethod | null;
  notes?: string | null;
};

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

/**
 * O backend responde com códigos estáveis (`invalid_due_day`), não com frase
 * pronta. Traduzir aqui evita que um identificador técnico apareça na tela —
 * foi exatamente o defeito corrigido no QA do módulo Personal.
 */
const ERROR_MESSAGES: Record<string, string> = {
  ASSIGNMENT_REQUIRED: "Este aluno não está na sua carteira.",
  plan_not_found: "Este aluno ainda não tem acordo registrado.",
  plan_already_ended: "Este acordo já foi encerrado.",
  charge_not_found: "Cobrança não encontrada.",
  charge_not_payable: "Esta cobrança não está aberta para pagamento.",
  charge_not_reversible: "Só é possível estornar uma cobrança paga.",
  charge_not_open: "Esta cobrança já foi fechada.",
  invalid_price_cents: "Informe um valor válido.",
  invalid_period: "Escolha uma periodicidade válida.",
  invalid_due_day: "Escolha um dia de vencimento entre 1 e 28.",
  due_day_not_allowed_for_period: "Pacote e cobrança avulsa não têm dia de vencimento.",
  invalid_package_sessions: "Informe um número de sessões entre 1 e 1000.",
  package_sessions_not_allowed_for_period: "Sessões só valem para acordos de pacote.",
  invalid_payment_method: "Escolha uma forma de pagamento válida.",
  invalid_starts_on: "Data de início inválida.",
  invalid_ends_on: "Data de término inválida.",
  ends_on_before_starts_on: "O término não pode ser anterior ao início.",
  invalid_paid_cents: "Informe um valor de pagamento válido.",
  paid_cents_exceeds_remaining: "O valor informado é maior do que o que falta pagar.",
  invalid_paid_at: "Data de pagamento inválida.",
  invalid_status_filter: "Filtro inválido.",
};

async function request<T>(path: string, init?: RequestInit, fallback = "Falha na operação"): Promise<T> {
  const res = await authFetch(`${API_URL}/personal${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    const code = typeof json?.error === "string" ? json.error : "";
    throw new Error(ERROR_MESSAGES[code] || code || fallback);
  }
  return json.data as T;
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

export function fetchFinanceOverview(): Promise<FinanceOverview> {
  return request<FinanceOverview>("/finance/overview", undefined, "Falha ao carregar o financeiro.");
}

export function fetchFinanceStudents(
  filter: { status?: FinanceStudentsFilter; q?: string } = {}
): Promise<StudentFinanceRow[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.q?.trim()) params.set("q", filter.q.trim());
  const query = params.toString();
  return request<StudentFinanceRow[]>(
    `/finance/students${query ? `?${query}` : ""}`,
    undefined,
    "Falha ao listar o financeiro dos alunos."
  );
}

export function fetchStudentFinance(studentId: number): Promise<StudentFinanceDetail> {
  return request<StudentFinanceDetail>(
    `/finance/students/${studentId}`,
    undefined,
    "Falha ao carregar o financeiro do aluno."
  );
}

export function fetchFinanceHistory(months = 6): Promise<FinanceHistoryPoint[]> {
  return request<FinanceHistoryPoint[]>(
    `/finance/history?months=${months}`,
    undefined,
    "Falha ao carregar o histórico financeiro."
  );
}

// ---------------------------------------------------------------------------
// Acordo
// ---------------------------------------------------------------------------

export function createFinancePlan(studentId: number, input: FinancePlanInput): Promise<FinancePlan> {
  return request<FinancePlan>(
    `/finance/students/${studentId}/plan`,
    jsonBody(input),
    "Falha ao registrar o acordo financeiro."
  );
}

export function updateFinancePlan(
  studentId: number,
  patch: Partial<FinancePlanInput> & { status?: "active" | "paused" }
): Promise<FinancePlan> {
  return request<FinancePlan>(
    `/finance/students/${studentId}/plan`,
    { ...jsonBody(patch), method: "PATCH" },
    "Falha ao atualizar o acordo financeiro."
  );
}

export function endFinancePlan(studentId: number): Promise<FinancePlan> {
  return request<FinancePlan>(
    `/finance/students/${studentId}/plan/end`,
    { method: "POST" },
    "Falha ao encerrar o acordo financeiro."
  );
}

// ---------------------------------------------------------------------------
// Cobranças
// ---------------------------------------------------------------------------

export function payFinanceCharge(chargeId: number, input: PayChargeInput = {}): Promise<FinanceCharge> {
  return request<FinanceCharge>(
    `/finance/charges/${chargeId}/pay`,
    jsonBody(input),
    "Falha ao registrar o pagamento."
  );
}

export function revertFinanceCharge(chargeId: number): Promise<FinanceCharge> {
  return request<FinanceCharge>(
    `/finance/charges/${chargeId}/revert`,
    { method: "POST" },
    "Falha ao estornar o pagamento."
  );
}

export function waiveFinanceCharge(chargeId: number, notes?: string): Promise<FinanceCharge> {
  return request<FinanceCharge>(
    `/finance/charges/${chargeId}/waive`,
    jsonBody({ notes: notes ?? null }),
    "Falha ao isentar a cobrança."
  );
}

export function cancelFinanceCharge(chargeId: number): Promise<FinanceCharge> {
  return request<FinanceCharge>(
    `/finance/charges/${chargeId}/cancel`,
    { method: "POST" },
    "Falha ao cancelar a cobrança."
  );
}

// ---------------------------------------------------------------------------
// Formatação (usada pelos componentes do módulo)
// ---------------------------------------------------------------------------

export function formatCents(cents: number): string {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** 'YYYY-MM-DD' em dd/mm — sem `new Date(iso)`, que joga a data um dia atrás no BRT. */
export function formatIsoDay(day: string, withYear = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "—";
  const [year, month, date] = day.split("-");
  return withYear ? `${date}/${month}/${year}` : `${date}/${month}`;
}

const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Competência ('YYYY-MM-01') como "ago/2026".
 *
 * A competência é sempre o primeiro dia do mês; exibi-la como data ("01/08")
 * sugeriria um vencimento que ela não é.
 */
export function formatCompetence(competence: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(competence)) return "—";
  const month = Number(competence.slice(5, 7));
  return `${MONTH_ABBR[month - 1] ?? "—"}/${competence.slice(0, 4)}`;
}

export const PERIOD_LABEL: Record<FinancePeriod, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  package: "Pacote",
  single: "Avulso",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
  mp: "Mercado Pago",
  other: "Outro",
};
