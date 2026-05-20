import type { MessageTemplate } from "../../services/personalRetentionApi";
import type { PersonalDashboardEngagementStatus } from "../../services/personalDashboardApi";

// Maps each engagement state to preferred template categories, in priority order.
const CATEGORY_PRIORITY: Record<PersonalDashboardEngagementStatus, string[]> = {
  at_risk:   ["aluno_ausente_amigavel", "retorno_progressivo", "convite_check_in"],
  fading:    ["aluno_ausente_amigavel", "convite_check_in", "treino_regenerativo"],
  attention: ["convite_check_in", "treino_regenerativo", "oferta_bonus_leve"],
  on_track:  ["oferta_bonus_leve", "convite_check_in", "parabens_consistencia"],
  evolving:  ["parabens_consistencia", "oferta_bonus_leve", "convite_check_in"],
};

export function useSuggestedTemplates(
  templates: MessageTemplate[],
  engagementStatus: PersonalDashboardEngagementStatus | null | undefined
): { suggested: MessageTemplate[]; rest: MessageTemplate[] } {
  if (!engagementStatus || templates.length === 0) {
    return { suggested: [], rest: templates };
  }
  const preferred = CATEGORY_PRIORITY[engagementStatus] ?? [];
  const suggested = preferred
    .map((cat) => templates.find((t) => t.category === cat))
    .filter((t): t is MessageTemplate => t !== undefined)
    .slice(0, 3);
  const suggestedIds = new Set(suggested.map((t) => t.id));
  const rest = templates.filter((t) => !suggestedIds.has(t.id));
  return { suggested, rest };
}
