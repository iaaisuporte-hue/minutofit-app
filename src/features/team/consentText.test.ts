/**
 * Alimentação Livre — D9: o escopo `nutrition` (sem migration, sem novo escopo) passa a dizer com clareza que o acesso do
 * nutricionista inclui o plano alimentar E o diário alimentar (o que o aluno registrar, inclusive fora do plano).
 */
import { describe, expect, it } from "vitest";
import { SCOPE_HINTS, SCOPE_LABELS } from "./types";

describe("texto do consentimento de nutrição", () => {
  it("o rótulo cita plano e diário alimentar; a explicação cita o que é registrado fora do plano", () => {
    expect(SCOPE_LABELS.nutrition).toBe("Plano e diário alimentar");
    expect(SCOPE_HINTS.nutrition).toMatch(/plano alimentar/);
    expect(SCOPE_HINTS.nutrition).toMatch(/diário alimentar/);
    expect(SCOPE_HINTS.nutrition).toMatch(/fora do plano/);
  });

  it("só o escopo de nutrição ganha explicação extra (outros escopos não mudam)", () => {
    expect(Object.keys(SCOPE_HINTS)).toEqual(["nutrition"]);
  });
});
