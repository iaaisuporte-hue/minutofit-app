/**
 * Cliente do Motor de Substituições Inteligentes (Sprint P2A).
 *
 * A regra que este teste protege: a função NUNCA lança. Erro de rede, 4xx/5xx
 * do servidor, resposta malformada ou timeout — tudo vira `null`, porque quem
 * chama (`ReplacementSuggestionsSheet`) decide o fallback de busca manual sem
 * precisar de um `try/catch` a mais.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const authFetch = vi.fn();
vi.mock("./apiClient", () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { fetchReplacementSuggestions } from "./exerciseReplacementSuggestionsApi";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("caminho feliz", () => {
  it("monta a URL sem reasonCategory por padrão (D10) e devolve o resultado", async () => {
    const result = {
      originalExerciseId: "ex-1",
      cautionAdvisory: false,
      suggestions: [{ exercise: { id: "ex-2" }, tier: "HEURISTIC", label: "Boa alternativa", usedBeforeBadge: false, reason: "x" }],
    };
    authFetch.mockResolvedValue(jsonResponse(200, result));

    const out = await fetchReplacementSuggestions("ex-1");

    expect(out).toEqual(result);
    const [url] = authFetch.mock.calls[0];
    expect(url).toContain("/exercises/ex-1/replacement-suggestions");
    expect(url).not.toContain("reasonCategory");
  });

  it("inclui reasonCategory quando explicitamente passado", async () => {
    authFetch.mockResolvedValue(jsonResponse(200, { originalExerciseId: "ex-1", cautionAdvisory: true, suggestions: [] }));

    await fetchReplacementSuggestions("ex-1", "pain_discomfort");

    const [url] = authFetch.mock.calls[0];
    expect(url).toContain("reasonCategory=pain_discomfort");
  });
});

describe("nunca lança — sempre null no fallback", () => {
  it("404 vira null", async () => {
    authFetch.mockResolvedValue(jsonResponse(404, { error: "Exercício não encontrado" }));
    expect(await fetchReplacementSuggestions("ex-1")).toBeNull();
  });

  it("500 vira null", async () => {
    authFetch.mockResolvedValue(jsonResponse(500, { error: "Erro ao buscar sugestões de substituição" }));
    expect(await fetchReplacementSuggestions("ex-1")).toBeNull();
  });

  it("rejeição de rede vira null", async () => {
    authFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await fetchReplacementSuggestions("ex-1")).toBeNull();
  });

  it("resposta 200 malformada (sem `suggestions`) vira null", async () => {
    authFetch.mockResolvedValue(jsonResponse(200, { foo: "bar" }));
    expect(await fetchReplacementSuggestions("ex-1")).toBeNull();
  });
});
