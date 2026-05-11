import type {
  PersonalDashboardResponse,
  PersonalDashboardStudent,
} from "../../../services/personalDashboardApi";

export type StudentNarrativeTone = "positive" | "neutral" | "watch" | "risk";

export type StudentNarrative = {
  studentId: string;
  studentName: string;
  tone: StudentNarrativeTone;
  headline: string;
};

function daysSinceISO(iso: string | null): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

export function buildStudentNarrative(student: PersonalDashboardStudent): StudentNarrative {
  const daysSinceWorkout = daysSinceISO(student.lastWorkoutISO);
  const daysSinceCheckin = daysSinceISO(student.lastCheckinISO);

  if (
    student.metabolismScore !== null &&
    student.metabolismDelta7d !== null &&
    student.metabolismDelta7d <= -15
  ) {
    return {
      studentId: student.id,
      studentName: student.name,
      tone: "risk",
      headline: `Score metabólico em queda — caiu ${Math.abs(
        student.metabolismDelta7d
      )} ponto(s) na última semana.`,
    };
  }

  if (
    student.metabolismScore !== null &&
    student.metabolismScore < 55 &&
    student.workouts7d >= 5
  ) {
    return {
      studentId: student.id,
      studentName: student.name,
      tone: "watch",
      headline: `Volume alto com recuperação baixa — ${student.workouts7d} treinos e score em ${student.metabolismScore}.`,
    };
  }

  if (student.engagementStatus === "at_risk" || daysSinceCheckin >= 10) {
    return {
      studentId: student.id,
      studentName: student.name,
      tone: "risk",
      headline: `Sumiu há ${Math.min(daysSinceWorkout, daysSinceCheckin)} dias — janela curta para reengajar.`,
    };
  }

  if (student.engagementStatus === "fading" || daysSinceWorkout >= 5) {
    return {
      studentId: student.id,
      studentName: student.name,
      tone: "watch",
      headline: "Reduziu frequência nas últimas semanas — vale uma mensagem curta.",
    };
  }

  if (student.engagementStatus === "attention" || student.adherencePct < 45) {
    return {
      studentId: student.id,
      studentName: student.name,
      tone: "watch",
      headline: `Aderência em ${student.adherencePct}% — ajustar treino pode reengajar.`,
    };
  }

  if (
    student.engagementStatus === "evolving" ||
    (student.streakDays >= 7 && student.adherencePct >= 80)
  ) {
    return {
      studentId: student.id,
      studentName: student.name,
      tone: "positive",
      headline: `Em boa fase — streak de ${student.streakDays} dias com aderência em ${student.adherencePct}%.`,
    };
  }

  return {
    studentId: student.id,
    studentName: student.name,
    tone: "neutral",
    headline: `No ritmo — ${student.workouts7d} treino(s) esta semana.`,
  };
}

const TONE_RANK: Record<StudentNarrativeTone, number> = {
  risk: 0,
  watch: 1,
  neutral: 2,
  positive: 3,
};

export function buildAttentionList(
  students: PersonalDashboardStudent[],
  limit = 5
): StudentNarrative[] {
  return students
    .map(buildStudentNarrative)
    .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone])
    .slice(0, limit);
}

function pluralize(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

export function buildPortfolioHeadline(
  summary: PersonalDashboardResponse["summary"],
  students: PersonalDashboardStudent[]
): string {
  if (students.length === 0) {
    return "Sua carteira ainda está vazia.";
  }

  const evolving = students.filter((s) => s.engagementStatus === "evolving").length;
  const dist = summary.metabolismDistribution;
  const lowMetabolism = dist?.low ?? 0;

  if (lowMetabolism >= 3) {
    return `Cluster de fadiga: ${lowMetabolism} alunos com score metabólico baixo hoje.`;
  }

  if (summary.criticalCount >= 1) {
    const c = summary.criticalCount;
    return `${c} ${pluralize(c, "aluno em risco crítico", "alunos em risco crítico")} — priorize contato.`;
  }

  if (summary.alertCount >= 2) {
    return `${summary.alertCount} alunos pedem atenção, ${evolving} ${pluralize(
      evolving,
      "está evoluindo",
      "estão evoluindo"
    )}.`;
  }

  if (evolving >= 2) {
    return `Carteira em boa fase: ${evolving} alunos evoluindo, ${summary.okCount} no ritmo.`;
  }

  return "Carteira em equilíbrio — sem alertas críticos hoje.";
}
