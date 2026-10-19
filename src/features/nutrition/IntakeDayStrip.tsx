import { ClipboardList, Calculator } from "lucide-react";
import { COLORS } from "../../styles/colors";
import type { NutrientTotals, ResolvedNutritionTarget } from "../../services/nutritionIntakeApi";

/**
 * Faixa "Hoje: 1.240 / 2.100 kcal · P 82/150 g" — repete o selo da fonte da
 * meta (PLAN §3: "Meta do plano" e "Estimativa própria" nunca se confundem,
 * nem aqui). Sem meta resolvida, mostra só os totais registrados.
 */
const per = (value: number | null | undefined) => (value == null ? "" : `/${Math.round(value)}`);

export function IntakeDayStrip({ totals, target }: { totals: NutrientTotals; target: ResolvedNutritionTarget | null }) {
  // Spec 039: meta do nutri e meta do plano são ambas prescrição (selo de marca).
  const isPlan = target?.source === "plan_items" || target?.source === "nutri_goal";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: COLORS.text }}>
        <span>
          Hoje: {Math.round(totals.energyKcal)}
          {target ? ` / ${Math.round(target.energyKcal)}` : ""} kcal
        </span>
        {target && (
          <span
            className={`badge ${isPlan ? "badge-brand" : "badge-neutral"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10 }}
          >
            {isPlan ? <ClipboardList size={10} /> : <Calculator size={10} />}
            {target.source === "nutri_goal" ? "vs meta do nutri" : isPlan ? "vs meta do plano" : "vs sua estimativa"}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted }}>
        P {Math.round(totals.proteinG)}
        {per(target?.proteinG)} g · C {Math.round(totals.carbohydrateG)}
        {per(target?.carbohydrateG)} g · G {Math.round(totals.fatG)}
        {per(target?.fatG)} g
      </div>
    </div>
  );
}
