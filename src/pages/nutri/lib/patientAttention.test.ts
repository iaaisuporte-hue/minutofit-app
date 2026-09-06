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
