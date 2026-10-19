import { useState } from "react";
import { CheckCircle2, ClipboardList, PencilLine } from "lucide-react";
import type { MealTimelineEntry } from "../../services/nutriApi";
import { registerPlanMealAsPlanned, type IntakeLogRecord } from "../../services/nutritionIntakeApi";

type Meal = Pick<MealTimelineEntry, "id" | "name" | "items" | "totals" | "intakeToday">;

const round = (n: number) => Math.round(n);

/**
 * P0 "Feito → diário" — convite mostrado DEPOIS do "Segui".
 *
 * Adesão e consumo continuam separados: "Segui" já gravou só o check-in;
 * aqui o aluno decide, com um toque, se o que comeu foi o prescrito. Nada é
 * registrado sem essa confirmação e nada é exibido como sucesso antes da
 * resposta do servidor.
 *
 * - Refeição estruturada: prévia com os valores do PRÓPRIO plano (os mesmos
 *   snapshots que o servidor copia) + "Sim, registrar conforme o plano" /
 *   "Comi algo diferente".
 * - Refeição só texto: sem quantidades, nenhum número é presumido — leva ao
 *   registro manual.
 * - Já registrada hoje: não oferece o registro integral de novo; leva à
 *   edição do que já existe. Acréscimos continuam livres no fluxo normal.
 */
export function PlanMealConsumptionPrompt({
  meal,
  onRegistered,
  onOpenIntake,
}: {
  meal: Meal;
  /** Chamado só após o servidor confirmar (inclusive no 409 "já registrado"). */
  onRegistered: (log: IntakeLogRecord) => void;
  /** Abre o fluxo de registro EXISTENTE para esta refeição (ajustar, registrar à mão, ver/editar). */
  onOpenIntake: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredKcal, setRegisteredKcal] = useState<number | null>(meal.intakeToday?.energyKcal ?? null);
  const [justRegistered, setJustRegistered] = useState(false);

  const items = meal.items ?? [];
  const isStructured = items.length > 0;
  const t = meal.totals;
  const hasValues = Boolean(t && t.energyKcal > 0);

  async function confirmAsPlanned() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const { log, alreadyLogged } = await registerPlanMealAsPlanned({ id: meal.id, name: meal.name, itemIds: items.map((i) => i.id) });
      setRegisteredKcal(log.energyKcal);
      setJustRegistered(!alreadyLogged);
      onRegistered(log);
    } catch {
      setError("Não foi possível registrar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (registeredKcal != null) {
    return (
      <div className="planMealPrompt" role="status" aria-live="polite">
        <p className="planMealPrompt__done">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>
            {justRegistered ? "Registrado no seu dia" : "Consumo já registrado hoje"} · {round(registeredKcal)} kcal
          </span>
        </p>
        <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={onOpenIntake}>
          <PencilLine size={14} aria-hidden="true" /> Ver ou editar registro
        </button>
      </div>
    );
  }

  if (!isStructured) {
    return (
      <div className="planMealPrompt">
        <p className="planMealPrompt__question">
          Seu plano não possui quantidades definidas. Registre o que você consumiu para atualizar seu dia nutricional.
        </p>
        <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 44 }} onClick={onOpenIntake}>
          Registrar o que comi
        </button>
      </div>
    );
  }

  return (
    <div className="planMealPrompt">
      <p className="planMealPrompt__question">Você consumiu os alimentos e quantidades previstos no plano?</p>
      <div className="planMealPrompt__preview">
        <ClipboardList size={14} aria-hidden="true" />
        <div>
          <div className="planMealPrompt__items">
            {items.map((i) => `${i.foodName}${i.grams ? ` (${round(i.grams)} g)` : ""}`).join(", ")}
          </div>
          {hasValues && (
            <div className="planMealPrompt__macros">
              {round(t.energyKcal)} kcal · P {round(t.proteinG)} g · C {round(t.carbohydrateG)} g · G {round(t.fatG)} g
            </div>
          )}
        </div>
      </div>
      {error && <div className="field-error" role="alert">{error}</div>}
      <div className="planMealPrompt__actions">
        <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 44 }} disabled={saving} onClick={() => void confirmAsPlanned()}>
          {saving ? "Registrando..." : "Sim, registrar conforme o plano"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} disabled={saving} onClick={onOpenIntake}>
          Comi algo diferente
        </button>
      </div>
    </div>
  );
}
