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

// `null` = sem essa data (nunca treinou / nunca fez check-in). Nunca usar um
// número-sentinela aqui: virou texto ("Sumiu há 999 dias") quando propagado
// sem querer, e "sem dado" não é o mesmo estado que "sumiu há muito tempo" —
// o backend já resolve essa distinção via `riskScore`/`engagementStatus`
// (carência de onboarding), que este arquivo precisa respeitar, não pisar.
function daysSinceISO(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

export function buildStudentNarrative(student: PersonalDashboardStudent): StudentNarrative {
  const daysSinceWorkout = daysSinceISO(student.lastWorkoutISO);
  const daysSinceCheckin = daysSinceISO(student.lastCheckinISO);

  // Carência de onboarding (ver doc de `riskScore` no tipo canônico): aluno
  // recém-vinculado, sem sinal nenhum ainda. Não é "no ritmo" (não há ritmo
  // pra medir) nem risco — é um terceiro estado, neutro.
  if (student.riskScore === null && student.workouts7d === 0) {
    return {
      studentId: student.id,
      studentName: student.name,
      tone: "neutral",
      headline: "Aguardando o primeiro treino ou check-in.",
    };
  }

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

  if (student.engagementStatus === "at_risk" || (daysSinceCheckin !== null && daysSinceCheckin >= 10)) {
    const gapDays = Math.min(daysSinceWorkout ?? Infinity, daysSinceCheckin ?? Infinity);
    return {
      studentId: student.id,
      studentName: student.name,
      tone: "risk",
      headline: Number.isFinite(gapDays)
        ? `Sumiu há ${gapDays} dias — janela curta para reengajar.`
        : "Ainda não treinou nem fez check-in — vale um primeiro contato.",
    };
  }

  if (student.engagementStatus === "fading" || (daysSinceWorkout !== null && daysSinceWorkout >= 5)) {
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
      headline: `Frequência em ${student.adherencePct}% da meta do mês — ajustar treino pode reengajar.`,
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
      headline: `Em boa fase — streak de ${student.streakDays} dias com frequência em ${student.adherencePct}%.`,
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

  // Deriva os contadores de `engagementStatus`, a mesma fonte que os chips do
  // dashboard ("Atenção"/"Risco") e a tela Alunos ("EM RISCO") já usam. Antes
  // esta manchete lia `summary.criticalCount`/`alertCount` — contadores do
  // backend derivados de `risk`, um critério DIFERENTE (sem a carência de
  // vínculo novo que `engagementStatus` tem) — e podia anunciar "1 aluno em
  // risco crítico" na mesma tela em que os chips diziam "Risco (0)" (QA
  // 04/set/2026: aluno com 1 dia de vínculo e zero treino na semana).
  const evolving = students.filter((s) => s.engagementStatus === "evolving").length;
  const onTrack = students.filter((s) => s.engagementStatus === "on_track").length;
  const attention = students.filter((s) => s.engagementStatus === "attention").length;
  const atRisk =
    students.filter((s) => s.engagementStatus === "fading" || s.engagementStatus === "at_risk").length;
  const dist = summary.metabolismDistribution;
  const lowMetabolism = dist?.low ?? 0;

  if (lowMetabolism >= 3) {
    return `Cluster de fadiga: ${lowMetabolism} alunos com score metabólico baixo hoje.`;
  }

  if (atRisk >= 1) {
    return `${atRisk} ${pluralize(atRisk, "aluno em risco", "alunos em risco")} — priorize contato.`;
  }

  if (attention >= 2) {
    return `${attention} alunos pedem atenção, ${evolving} ${pluralize(
      evolving,
      "está evoluindo",
      "estão evoluindo"
    )}.`;
  }

  if (evolving >= 2) {
    return `Carteira em boa fase: ${evolving} alunos evoluindo, ${onTrack} no ritmo.`;
  }

  return "Carteira em equilíbrio — sem alertas críticos hoje.";
}
