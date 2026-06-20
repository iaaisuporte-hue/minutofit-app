import { API_URL } from "./apiBase";
import { authFetch } from "./apiClient";

export type PersonalPlan = "free" | "starter" | "pro";
export type PersonalPlanStatus = "active" | "trial" | "expired" | "cancelled" | "pending";

export interface PersonalPlanConfig {
  plan: PersonalPlan;
  status: PersonalPlanStatus;
  studentLimit: number | null;
  aiEnabled: boolean;
  currentPeriodEnd: string | null;
}

const FREE_DEFAULT: PersonalPlanConfig = {
  plan: "free",
  status: "active",
  studentLimit: 3,
  aiEnabled: false,
  currentPeriodEnd: null,
};

export async function fetchPersonalPlan(): Promise<PersonalPlanConfig> {
  try {
    const res = await authFetch(`${API_URL}/personal/plan`);
    if (!res.ok) return FREE_DEFAULT;
    const json = await res.json();
    return (json.data as PersonalPlanConfig) ?? FREE_DEFAULT;
  } catch {
    return FREE_DEFAULT;
  }
}

/**
 * Inicia o checkout self-serve do plano pago. Retorna a URL do Mercado Pago
 * (init_point) para redirecionar o personal. Lança em caso de falha.
 */
export async function startPersonalCheckout(plan: "pro" | "starter" = "pro"): Promise<string> {
  const res = await authFetch(`${API_URL}/personal/plan/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.initPoint) {
    throw new Error(json?.error || "Não foi possível iniciar o pagamento");
  }
  return json.data.initPoint as string;
}
