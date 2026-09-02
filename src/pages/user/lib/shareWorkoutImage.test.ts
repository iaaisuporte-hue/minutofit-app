import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExerciseRows,
  buildShareText,
  copyShareText,
} from "./shareWorkoutImage";

// Regressão da feature MADURA de compartilhamento social (ver docs/MATURE_FEATURES.md).
// Foco: texto/privacidade (não vaza dado sensível) + capacidade/fallback.

const ORIGINAL = Object.getOwnPropertyDescriptors(navigator);
function restoreNavigator() {
  for (const key of ["share", "canShare", "clipboard"]) {
    if (ORIGINAL[key]) Object.defineProperty(navigator, key, ORIGINAL[key]);
    else delete (navigator as unknown as Record<string, unknown>)[key];
  }
}
afterEach(() => {
  restoreNavigator();
  vi.restoreAllMocks();
});

// Termos que NUNCA podem aparecer no texto compartilhável.
const SENSITIVE = [/peso\s*corporal/i, /\bdor\b/i, /fadiga/i, /les[ãa]o/i, /press[ãa]o/i, /glicose/i, /personal/i, /academia/i, /plano/i, /assinatura/i];

describe("buildShareText", () => {
  it("inclui foco, stats seguros, marca e CTA", () => {
    const text = buildShareText({
      focus: "Peito + Tríceps",
      stats: { durationMin: 45, doneSets: 18, totalSets: 22, volumeKg: 1240 },
    });
    expect(text).toContain("Peito + Tríceps");
    expect(text).toContain("45 min");
    expect(text).toContain("18/22 séries");
    expect(text).toContain("1240 kg");
    expect(text).toContain("S2Core");
    expect(text).toContain("inteligência metabólica");
  });

  it("não expõe dados sensíveis por padrão", () => {
    const text = buildShareText({
      focus: "Costas e Bíceps",
      stats: { durationMin: 50, doneSets: 20, totalSets: 20, volumeKg: 900, streak: 5 },
    });
    for (const re of SENSITIVE) expect(text).not.toMatch(re);
    expect(text).not.toMatch(/undefined|null|NaN/);
  });

  it("funciona sem stats (só foco + marca)", () => {
    const text = buildShareText({ focus: "Pernas" });
    expect(text).toContain("Pernas");
    expect(text).toContain("S2Core");
    expect(text).not.toMatch(/min|séries|kg/);
  });
});

describe("copyShareText", () => {
  it("copia via clipboard quando disponível", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await expect(copyShareText("oi")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("oi");
  });

  it("retorna false quando clipboard não existe", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await expect(copyShareText("oi")).resolves.toBe(false);
  });
});

// Mini tabela "Exercícios executados" do card (ver docs/MATURE_FEATURES.md).
// A regra de corte é o que a peça diz — daí ser pura e testada aqui.
describe("buildExerciseRows", () => {
  it("formata séries × reps e preserva a ordem de execução", () => {
    const { rows, hiddenCount } = buildExerciseRows(
      [
        { name: "Puxada frente", sets: 4, reps: "12" },
        { name: "Remada baixa", sets: 3, reps: "10-12" },
      ],
      6,
    );
    expect(rows).toEqual([
      { name: "Puxada frente", detail: "4 × 12" },
      { name: "Remada baixa", detail: "3 × 10-12" },
    ]);
    expect(hiddenCount).toBe(0);
  });

  it("degrada quando falta séries ou reps, sem imprimir null/undefined", () => {
    const { rows } = buildExerciseRows(
      [
        { name: "Prancha", sets: 3, reps: null },
        { name: "Abdominal", sets: null, reps: "15" },
        { name: "Alongamento" },
        { name: "Agachamento", sets: 1, reps: "10" },
      ],
      6,
    );
    expect(rows.map((r) => r.detail)).toEqual(["3 séries", "15 reps", "", "1 × 10"]);
    for (const r of rows) expect(r.detail).not.toMatch(/undefined|null|NaN/);
  });

  it("gasta a última linha com '+N' em vez de cortar em silêncio", () => {
    const list = Array.from({ length: 9 }, (_, i) => ({ name: `Ex ${i + 1}`, sets: 3, reps: "10" }));
    const { rows, hiddenCount } = buildExerciseRows(list, 6);
    expect(rows).toHaveLength(5);
    expect(rows[4].name).toBe("Ex 5");
    expect(hiddenCount).toBe(4); // 9 − 5 exibidos
  });

  it("descarta nomes vazios e some quando não sobra nada", () => {
    expect(buildExerciseRows([{ name: "   " }, { name: "" }], 6).rows).toEqual([]);
    expect(buildExerciseRows(null, 6).rows).toEqual([]);
    expect(buildExerciseRows(undefined, 6).rows).toEqual([]);
    expect(buildExerciseRows([{ name: "Supino", sets: 3, reps: "10" }], 0).rows).toEqual([]);
  });
});
