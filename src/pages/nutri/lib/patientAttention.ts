import { dayKey } from "../../../lib/appDay";
import type { PatientSummary } from "../../../services/nutriApi";

/**
 * SPEC 037 / P2.1-P2.2: única fonte de "motivo de atenção" do módulo Nutri.
 * Deriva tudo de campos que a Truth Layer da SPEC 035 já calcula
 * (`riskFlag`, `adherenceDropFlag`, `adherenceState`, `lastCheckinDate`,
 * `mealAdherence7dPct`) — nenhum score/IA novo, nenhuma fórmula paralela.
 * Home "Hoje" e Carteira consomem esta MESMA função para nunca divergir.
 */

export type AttentionLevel =
  | "consent-revoked"
  | "no-plan"
  | "attention"
  | "drop"
  | "calibrating"
  | "stable";

export interface PatientAttention {
  level: AttentionLevel;
  /** Curto, para badge/chip. */
  label: string;
  /** Motivo real, para não deixar o badge genérico ("ATENÇÃO" sem explicar). */
  detail: string;
  /** true quando merece aparecer na lista de atenção da Home. */
  needsAttention: boolean;
}

function daysSinceLabel(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

/**
 * Diferença em dias de CALENDÁRIO entre duas chaves "YYYY-MM-DD" — nunca em
 * milissegundos de relógio. `Date.now() - new Date(dateKey+"T12:00")` parecia
 * certo mas dava -1 dia sempre que a checagem rodasse antes do meio-dia no
 * fuso do navegador (o check-in de HOJE ficava "no futuro" em relação a
 * agora). Ancorar nos componentes Y/M/D via `Date.UTC` remove a hora do
 * relógio da conta inteira.
 */
function dayKeyDiff(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = toKey.slice(0, 10).split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

export function derivePatientAttention(p: PatientSummary): PatientAttention {
  if (p.consentRevoked) {
    return {
      level: "consent-revoked",
      label: "Acesso revogado",
      detail: "O paciente revogou o compartilhamento de dados.",
      needsAttention: true,
    };
  }

  if (!p.activePlan) {
    return {
      level: "no-plan",
      label: "Sem plano",
      detail: "Nenhum plano alimentar ativo.",
      needsAttention: true,
    };
  }

  const daysSince = p.lastCheckinDate ? dayKeyDiff(p.lastCheckinDate, dayKey()) : null;

  const calibrating = p.adherenceState === "calibrating";

  if (!calibrating && p.riskFlag) {
    if (daysSince === null) {
      return {
        level: "attention",
        label: "Sem registro",
        detail: "Nenhum check-in registrado ainda.",
        needsAttention: true,
      };
    }
    if (daysSince > 3) {
      return {
        level: "attention",
        label: "Sem atividade",
        detail: `Sem atividade ${daysSinceLabel(daysSince)}.`,
        needsAttention: true,
      };
    }
    if (p.mealAdherence7dPct != null && p.mealAdherence7dPct < 40) {
      return {
        level: "attention",
        label: "Adesão baixa",
        detail: `Adesão de ${p.mealAdherence7dPct}% nos últimos 7 dias.`,
        needsAttention: true,
      };
    }
  }

  if (!calibrating && p.adherenceDropFlag) {
    return {
      level: "drop",
      label: "Em queda",
      detail: "Tendência de adesão em queda nos últimos dias.",
      needsAttention: true,
    };
  }

  if (calibrating) {
    return {
      level: "calibrating",
      label: "Calibrando",
      detail: "Plano recente — ainda sem dias suficientes para um percentual confiável.",
      needsAttention: false,
    };
  }

  return {
    level: "stable",
    label: "Estável",
    detail: daysSince != null
      ? `Último check-in ${daysSinceLabel(daysSince)}.`
      : "Sem sinais de atenção no momento.",
    needsAttention: false,
  };
}

const LEVEL_PRIORITY: Record<AttentionLevel, number> = {
  "consent-revoked": 0,
  "no-plan": 1,
  attention: 2,
  drop: 3,
  calibrating: 4,
  stable: 5,
};

/** Ordena por prioridade (SPEC 037 §10): risco > queda > ausência > calibrando > estável. */
export function sortByPriority(patients: PatientSummary[]): Array<PatientSummary & { attention: PatientAttention }> {
  return patients
    .map((p) => ({ ...p, attention: derivePatientAttention(p) }))
    .sort((a, b) => LEVEL_PRIORITY[a.attention.level] - LEVEL_PRIORITY[b.attention.level]);
}
