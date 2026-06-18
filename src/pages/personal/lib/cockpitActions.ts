import type { PersonalStudentSnapshot } from "../../../services/personalDashboardApi";

export type CockpitTabId = "today" | "week" | "technical" | "relationship" | "ia_summary";

export type CockpitSuggestion = {
  message: string;
  tab: CockpitTabId;
};

/**
 * Regras simples (sem ML) para sugerir a próxima ação do personal no cockpit do aluno.
 */
export function suggestCockpitAction(snapshot: PersonalStudentSnapshot): CockpitSuggestion | null {
  if (snapshot.today.wellbeing?.inPain === true) {
    return {
      message:
        "Check-in indica dor — registre uma nota de dor na aba Técnica para manter histórico clínico.",
      tab: "technical",
    };
  }

  if (snapshot.today.metabolism?.trend === "down") {
    return {
      message:
        "Metabolismo em queda — revise carga e recuperação; registre observações na aba Técnica.",
      tab: "technical",
    };
  }

  const lastWorkoutAt = snapshot.today.latestWorkout?.completedAt;
  const daysSinceWorkout = lastWorkoutAt
    ? Math.floor((Date.now() - new Date(lastWorkoutAt).getTime()) / 86400000)
    : 999;

  if (daysSinceWorkout >= 7) {
    return {
      message:
        "Sem treino registrado há 7+ dias — envie uma mensagem curta ou documente contexto na aba Técnica.",
      tab: "technical",
    };
  }

  return null;
}
