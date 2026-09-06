import type { MetabolicGoal, WorkoutRelation, DietAlert, MealItemPayload } from "../../../services/nutriApi";

/**
 * SPEC 035 / §7: consentimento revogado não pode ser renderizado como "sem
 * dado" — o paciente revogou um direito, e a nutri precisa saber disso, não
 * concluir que nunca existiu plano/observação/nota.
 */
export function ConsentRevokedNotice() {
  return (
    <div className="card cardPad alert" style={{ fontStyle: "italic" }}>
      O paciente revogou o acesso a esta informação. Fale com ele para restabelecer o compartilhamento.
    </div>
  );
}

export function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("pt-BR");
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export const ALERT_KIND_LABEL: Record<DietAlert["kind"], string> = {
  allergy: "Alergia", intolerance: "Intolerância", restriction: "Restrição",
  preference: "Preferência", clinical_condition: "Condição clínica", medication: "Medicamento",
};

// SPEC 036 / §41-42: mesmo mapa de classe usado no builder (CreatePlanPage) —
// os três níveis "strong/moderate/info" viram os MESMOS `.alert-*` em
// qualquer tela que exiba um DietAlert.
export const ALERT_LEVEL_CLASS: Record<DietAlert["level"], string> = {
  strong: "alert alert-danger",
  moderate: "alert alert-warn",
  info: "alert alert-info",
  suggestion: "alert",
};

/**
 * SPEC 035 / P1A.1: identidade da refeição já existente. Preservar e ecoar
 * de volta no PATCH é o que impede o backend de tratar uma edição de título
 * como "apagar tudo e recriar" — sem isso, todo o histórico de check-in
 * daquela refeição vira órfão a cada salvamento.
 */
export type EditDraftMeal = {
  id?: number;
  name: string;
  orientation: string;
  meal_time: string;
  order_index: number;
  // Campos que a tela de edição não expõe para digitação, mas que precisam
  // sobreviver ao round-trip do PATCH intocados — perdê-los aqui era a outra
  // metade do BLOCKER NUTRI-01 (a edição de título zerava objetivo
  // metabólico, hidratação, suplemento e as alternativas da criação).
  tolerance_minutes: number | null;
  reminder_minutes: number | null;
  metabolic_goal: MetabolicGoal | null;
  workout_relation: WorkoutRelation | null;
  hydration_note: string | null;
  supplement_note: string | null;
  alternatives: Array<{ id?: number; description: string; order_index: number }>;
  /**
   * SPEC 038 (P3A): mesma regra acima, agora para itens estruturados — a
   * tela de edição do Plano ainda não expõe adicionar/remover alimento
   * (isso vive no builder), mas precisa ECOAR os itens existentes de volta
   * no PATCH. Sem isso, `reconcileMealItems` trata `items` ausente como
   * "lista vazia enviada" e soft-deleta TODO item estruturado só porque o
   * nutri editou o título do plano — a mesmíssima classe do BLOCKER NUTRI-01,
   * desta vez em cima da fundação da P3A.
   */
  items: MealItemPayload[];
};

export type EditDraft = {
  title: string;
  objective: import("../../../services/nutriApi").NutriObjective;
  general_notes: string;
  meals: EditDraftMeal[];
};
