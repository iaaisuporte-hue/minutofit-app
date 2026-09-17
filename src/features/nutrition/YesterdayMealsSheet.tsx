import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import { IntakeLogSheet } from "./IntakeLogSheet";
import { IntakeLogDetailSheet } from "./IntakeLogDetailSheet";
import { getDayIntake, type NutritionIntakeMeal } from "../../services/nutritionIntakeApi";
import { dayKey } from "../../lib/appDay";

/** Aritmética pura de calendário (Date.UTC sobre y/m/d) — mesma técnica do `shiftDayKey` do backend; ontem nunca depende de fuso na subtração. */
function yesterdayKey(): string {
  const [y, m, d] = dayKey().split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * "Corrigir refeição de ontem" (PLAN P1B corrective §16) — correção
 * secundária, discreta, nunca misturada com "hoje". Reusa os MESMOS
 * `IntakeLogDetailSheet`/`IntakeLogSheet` do dia atual, só que apontando
 * para a data de ontem — nenhum editor/detalhe paralelo. Ontem ainda está
 * dentro da janela de edição do backend (hoje + ontem); anteontem em diante
 * nem chega a ter esta entrada (o aluno nunca vê um seletor de data livre).
 */
export function YesterdayMealsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [meals, setMeals] = useState<NutritionIntakeMeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailMeal, setDetailMeal] = useState<NutritionIntakeMeal | null>(null);
  const [editingMeal, setEditingMeal] = useState<NutritionIntakeMeal | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  function load() {
    setLoading(true);
    getDayIntake(yesterdayKey())
      .then((data) => setMeals(data.meals ?? []))
      .catch(() => setMeals([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <>
      <DrawerShell open={open} onClose={onClose} ariaLabel="Refeições de ontem">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Refeições de ontem</div>

          {loading && <div className="muted" style={{ fontSize: 13 }}>Carregando...</div>}

          {!loading && meals.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>Nenhuma refeição registrada ontem.</div>
          )}

          {!loading && meals.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {meals.map((meal) => (
                <button
                  key={meal.groupKey}
                  type="button"
                  onClick={() => setDetailMeal(meal)}
                  className="hit-target-44"
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                    padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
                    background: "var(--color-surface-raised)", cursor: "pointer",
                  }}
                >
                  <span className="muted" style={{ fontSize: 12, flexShrink: 0 }}>
                    {new Date(meal.loggedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{ minWidth: 0, flex: 1, fontSize: 13, fontWeight: 600, color: COLORS.text }}>{meal.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, flexShrink: 0 }}>{Math.round(meal.energyKcal)} kcal</span>
                  <ChevronRight size={16} className="muted" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </DrawerShell>

      <IntakeLogDetailSheet
        meal={detailMeal}
        open={detailMeal != null}
        onClose={() => setDetailMeal(null)}
        onEdit={() => {
          setEditingMeal(detailMeal);
          setDetailMeal(null);
          setEditOpen(true);
        }}
        onDeleted={() => {
          setDetailMeal(null);
          load();
        }}
      />
      <IntakeLogSheet
        open={editOpen}
        editingMeal={editingMeal}
        onClose={() => {
          setEditOpen(false);
          setEditingMeal(null);
        }}
        onSaved={() => {
          setEditOpen(false);
          setEditingMeal(null);
          load();
        }}
      />
    </>
  );
}
