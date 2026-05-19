import { useMemo } from "react";
import type { TechniqueReadiness } from "./technique.types";

export type TechniqueReadinessSignals = {
  riskScore?: number | null;
  sleptWell?: boolean | null;
  inPain?: boolean | null;
  metabolismDelta7d?: number | null;
  studentFirstName?: string | null;
};

const NEUTRAL: TechniqueReadiness = {
  level: "green",
  message: null,
  signals: [],
};

export function computeTechniqueReadiness(
  signals: TechniqueReadinessSignals | null | undefined
): TechniqueReadiness {
  if (!signals) return NEUTRAL;

  const reasons: string[] = [];
  let level: TechniqueReadiness["level"] = "green";

  if (signals.inPain === true) {
    level = "red";
    reasons.push("dor relatada");
  }
  if (typeof signals.riskScore === "number" && signals.riskScore >= 70) {
    level = "red";
    reasons.push(`risco ${Math.round(signals.riskScore)}/100`);
  }

  if (level !== "red") {
    if (signals.sleptWell === false) {
      level = "yellow";
      reasons.push("sono ruim");
    }
    if (typeof signals.riskScore === "number" && signals.riskScore >= 50) {
      level = "yellow";
      reasons.push(`risco ${Math.round(signals.riskScore)}/100`);
    }
    if (typeof signals.metabolismDelta7d === "number" && signals.metabolismDelta7d <= -15) {
      level = "yellow";
      reasons.push(`metabolismo ${signals.metabolismDelta7d}`);
    }
  }

  if (level === "green") return NEUTRAL;

  const who = signals.studentFirstName?.trim() || "o aluno";
  const reasonText = reasons.join(" · ");
  const message =
    level === "red"
      ? `Não recomendado agora — ${who} apresenta ${reasonText}.`
      : `${capitalize(who)}: ${reasonText}. Técnicas avançadas elevam fadiga — avalie manter.`;

  return { level, message, signals: reasons };
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function useTechniqueReadiness(
  signals: TechniqueReadinessSignals | null | undefined
): TechniqueReadiness {
  return useMemo(() => computeTechniqueReadiness(signals), [signals]);
}
