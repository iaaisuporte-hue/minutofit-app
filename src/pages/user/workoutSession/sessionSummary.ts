import type { ReadinessLevel } from "../../../services/trainingAdaptiveApi";
import type { DraftExercise } from "./sessionDraft";

// Derivações puras do resumo de sessão (Fases 4 e 5). Sem AI, sem latência,
// sem efeito colateral — heurística TS sobre o que já foi coletado na execução.
// Fase 4: comparação carga hoje × anterior por exercício.
// Fase 5: sinal de fadiga cruzando prontidão (readiness, derivada do check-in
//         pelo backend) com a queda de carga. Linguagem de cuidado, NUNCA médica.

function num(v: string): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type LoadDirection = "up" | "down" | "equal" | "new";

export interface ExerciseDelta {
  exerciseId: string | null;
  name: string;
  prevKg: number | null;
  todayKg: number;
  deltaKg: number | null;
  dir: LoadDirection;
}

export interface SessionComparison {
  items: ExerciseDelta[];
  up: number;
  down: number;
  equal: number;
  /** Há ao menos um exercício com carga registrada hoje e referência anterior. */
  hasReference: boolean;
}

/** Maior carga registrada hoje (entre as séries feitas) por exercício. */
function maxTodayLoad(ex: DraftExercise): number | null {
  let max: number | null = null;
  for (const s of ex.sets) {
    if (!s.done) continue;
    const l = num(s.loadKg);
    if (l != null && (max == null || l > max)) max = l;
  }
  return max;
}

export function computeSessionComparison(
  exercises: DraftExercise[],
  prevLoad: Map<string, number>,
): SessionComparison {
  const items: ExerciseDelta[] = [];
  let up = 0;
  let down = 0;
  let equal = 0;
  let hasReference = false;

  for (const ex of exercises) {
    const todayKg = maxTodayLoad(ex);
    if (todayKg == null) continue; // só compara o que teve carga registrada
    const prevKg = ex.exerciseId ? prevLoad.get(ex.exerciseId) ?? null : null;
    let dir: LoadDirection;
    let deltaKg: number | null = null;
    if (prevKg == null) {
      dir = "new";
    } else {
      hasReference = true;
      deltaKg = Math.round((todayKg - prevKg) * 100) / 100;
      if (todayKg > prevKg) {
        dir = "up";
        up += 1;
      } else if (todayKg < prevKg) {
        dir = "down";
        down += 1;
      } else {
        dir = "equal";
        equal += 1;
      }
    }
    items.push({ exerciseId: ex.exerciseId, name: ex.name, prevKg, todayKg, deltaKg, dir });
  }

  return { items, up, down, equal, hasReference };
}

export type InsightTone = "positive" | "info" | "caution";

export interface FatigueInsight {
  tone: InsightTone;
  headline: string;
  body: string;
}

/**
 * Sinal de fadiga / prontidão — cruza readiness (sono/estresse/carga, derivada
 * do check-in pelo backend) com a queda de carga da sessão. NÃO é diagnóstico:
 * descreve o padrão e sugere atenção à recuperação. Retorna null quando não há
 * sinal relevante (não inventar mensagem por inventar).
 */
export function deriveFatigueInsight(input: {
  readiness: ReadinessLevel | null;
  comparison: SessionComparison;
  status: "completed" | "partial" | "abandoned";
}): FatigueInsight | null {
  const { readiness, comparison, status } = input;
  if (status === "abandoned") return null;

  const lowReadiness = readiness === "yellow" || readiness === "red";
  const dropped = comparison.down;

  // 1. Sinais de cansaço + carga caiu em 2+ exercícios → atenção à recuperação.
  if (lowReadiness && dropped >= 2) {
    return {
      tone: "caution",
      headline: "Seu corpo pediu mais leve hoje",
      body:
        "A carga caiu em alguns exercícios e sua prontidão já vinha mais baixa. " +
        "Isso é esperado — priorize sono e recuperação nos próximos dias que sua força tende a voltar.",
    };
  }

  // 2. Prontidão baixa, mas manteve/segurou a carga → reforço + cuidado.
  if (lowReadiness && dropped < 2) {
    return {
      tone: "info",
      headline: "Você treinou firme mesmo cansado",
      body: "Seus sinais de hoje pediam atenção e você sustentou o treino. Fique de olho na recuperação para manter o ritmo sem acumular fadiga.",
    };
  }

  // 3. Boa prontidão + evolução de carga → consistência reconhecida.
  if (readiness === "green" && comparison.up >= 1) {
    return {
      tone: "positive",
      headline: "Corpo respondendo bem",
      body: "Boa prontidão e carga subindo em pelo menos um exercício. É assim que a evolução acontece: constância com recuperação.",
    };
  }

  // 4. Queda de carga sem sinal claro de prontidão → observação leve.
  if (dropped >= 2 && comparison.hasReference) {
    return {
      tone: "info",
      headline: "Algumas cargas caíram hoje",
      body: "Pode ser só um dia. Se repetir nos próximos treinos, vale rever sono, alimentação e descanso entre as sessões.",
    };
  }

  return null;
}
