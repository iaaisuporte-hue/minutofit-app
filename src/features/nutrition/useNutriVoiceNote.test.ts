import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNutriVoiceNote } from "./useNutriVoiceNote";

vi.mock("../../services/apiClient", () => ({
  authFetch: vi.fn(),
}));

// SPEC 036 / NUTRI-23: o GET marca todas as notas pendentes como lidas em
// bloco; o hook antigo só guardava `data[0]`, descartando qualquer nota
// além da primeira sem o aluno nunca tê-la visto.
describe("useNutriVoiceNote", () => {
  beforeEach(() => vi.resetAllMocks());

  it("expõe a fila inteira de notas, não só a primeira", async () => {
    const { authFetch } = await import("../../services/apiClient");
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: "1", nutriId: 1, patientId: 2, body: "nota 1", anchorMealId: null, publishedAt: "2026-09-01T10:00:00Z", readAt: null },
          { id: "2", nutriId: 1, patientId: 2, body: "nota 2", anchorMealId: null, publishedAt: "2026-09-02T10:00:00Z", readAt: null },
          { id: "3", nutriId: 1, patientId: 2, body: "nota 3", anchorMealId: null, publishedAt: "2026-09-03T10:00:00Z", readAt: null },
        ],
      }),
    } as Response);

    const { result } = renderHook(() => useNutriVoiceNote());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes).toHaveLength(3);
    expect(result.current.notes.map((n) => n.id)).toEqual(["1", "2", "3"]);
  });

  it("lista vazia quando não há nota pendente", async () => {
    const { authFetch } = await import("../../services/apiClient");
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response);

    const { result } = renderHook(() => useNutriVoiceNote());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes).toEqual([]);
  });
});
