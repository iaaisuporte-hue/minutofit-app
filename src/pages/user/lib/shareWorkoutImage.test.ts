import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildShareText,
  canShareWorkoutImage,
  copyShareText,
  shareImageBlob,
  type ComposedImage,
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

describe("canShareWorkoutImage", () => {
  it("é false sem navigator.share (desktop) → cai no fallback", () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    expect(canShareWorkoutImage()).toBe(false);
  });

  it("é true quando o device compartilha arquivos (mobile)", () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    expect(canShareWorkoutImage()).toBe(true);
  });
});

describe("shareImageBlob", () => {
  it("retorna false quando Web Share não existe (sem lançar)", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const fake: ComposedImage = {
      blob: new Blob([""], { type: "image/jpeg" }),
      dataUrl: "data:image/jpeg;base64,",
      focus: "Peito",
      format: "story",
    };
    await expect(shareImageBlob(fake)).resolves.toBe(false);
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
