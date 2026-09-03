/**
 * Cliente de Aderência, Recorrência e Insights do Personal (Sprint P2B).
 *
 * O contrato do backend nem sempre inclui `code` no corpo do erro (ver
 * `personalInsights.ts`) — este teste protege a derivação de código estável
 * que a UI usa para decidir a mensagem, e o caso especial do drill-down (404
 * "nunca foi prescrito" é `null`, não exceção; 404 por vínculo/consent
 * continua sendo erro).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const authFetch = vi.fn();
vi.mock("./apiClient", () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import {
  getExerciseInsightDrillDown,
  getStudentAdherence,
  PersonalInsightsError,
  reviewExerciseInsight,
} from "./personalInsightsApi";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => vi.clearAllMocks());

describe("getStudentAdherence", () => {
  it("caminho feliz devolve os dados", async () => {
    const data = { windowDays: 30, sessionsConsidered: 1, denominator: 1, buckets: {}, addedCount: 0, items: [], added: [] };
    authFetch.mockResolvedValue(jsonResponse(200, { success: true, data }));
    expect(await getStudentAdherence("42")).toEqual(data);
  });

  it("403 com `code` explícito (ex.: PRODUCT_NOT_GRANTED) preserva o código", async () => {
    authFetch.mockResolvedValue(jsonResponse(403, { success: false, error: "x", code: "PRODUCT_NOT_GRANTED" }));
    await expect(getStudentAdherence("42")).rejects.toMatchObject({ code: "PRODUCT_NOT_GRANTED" });
  });

  it("403 SEM `code` (ASSIGNMENT_REQUIRED do serviço) vira ASSIGNMENT_REQUIRED", async () => {
    authFetch.mockResolvedValue(
      jsonResponse(403, { success: false, error: "Student is not assigned to this personal trainer" }),
    );
    await expect(getStudentAdherence("42")).rejects.toMatchObject({ code: "ASSIGNMENT_REQUIRED" });
  });

  it("403 com error='consent_required' vira CONSENT_REQUIRED", async () => {
    authFetch.mockResolvedValue(jsonResponse(403, { success: false, error: "consent_required" }));
    await expect(getStudentAdherence("42")).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });
});

describe("getExerciseInsightDrillDown", () => {
  it("404 sem code = 'nada a mostrar' vira null (exercício nunca prescrito na janela)", async () => {
    authFetch.mockResolvedValue(jsonResponse(404, { success: false, error: "Exercício não foi prescrito na janela analisada." }));
    expect(await getExerciseInsightDrillDown("42", "ex-1")).toBeNull();
  });

  it("404 por vínculo inativo continua erro, não vira null", async () => {
    authFetch.mockResolvedValue(
      jsonResponse(403, { success: false, error: "Student is not assigned to this personal trainer" }),
    );
    await expect(getExerciseInsightDrillDown("42", "ex-1")).rejects.toBeInstanceOf(PersonalInsightsError);
  });
});

describe("reviewExerciseInsight — códigos que o backend não manda em `code`", () => {
  it("INVALID_EXERCISES só tem `details`, sem `code` — deriva pelo formato", async () => {
    authFetch.mockResolvedValue(
      jsonResponse(400, { success: false, error: "Exercícios inválidos no plano", details: ["exerciseId x não existe"] }),
    );
    await expect(
      reviewExerciseInsight("42", "ex-1", { action: "apply", targetExerciseId: "ex-2" }),
    ).rejects.toMatchObject({ code: "INVALID_EXERCISES", details: ["exerciseId x não existe"] });
  });

  it("erros de `fail()` (NO_ACTIVE_PLAN etc.) já vêm com `code` — passam direto", async () => {
    authFetch.mockResolvedValue(
      jsonResponse(404, { success: false, error: "Aluno não tem ficha ativa para revisar", code: "NO_ACTIVE_PLAN" }),
    );
    await expect(
      reviewExerciseInsight("42", "ex-1", { action: "apply", targetExerciseId: "ex-2" }),
    ).rejects.toMatchObject({ code: "NO_ACTIVE_PLAN" });
  });

  it("dismiss no caminho feliz devolve o contrato sem persistência", async () => {
    authFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { applied: false, dismissed: true } }));
    const result = await reviewExerciseInsight("42", "ex-1", { action: "dismiss" });
    expect(result).toEqual({ applied: false, dismissed: true });
  });
});
