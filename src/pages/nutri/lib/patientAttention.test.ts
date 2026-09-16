import { describe, it, expect } from "vitest";
import { derivePatientAttention, sortByPriority } from "./patientAttention";
import type { PatientSummary } from "../../../services/nutriApi";

function makePatient(overrides: Partial<PatientSummary>): PatientSummary {
  return {
    id: 1,
    name: "Paciente Teste",
    email: "teste@example.com",
    photo_url: null,
    academy_id: null,
    activePlan: { plan_id: 1, title: "Plano", started_at: new Date().toISOString() },
    adherence7d: 0,
    adherence30d: 0,
    mealAdherence7dPct: 80,
    mealAdherence30dPct: 80,
    lastCheckinDate: new Date().toISOString().slice(0, 10),
    riskFlag: false,
    adherenceDropFlag: false,
    adherenceState: "ready",
    streakDays: 3,
    trend: "stable",
    consentRevoked: false,
    intake: null,
    ...overrides,
  };
}

describe("derivePatientAttention", () => {
  it("prioriza consent-revoked mesmo com outros campos zerados", () => {
    const r = derivePatientAttention(makePatient({ consentRevoked: true, activePlan: null }));
    expect(r.level).toBe("consent-revoked");
    expect(r.needsAttention).toBe(true);
  });

  it("sinaliza sem plano ativo", () => {
    const r = derivePatientAttention(makePatient({ activePlan: null }));
    expect(r.level).toBe("no-plan");
  });

  it("sinaliza ausência de check-in > 3 dias como atenção, com motivo real", () => {
    const oldDate = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const r = derivePatientAttention(
      makePatient({ riskFlag: true, adherenceState: "ready", lastCheckinDate: oldDate }),
    );
    expect(r.level).toBe("attention");
    expect(r.detail).toMatch(/há \d+ dias/);
  });

  it("nunca marca 'attention' por ausência/baixa adesão enquanto calibrando", () => {
    const r = derivePatientAttention(
      makePatient({ riskFlag: true, adherenceState: "calibrating", lastCheckinDate: null, mealAdherence7dPct: 10 }),
    );
    expect(r.level).toBe("calibrating");
    expect(r.needsAttention).toBe(false);
  });

  it("sinaliza adesão baixa (<40%) como atenção quando não calibrando e atividade recente", () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = derivePatientAttention(
      makePatient({ riskFlag: true, adherenceState: "ready", lastCheckinDate: today, mealAdherence7dPct: 25 }),
    );
    expect(r.level).toBe("attention");
    expect(r.detail).toMatch(/25%/);
  });

  it("sinaliza tendência de queda (adherenceDropFlag) quando não há risco de ausência", () => {
    const r = derivePatientAttention(makePatient({ adherenceDropFlag: true, trend: "down" }));
    expect(r.level).toBe("drop");
  });

  it("PLAN_NUTRITION_QUICK_MACROS: sinaliza exceção de ingestão como 'attention', reusando o level existente (sem AttentionLevel novo)", () => {
    const r = derivePatientAttention(
      makePatient({
        intake: {
          state: "ready", daysLogged7d: 5, highCoverageDays7d: 4,
          avgKcal7d: 1800, avgProteinG7d: 90, avgCarbG7d: 200, avgFatG7d: 60,
          target: { kcal: 2100, p: 150, c: 210, f: 70, source: "plan_items" },
          kcalTrend: "stable",
          exception: { type: "intake_protein_low", detail: "Proteína média 90 g vs meta 150 g" },
        },
      }),
    );
    expect(r.level).toBe("attention");
    expect(r.label).toBe("Ingestão");
    expect(r.detail).toBe("Proteína média 90 g vs meta 150 g");
  });

  it("exceção de ingestão NUNCA sobrepõe risco de ausência (risco vence)", () => {
    const oldDate = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const r = derivePatientAttention(
      makePatient({
        riskFlag: true, lastCheckinDate: oldDate,
        intake: {
          state: "ready", daysLogged7d: 5, highCoverageDays7d: 4,
          avgKcal7d: 1800, avgProteinG7d: 90, avgCarbG7d: 200, avgFatG7d: 60,
          target: { kcal: 2100, p: 150, c: 210, f: 70, source: "plan_items" },
          kcalTrend: "stable",
          exception: { type: "intake_protein_low", detail: "x" },
        },
      }),
    );
    expect(r.label).toBe("Sem atividade");
  });

  it("sem exceção de ingestão (ou intake null) não afeta o resultado estável", () => {
    const r = derivePatientAttention(makePatient({ intake: null }));
    expect(r.level).toBe("stable");
  });

  it("paciente estável não tem needsAttention", () => {
    const r = derivePatientAttention(makePatient({}));
    expect(r.level).toBe("stable");
    expect(r.needsAttention).toBe(false);
  });

  it("sortByPriority ordena revogado > sem plano > atenção > queda > calibrando > estável", () => {
    const stable = makePatient({ id: 1 });
    const revoked = makePatient({ id: 2, consentRevoked: true });
    const noPlan = makePatient({ id: 3, activePlan: null });
    const drop = makePatient({ id: 4, adherenceDropFlag: true, trend: "down" });
    const calibrating = makePatient({ id: 5, adherenceState: "calibrating" });
    const oldDate = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const attention = makePatient({ id: 6, riskFlag: true, lastCheckinDate: oldDate });

    const sorted = sortByPriority([stable, revoked, noPlan, drop, calibrating, attention]);
    expect(sorted.map((p) => p.id)).toEqual([2, 3, 6, 4, 5, 1]);
  });
});
