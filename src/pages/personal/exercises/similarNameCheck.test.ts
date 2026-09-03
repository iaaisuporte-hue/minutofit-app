import { describe, expect, it } from "vitest";
import { buildSimilarityCheckQuery, findSimilarExerciseName, normalizeForSimilarityCheck } from "./similarNameCheck";

describe("normalizeForSimilarityCheck", () => {
  it("remove acentos, baixa a caixa e colapsa espaços", () => {
    expect(normalizeForSimilarityCheck("  Elevação   Lateral  ")).toBe("elevacao lateral");
  });
});

describe("findSimilarExerciseName", () => {
  const catalog = [
    { id: "1", name: "Supino Reto com Barra" },
    { id: "2", name: "Agachamento Livre" },
    { id: "3", name: "Rosca Direta" },
  ];

  it("acha por igualdade exata (ignorando acento/caixa)", () => {
    expect(findSimilarExerciseName("supino reto com barra", catalog)).toEqual(catalog[0]);
  });

  it("acha quando o nome digitado é substring de um do catálogo", () => {
    expect(findSimilarExerciseName("Supino Reto", catalog)).toEqual(catalog[0]);
  });

  it("acha quando um nome do catálogo é substring do digitado", () => {
    expect(findSimilarExerciseName("Agachamento Livre Sumô", catalog)).toEqual(catalog[1]);
  });

  it("não acha nada quando não há relação nenhuma", () => {
    expect(findSimilarExerciseName("Prancha Isométrica", catalog)).toBeNull();
  });

  it("nomes muito curtos (<3 chars normalizados) não disparam aviso — ruído demais", () => {
    expect(findSimilarExerciseName("Ab", catalog)).toBeNull();
  });

  it("catálogo vazio nunca encontra nada", () => {
    expect(findSimilarExerciseName("Supino", [])).toBeNull();
  });

  it("candidato com nome vazio é ignorado, não quebra a busca", () => {
    expect(findSimilarExerciseName("Supino", [{ id: "x", name: "" }, ...catalog])).toEqual(catalog[0]);
  });

  it("QA sprint P1: acha quando o nome digitado é MAIOR e contém um nome do catálogo (caso canônico da spec D11)", () => {
    const globalCatalog = [{ id: "g1", name: "Supino Reto" }];
    expect(findSimilarExerciseName("Supino Reto Personalizado", globalCatalog)).toEqual(globalCatalog[0]);
  });
});

describe("buildSimilarityCheckQuery", () => {
  it("usa a primeira palavra quando ela já tem tamanho suficiente para buscar", () => {
    expect(buildSimilarityCheckQuery("Supino Reto Personalizado")).toBe("Supino");
  });

  it("volta pro nome digitado inteiro quando a primeira palavra é curta demais", () => {
    expect(buildSimilarityCheckQuery("De Pé Reto")).toBe("De Pé Reto");
  });

  it("nome de uma palavra só usa a própria palavra", () => {
    expect(buildSimilarityCheckQuery("Supino")).toBe("Supino");
  });

  it("colapsa espaços nas bordas antes de extrair a primeira palavra", () => {
    expect(buildSimilarityCheckQuery("  Rosca Direta  ")).toBe("Rosca");
  });
});
