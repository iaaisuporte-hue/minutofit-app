// ================================================================
// Exercise Rules — catalog of all supported exercises.
// Each rule defines: metadata, angle detection, rep counting,
// and corrective feedback with severity levels.
// ================================================================

import { rankCorrections } from "./movementAnalytics";
import type { Correction, IssueSeverity } from "./movementAnalytics";

export type ExerciseId =
  | "biceps_curl"
  | "squat"
  | "push_up"
  | "lunge"
  | "lateral_raise";

export type ExerciseCategory = "home" | "gym";
export type ExerciseGroup = "upper" | "lower" | "core";
export type Stage = "down" | "up";

export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type AngleResult = {
  left: number | null;
  right: number | null;
};

export type RepParams = {
  avgAngle: number | null;
  leftAngle: number | null;
  rightAngle: number | null;
  stage: Stage;
  lastRepAt: number;
};

export type RepTransition = {
  nextStage: Stage;
  counted: boolean;
};

export type ExerciseRule = {
  id: ExerciseId;
  label: string;
  category: ExerciseCategory;
  group: ExerciseGroup;
  positionHint: string;
  /** Landmark indices to draw angle labels on [left-joint, right-joint] */
  primaryJoints: [number, number];
  metricLabels: {
    left: string;
    right: string;
    stageUp: string;
    stageDown: string;
  };
  detectAngles: (landmarks: PoseLandmark[]) => AngleResult;
  detectRep: (params: RepParams) => RepTransition;
  buildFeedback: (
    landmarks: PoseLandmark[],
    leftAngle: number | null,
    rightAngle: number | null
  ) => Correction[];
};

// ── Shared utilities ─────────────────────────────────────────

export function angleBetween(
  first: PoseLandmark,
  mid: PoseLandmark,
  last: PoseLandmark
): number {
  const radians =
    Math.atan2(last.y - mid.y, last.x - mid.x) -
    Math.atan2(first.y - mid.y, first.x - mid.x);
  let degrees = Math.abs((radians * 180) / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return degrees;
}

export function avgAngles(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => typeof v === "number");
  if (!valid.length) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function safeAngle(
  a: PoseLandmark | undefined,
  b: PoseLandmark | undefined,
  c: PoseLandmark | undefined
): number | null {
  if (!a || !b || !c) return null;
  const deg = angleBetween(a, b, c);
  return Number.isFinite(deg) ? Math.round(deg) : null;
}

function c(message: string, severity: IssueSeverity): Correction {
  return { message, severity };
}

const COOLDOWN_MS = 900;

// ── Biceps Curl ──────────────────────────────────────────────

const biceps_curl: ExerciseRule = {
  id: "biceps_curl",
  label: "Rosca Direta",
  category: "gym",
  group: "upper",
  positionHint:
    "Fique de frente para a câmera com ombros, cotovelos e quadril visíveis.",
  primaryJoints: [13, 14],
  metricLabels: {
    left: "Cotovelo E",
    right: "Cotovelo D",
    stageUp: "Subida",
    stageDown: "Descida",
  },

  detectAngles(landmarks) {
    return {
      left: safeAngle(landmarks[11], landmarks[13], landmarks[15]),
      right: safeAngle(landmarks[12], landmarks[14], landmarks[16]),
    };
  },

  detectRep({ avgAngle, leftAngle, rightAngle, stage, lastRepAt }) {
    const now = Date.now();
    const balanced =
      leftAngle !== null &&
      rightAngle !== null &&
      Math.abs(leftAngle - rightAngle) < 20;
    let nextStage = stage;
    let counted = false;
    if (avgAngle !== null) {
      if (avgAngle > 150 && balanced) nextStage = "down";
      if (
        avgAngle < 55 &&
        balanced &&
        stage === "down" &&
        now - lastRepAt > COOLDOWN_MS
      ) {
        nextStage = "up";
        counted = true;
      }
    }
    return { nextStage, counted };
  },

  buildFeedback(landmarks, leftAngle, rightAngle) {
    const required = [11, 12, 13, 14, 15, 16, 23, 24];
    if (required.some((i) => !landmarks[i])) {
      return [c("Posicione o corpo inteiro dentro da câmera.", "safety")];
    }
    const corrections: Correction[] = [];
    const [ls, rs, le, re, lw, rw, lh, rh] = [
      landmarks[11],
      landmarks[12],
      landmarks[13],
      landmarks[14],
      landmarks[15],
      landmarks[16],
      landmarks[23],
      landmarks[24],
    ];

    const torsoCenterX = (ls.x + rs.x + lh.x + rh.x) / 4;
    const shoulderCenterX = (ls.x + rs.x) / 2;
    if (Math.abs(torsoCenterX - shoulderCenterX) > 0.06) {
      corrections.push(
        c("Evite balançar o tronco durante a rosca.", "technique")
      );
    }
    if (
      Math.abs(le.x - lh.x) > 0.13 ||
      Math.abs(re.x - rh.x) > 0.13
    ) {
      corrections.push(
        c("Mantenha os cotovelos mais próximos do tronco.", "technique")
      );
    }
    if (
      Math.abs(lw.x - le.x) > 0.18 ||
      Math.abs(rw.x - re.x) > 0.18
    ) {
      corrections.push(
        c("Controle o punho — evite abrir demais os braços.", "technique")
      );
    }
    const avg = avgAngles([leftAngle, rightAngle]);
    if (avg !== null && avg > 135) {
      corrections.push(
        c("Suba mais para fechar a rosca completamente.", "amplitude")
      );
    }
    return rankCorrections(corrections);
  },
};

// ── Squat ────────────────────────────────────────────────────

const squat: ExerciseRule = {
  id: "squat",
  label: "Agachamento",
  category: "home",
  group: "lower",
  positionHint:
    "Posicione a câmera para mostrar do tronco aos pés, de lado ou levemente diagonal.",
  primaryJoints: [25, 26],
  metricLabels: {
    left: "Joelho E",
    right: "Joelho D",
    stageUp: "Subida",
    stageDown: "Descida",
  },

  detectAngles(landmarks) {
    return {
      left: safeAngle(landmarks[23], landmarks[25], landmarks[27]),
      right: safeAngle(landmarks[24], landmarks[26], landmarks[28]),
    };
  },

  detectRep({ avgAngle, leftAngle, rightAngle, stage, lastRepAt }) {
    const now = Date.now();
    const balanced =
      leftAngle !== null &&
      rightAngle !== null &&
      Math.abs(leftAngle - rightAngle) < 18;
    let nextStage = stage;
    let counted = false;
    if (avgAngle !== null) {
      if (avgAngle > 155 && balanced) nextStage = "down";
      if (
        avgAngle < 95 &&
        balanced &&
        stage === "down" &&
        now - lastRepAt > COOLDOWN_MS
      ) {
        nextStage = "up";
        counted = true;
      }
    }
    return { nextStage, counted };
  },

  buildFeedback(landmarks, leftAngle, rightAngle) {
    const required = [11, 12, 23, 24, 25, 26, 27, 28];
    if (required.some((i) => !landmarks[i])) {
      return [
        c(
          "Ajuste a câmera para enquadrar quadril, joelhos e tornozelos.",
          "safety"
        ),
      ];
    }
    const corrections: Correction[] = [];
    const [ls, rs, lh, rh, lk, rk, la, ra] = [
      landmarks[11],
      landmarks[12],
      landmarks[23],
      landmarks[24],
      landmarks[25],
      landmarks[26],
      landmarks[27],
      landmarks[28],
    ];

    if (Math.abs(ls.x - lh.x) > 0.14 || Math.abs(rs.x - rh.x) > 0.14) {
      corrections.push(
        c(
          "Evite inclinar demais o tronco — mantenha o peito mais aberto.",
          "technique"
        )
      );
    }
    if (lk.x > la.x + 0.03) {
      corrections.push(
        c(
          "Empurre o joelho esquerdo para fora — evite valgo dinâmico.",
          "safety"
        )
      );
    }
    if (rk.x < ra.x - 0.03) {
      corrections.push(
        c(
          "Empurre o joelho direito para fora — evite valgo dinâmico.",
          "safety"
        )
      );
    }
    const avg = avgAngles([leftAngle, rightAngle]);
    if (avg !== null && avg > 125) {
      corrections.push(
        c("Desça mais para uma amplitude completa.", "amplitude")
      );
    }
    return rankCorrections(corrections);
  },
};

// ── Push-up ──────────────────────────────────────────────────

const push_up: ExerciseRule = {
  id: "push_up",
  label: "Flexão",
  category: "home",
  group: "upper",
  positionHint:
    "Posicione a câmera de lado para mostrar ombros, cotovelos, quadril e pés alinhados.",
  primaryJoints: [13, 14],
  metricLabels: {
    left: "Cotovelo E",
    right: "Cotovelo D",
    stageUp: "Extensão",
    stageDown: "Descida",
  },

  detectAngles(landmarks) {
    return {
      left: safeAngle(landmarks[11], landmarks[13], landmarks[15]),
      right: safeAngle(landmarks[12], landmarks[14], landmarks[16]),
    };
  },

  detectRep({ avgAngle, leftAngle, rightAngle, stage, lastRepAt }) {
    const now = Date.now();
    const balanced =
      leftAngle !== null &&
      rightAngle !== null &&
      Math.abs(leftAngle - rightAngle) < 22;
    let nextStage = stage;
    let counted = false;
    if (avgAngle !== null) {
      if (avgAngle > 155 && balanced) nextStage = "down";
      if (
        avgAngle < 90 &&
        balanced &&
        stage === "down" &&
        now - lastRepAt > COOLDOWN_MS
      ) {
        nextStage = "up";
        counted = true;
      }
    }
    return { nextStage, counted };
  },

  buildFeedback(landmarks, leftAngle, rightAngle) {
    const required = [11, 12, 13, 14, 15, 16, 23, 24, 27, 28];
    if (required.some((i) => !landmarks[i])) {
      return [
        c(
          "Ajuste a câmera para mostrar ombros, cotovelos, quadril e pés.",
          "safety"
        ),
      ];
    }
    const corrections: Correction[] = [];
    const [ls, rs, lh, rh, la, ra] = [
      landmarks[11],
      landmarks[12],
      landmarks[23],
      landmarks[24],
      landmarks[27],
      landmarks[28],
    ];

    const shoulderMidY = (ls.y + rs.y) / 2;
    const ankleMidY = (la.y + ra.y) / 2;
    const hipMidY = (lh.y + rh.y) / 2;
    const expectedHipY = shoulderMidY + (ankleMidY - shoulderMidY) * 0.45;

    if (hipMidY > expectedHipY + 0.08) {
      corrections.push(
        c(
          "Quadril caindo — contraia o core e mantenha o corpo em linha reta.",
          "safety"
        )
      );
    }
    if (hipMidY < expectedHipY - 0.10) {
      corrections.push(
        c(
          "Eleve o quadril — o corpo deve formar uma linha reta.",
          "technique"
        )
      );
    }
    const avg = avgAngles([leftAngle, rightAngle]);
    if (avg !== null && avg > 135) {
      corrections.push(
        c("Desça mais — peito perto do chão para amplitude completa.", "amplitude")
      );
    }
    if (
      leftAngle !== null &&
      rightAngle !== null &&
      Math.abs(leftAngle - rightAngle) > 18
    ) {
      corrections.push(
        c(
          "Cotovelos assimétricos — distribua o peso igualmente nos dois braços.",
          "technique"
        )
      );
    }
    return rankCorrections(corrections);
  },
};

// ── Lunge ────────────────────────────────────────────────────

const lunge: ExerciseRule = {
  id: "lunge",
  label: "Afundo",
  category: "home",
  group: "lower",
  positionHint:
    "Fique de lado para a câmera para mostrar quadril, joelhos e tornozelos claramente.",
  primaryJoints: [25, 26],
  metricLabels: {
    left: "Joelho E",
    right: "Joelho D",
    stageUp: "Extensão",
    stageDown: "Afundo",
  },

  detectAngles(landmarks) {
    return {
      left: safeAngle(landmarks[23], landmarks[25], landmarks[27]),
      right: safeAngle(landmarks[24], landmarks[26], landmarks[28]),
    };
  },

  detectRep({ leftAngle, rightAngle, stage, lastRepAt }) {
    const now = Date.now();
    // Use whichever knee is bending more (the lead leg)
    const minAngle =
      leftAngle !== null && rightAngle !== null
        ? Math.min(leftAngle, rightAngle)
        : leftAngle ?? rightAngle;
    let nextStage = stage;
    let counted = false;
    if (minAngle !== null) {
      if (minAngle > 160) nextStage = "down";
      if (
        minAngle < 100 &&
        stage === "down" &&
        now - lastRepAt > COOLDOWN_MS
      ) {
        nextStage = "up";
        counted = true;
      }
    }
    return { nextStage, counted };
  },

  buildFeedback(landmarks, leftAngle, rightAngle) {
    const required = [11, 12, 23, 24, 25, 26, 27, 28];
    if (required.some((i) => !landmarks[i])) {
      return [
        c(
          "Ajuste a câmera para enquadrar quadril, joelhos e pés.",
          "safety"
        ),
      ];
    }
    const corrections: Correction[] = [];
    const [ls, rs, lh, rh, lk, rk, la, ra] = [
      landmarks[11],
      landmarks[12],
      landmarks[23],
      landmarks[24],
      landmarks[25],
      landmarks[26],
      landmarks[27],
      landmarks[28],
    ];

    if (lk.x > la.x + 0.06) {
      corrections.push(
        c(
          "Joelho esquerdo passando do pé — recue o passo ou encurte a descida.",
          "safety"
        )
      );
    }
    if (rk.x < ra.x - 0.06) {
      corrections.push(
        c(
          "Joelho direito passando do pé — recue o passo ou encurte a descida.",
          "safety"
        )
      );
    }
    const shoulderMidX = (ls.x + rs.x) / 2;
    const hipMidX = (lh.x + rh.x) / 2;
    if (Math.abs(shoulderMidX - hipMidX) > 0.12) {
      corrections.push(
        c("Tronco inclinado — peito mais aberto e coluna neutra.", "technique")
      );
    }
    const minAngle =
      leftAngle !== null && rightAngle !== null
        ? Math.min(leftAngle, rightAngle)
        : avgAngles([leftAngle, rightAngle]);
    if (minAngle !== null && minAngle > 120) {
      corrections.push(
        c("Desça mais no afundo para amplitude completa.", "amplitude")
      );
    }
    return rankCorrections(corrections);
  },
};

// ── Lateral Raise ────────────────────────────────────────────

const lateral_raise: ExerciseRule = {
  id: "lateral_raise",
  label: "Elevação Lateral",
  category: "gym",
  group: "upper",
  positionHint:
    "Fique de frente para a câmera com ombros e cotovelos visíveis.",
  primaryJoints: [11, 12],
  metricLabels: {
    left: "Ombro E",
    right: "Ombro D",
    stageUp: "Elevação",
    stageDown: "Descida",
  },

  detectAngles(landmarks) {
    // Angle at shoulder: hip-shoulder-elbow (arm angle relative to torso)
    return {
      left: safeAngle(landmarks[23], landmarks[11], landmarks[13]),
      right: safeAngle(landmarks[24], landmarks[12], landmarks[14]),
    };
  },

  detectRep({ avgAngle, leftAngle, rightAngle, stage, lastRepAt }) {
    const now = Date.now();
    const balanced =
      leftAngle !== null &&
      rightAngle !== null &&
      Math.abs(leftAngle - rightAngle) < 18;
    let nextStage = stage;
    let counted = false;
    if (avgAngle !== null) {
      if (avgAngle < 40 && balanced) nextStage = "down";
      if (
        avgAngle > 75 &&
        balanced &&
        stage === "down" &&
        now - lastRepAt > COOLDOWN_MS
      ) {
        nextStage = "up";
        counted = true;
      }
    }
    return { nextStage, counted };
  },

  buildFeedback(landmarks, leftAngle, rightAngle) {
    const required = [11, 12, 13, 14, 23, 24];
    if (required.some((i) => !landmarks[i])) {
      return [
        c(
          "Posicione o corpo na câmera com ombros e cotovelos visíveis.",
          "safety"
        ),
      ];
    }
    const corrections: Correction[] = [];
    const [ls, rs, le, re, lh, rh] = [
      landmarks[11],
      landmarks[12],
      landmarks[13],
      landmarks[14],
      landmarks[23],
      landmarks[24],
    ];

    // Arms going above shoulder line
    if (le.y < ls.y - 0.02 || re.y < rs.y - 0.02) {
      corrections.push(
        c(
          "Elevou acima da linha do ombro — desça levemente para proteger o manguito.",
          "amplitude"
        )
      );
    }
    if (
      leftAngle !== null &&
      rightAngle !== null &&
      Math.abs(leftAngle - rightAngle) > 18
    ) {
      corrections.push(
        c("Braços assimétricos — iguale a altura dos dois lados.", "technique")
      );
    }
    const shoulderMidX = (ls.x + rs.x) / 2;
    const hipMidX = (lh.x + rh.x) / 2;
    if (Math.abs(shoulderMidX - hipMidX) > 0.07) {
      corrections.push(
        c(
          "Evite balançar o tronco — use menos peso se necessário.",
          "technique"
        )
      );
    }
    return rankCorrections(corrections);
  },
};

// ── Catalog & grouping ───────────────────────────────────────

export const EXERCISE_CATALOG: Record<ExerciseId, ExerciseRule> = {
  biceps_curl,
  squat,
  push_up,
  lunge,
  lateral_raise,
};

export type ExerciseGroupEntry = {
  category: ExerciseCategory;
  group: ExerciseGroup;
  groupLabel: string;
  exercises: ExerciseId[];
};

export const EXERCISE_GROUPS: ExerciseGroupEntry[] = [
  {
    category: "gym",
    group: "upper",
    groupLabel: "Superior",
    exercises: ["biceps_curl", "lateral_raise"],
  },
  {
    category: "home",
    group: "upper",
    groupLabel: "Superior",
    exercises: ["push_up"],
  },
  {
    category: "home",
    group: "lower",
    groupLabel: "Inferior",
    exercises: ["squat", "lunge"],
  },
];
