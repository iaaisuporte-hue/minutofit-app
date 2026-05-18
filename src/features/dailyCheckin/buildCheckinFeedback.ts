import type { DailyCondition } from "./useDailyCondition";

export function buildCheckinFeedback(condition: DailyCondition): string {
  const details = condition.details;
  const feeling = condition.feeling;

  const inPain = details?.inPain ?? false;
  const sleptWell = details?.sleptWell ?? true;
  const stressed = details?.stressed ?? false;
  const nutritionLevel = details?.nutritionLevel;
  const mentalLoadLevel = details?.mentalLoadLevel;

  const recoverySignals = [
    inPain,
    !sleptWell,
    stressed,
    details?.hydrationOk === false,
    nutritionLevel === "poor",
    mentalLoadLevel === "high",
  ].filter(Boolean).length;

  if (inPain) return "Dor relatada — treino conservador ativado.";
  if (!sleptWell && stressed) return "Sono curto + estresse — leitura em Recuperação.";
  if (nutritionLevel === "poor" && mentalLoadLevel === "high") return "Alimentação fraca + carga mental alta — volume reduzido.";
  if (feeling === "energized" && recoverySignals === 0) return "Sinais positivos — seu corpo aceita carga hoje.";
  if (feeling === "tired") return "Estado de fadiga registrado — leitura em Recuperação.";
  return "Sinais registrados — sua leitura metabólica foi ajustada.";
}
