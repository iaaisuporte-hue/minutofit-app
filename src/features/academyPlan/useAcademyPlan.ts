import { useEffect, useState } from "react";
import { fetchAcademyPlan, type AcademySubscription } from "../../services/academyApi";

const FREE_DEFAULT: AcademySubscription = {
  plan: "free",
  status: "active",
  intelligenceEnabled: false,
  studentCap: null,
  currentPeriodEnd: null,
  trialUntil: null,
};

/** Plano SaaS da academia (Free default enquanto carrega ou em erro). */
export function useAcademyPlan(): { plan: AcademySubscription; loading: boolean } {
  const [plan, setPlan] = useState<AcademySubscription>(FREE_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchAcademyPlan()
      .then((p) => { if (alive) setPlan(p); })
      .catch(() => { if (alive) setPlan(FREE_DEFAULT); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { plan, loading };
}
