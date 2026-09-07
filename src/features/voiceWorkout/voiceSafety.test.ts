import { describe, expect, it } from "vitest";
import { hasAttentionSignal } from "./voiceSafety";

describe("hasAttentionSignal", () => {
  it.each([
    "estou com dor no peito",
    "senti um aperto no peito",
    "estou com tontura forte",
    "to meio tonto agora",
    "sinto falta de ar",
    "quase desmaiei aqui",
    "acho que vou desmaiar",
    "dor muito forte no ombro",
    "uma dor insuportável na lombar",
  ])("detecta sinal de atenção em: %s", (texto) => {
    expect(hasAttentionSignal(texto)).toBe(true);
  });

  it.each([
    "senti uma fisgada no ombro",
    "estava pesado demais",
    "ficou tranquilo",
    "o joelho incomodou um pouco",
    "perdi força na última série",
  ])("NÃO marca relato comum como sinal de atenção: %s", (texto) => {
    expect(hasAttentionSignal(texto)).toBe(false);
  });
});
