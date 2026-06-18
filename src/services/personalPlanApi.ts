import { API_URL } from "./apiBase";
import { authFetch } from "./apiClient";

export type PersonalPlan = "free" | "starter" | "pro";
export type PersonalPlanStatus = "active" | "trial" | "expired" | "cancelled";

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
