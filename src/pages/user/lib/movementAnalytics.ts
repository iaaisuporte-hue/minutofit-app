// ================================================================
// Movement Analytics — pure functions, zero React imports.
// Called from MovementLabPage on every frame and on rep completion.
// ================================================================

export type ScoreTone = "low" | "mid" | "high";
export type IssueSeverity = "safety" | "amplitude" | "technique";

export type Correction = {
  message: string;
  severity: IssueSeverity;
};

export type ROMResult = {
  min: number;
  max: number;
  amplitude: number;
};

// ── Score classification ─────────────────────────────────────

export function scoreToTone(score: number): ScoreTone {
  if (score >= 80) return "high";
  if (score >= 60) return "mid";
  return "low";
}

// ── Symmetry (0–100) based on L/R angle difference ───────────

export function computeSymmetry(
  left: number | null,
  right: number | null
): number {
  if (left === null || right === null) return 0;
  const diff = Math.abs(left - right);
  return Math.max(0, Math.round(100 - diff * 2));
}

// ── Range of motion from angle history ───────────────────────

export function computeROM(angles: number[]): ROMResult {
  if (!angles.length) return { min: 0, max: 0, amplitude: 0 };
  const min = Math.min(...angles);
  const max = Math.max(...angles);
  return { min, max, amplitude: max - min };
}

// ── Form Score (0–100) from corrections + confidence ─────────
// Corrections are already ranked by severity. Score starts at 100
// and is reduced by each issue found. Confidence caps the maximum.

export function computeFormScore(params: {
  corrections: Correction[];
  leftAngle: number | null;
  rightAngle: number | null;
  confidence: "low" | "medium" | "high";
}): number {
  if (params.confidence === "low") return 0;

  const { corrections, leftAngle, rightAngle, confidence } = params;

  const hasSafety = corrections.some((c) => c.severity === "safety");
  const hasAmplitude = corrections.some((c) => c.severity === "amplitude");
  const techniqueCount = corrections.filter((c) => c.severity === "technique").length;
  const hasNoIssues = corrections.length === 0;

  let score = 100;

  if (hasSafety) score -= 35;
  if (hasAmplitude) score -= 20;
  score -= techniqueCount * 10;

  if (leftAngle !== null && rightAngle !== null) {
    const asymmetry = Math.abs(leftAngle - rightAngle);
    if (asymmetry > 20) score -= 15;
    else if (asymmetry > 10) score -= 7;
  }

  if (confidence === "medium") score = Math.min(score, 80);

  // When truly clean, guarantee a decent floor
  if (hasNoIssues && confidence === "high") score = Math.max(score, 82);

  return Math.max(0, Math.min(100, score));
}

// ── Correction ranking: safety first ─────────────────────────

export function rankCorrections(corrections: Correction[]): Correction[] {
  const order: Record<IssueSeverity, number> = {
    safety: 0,
    amplitude: 1,
    technique: 2,
  };
  return [...corrections].sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── Post-session insight text ─────────────────────────────────

export function generateInsight(params: {
  repScores: number[];
  avgFormScore: number;
  avgSymmetry: number;
  exerciseLabel: string;
}): string {
  const { repScores, avgFormScore, avgSymmetry, exerciseLabel } = params;

  if (repScores.length >= 4) {
    const half = Math.ceil(repScores.length / 2);
    const firstAvg =
      repScores.slice(0, half).reduce((s, v) => s + v, 0) / half;
    const secondAvg =
      repScores.slice(half).reduce((s, v) => s + v, 0) /
      (repScores.length - half);
    if (secondAvg < firstAvg * 0.82) {
      return `Form caiu ${Math.round(firstAvg - secondAvg)} pts nas últimas reps — sinal de fadiga. Reduza carga ou descanse antes de continuar.`;
    }
  }

  if (avgSymmetry < 70) {
    return `Assimetria elevada (${avgSymmetry}%) — foque em equilibrar os dois lados na próxima série.`;
  }

  if (avgFormScore >= 88) {
    return `Execução consistente em ${exerciseLabel}. Pronto para aumentar carga ou volume.`;
  }

  if (avgFormScore >= 72) {
    return `Boa série. Trabalhe a amplitude completa para subir o Form Score.`;
  }

  return `Continue praticando para consolidar a técnica em ${exerciseLabel}.`;
}
