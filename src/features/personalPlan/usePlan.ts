import { useEffect, useState } from "react";
import { fetchPersonalPlan, type PersonalPlanConfig } from "../../services/personalPlanApi";

const FREE_DEFAULT: PersonalPlanConfig = {
  plan: "free",
  status: "active",
  studentLimit: 3,
  aiEnabled: false,
  currentPeriodEnd: null,
};

export function usePlan() {
  const [plan, setPlan] = useState<PersonalPlanConfig>(FREE_DEFAULT);

  useEffect(() => {
    fetchPersonalPlan().then(setPlan);
  }, []);

  return plan;
}
