import { useMemo } from "react";
import type { PersonalDashboardResponse, PersonalDashboardStudent } from "../../services/personalDashboardApi";

export function useAtRiskStudents(
  dashboard: PersonalDashboardResponse | null
): PersonalDashboardStudent[] {
  return useMemo(() => {
    if (!dashboard) return [];
    return dashboard.summary.atRiskTop ?? [];
  }, [dashboard]);
}
