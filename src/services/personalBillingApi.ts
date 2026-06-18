import { API_URL } from "./apiBase";
import { authFetch } from "./apiClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingPeriod = "monthly" | "quarterly" | "semiannual" | "annual";

export type BillingSettings = {
  personalId: number;
  defaultTicketCents: number | null;
  defaultPeriod: BillingPeriod;
  metacoreFeeBps: number;
};

export type BillingPlan = {
  id: number;
  personalId: number;
  academyId: number | null;
  title: string;
  description: string | null;
  priceCents: number;
  period: BillingPeriod;
  active: boolean;
};

export type StudentSubscription = {
  id: number;
  personalId: number;
  studentId: number;
  academyId: number | null;
  planId: number | null;
  priceCents: number;
  status: "pending" | "active" | "paused" | "canceled" | "expired";
  mpPreapprovalId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextChargeAt: string | null;
  discountCents: number;
  metaCoreFeeSnapshot: number;
};

export type FinanceSummary = {
  mrrCents: number;
  activeCount: number;
  churnRate30d: number;
  averageTicketCents: number;
  retention30d: number;
  monthlyEvolution: Array<{ month: string; mrrCents: number; activeCount: number }>;
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function fetchBillingSettings(): Promise<BillingSettings | null> {
  const res = await authFetch(`${API_URL}/personal/billing/settings`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch billing settings");
  return json.data;
}

export async function updateBillingSettings(
  input: Partial<Pick<BillingSettings, "defaultTicketCents" | "defaultPeriod" | "metacoreFeeBps">>
): Promise<BillingSettings> {
  const res = await authFetch(`${API_URL}/personal/billing/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to update billing settings");
  return json.data;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function fetchBillingPlans(): Promise<BillingPlan[]> {
  const res = await authFetch(`${API_URL}/personal/billing/plans`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch billing plans");
  return json.data;
}

export async function createBillingPlan(input: {
  title: string;
  description?: string;
  priceCents: number;
  period: BillingPeriod;
}): Promise<BillingPlan> {
  const res = await authFetch(`${API_URL}/personal/billing/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to create billing plan");
  return json.data;
}

export async function updateBillingPlan(
  id: number,
  input: Partial<BillingPlan>
): Promise<BillingPlan> {
  const res = await authFetch(`${API_URL}/personal/billing/plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to update billing plan");
  return json.data;
}

export async function deactivateBillingPlan(id: number): Promise<void> {
  const res = await authFetch(`${API_URL}/personal/billing/plans/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to deactivate billing plan");
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function fetchStudentSubscription(
  studentId: string
): Promise<StudentSubscription | null> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/subscription`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch subscription");
  return json.data;
}

export async function subscribeStudent(
  studentId: string,
  input: {
    planId: number;
    discountCents?: number;
    studentEmail: string;
    studentName?: string;
  }
): Promise<{ subscription: StudentSubscription; initPoint: string }> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to subscribe student");
  return json.data;
}

export async function cancelStudentSubscription(
  subscriptionId: number
): Promise<StudentSubscription> {
  const res = await authFetch(`${API_URL}/personal/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to cancel subscription");
  return json.data;
}

// ---------------------------------------------------------------------------
// Finance summary
// ---------------------------------------------------------------------------

export async function fetchFinanceSummary(range: "30d" | "90d" | "12m" = "30d"): Promise<FinanceSummary> {
  const res = await authFetch(`${API_URL}/personal/finance/summary?range=${range}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch finance summary");
  return json.data;
}
