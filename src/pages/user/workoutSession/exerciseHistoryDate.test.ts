import { describe, expect, it } from "vitest";
import { dataCurta } from "./ExerciseHistorySheet";

describe("dataCurta — histórico rápido do exercício (regressão do QA P3)", () => {
  it("formata ISO como dia/mês", () => {
    expect(dataCurta("2026-09-02")).toBe("02/09");
    expect(dataCurta("2026-12-31")).toBe("31/12");
  });

  it("aceita ISO com hora (o servidor pode passar a mandar timestamp)", () => {
    expect(dataCurta("2026-09-02T10:00:00Z")).toBe("02/09");
  });

  it("NÃO reinterpreta como UTC — a data já vem no dia do aluno", () => {
    // 01/09 às 23h no Brasil é 02/09 em UTC. `new Date().getDate()` daria 02.
    expect(dataCurta("2026-09-01")).toBe("01/09");
  });

  it('formato inesperado vira "—", nunca um Date completo na tela', () => {
    // O defeito original: o servidor mandava `::date`, o driver entregava um
    // Date e a tela exibia "Wed Sep 02 2026 00:00:00 GMT-0300 (...)".
    expect(dataCurta("Wed Sep 02 2026 00:00:00 GMT-0300")).toBe("—");
    expect(dataCurta("")).toBe("—");
    expect(dataCurta(undefined as unknown as string)).toBe("—");
  });
});
