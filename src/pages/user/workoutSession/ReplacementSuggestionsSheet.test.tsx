/**
 * Sugestões inteligentes de substituição (Sprint P2A).
 *
 * Cobre o contrato que protege o fluxo manual (P0): loading não bloqueia,
 * erro/vazio/sem-id caem direto no fallback, seleção segue o MESMO caminho
 * que a busca manual já usava (`onPick`), `cautionAdvisory` suprime só os
 * rótulos de confiança (D8) e `usedBeforeBadge` é sempre complementar (D6).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise } from "../../../services/exercisesApi";
import type { ReplacementSuggestion } from "../../../services/exerciseReplacementSuggestionsApi";
import { __limparOverlays, fecharTopo } from "../../../lib/overlayStack";

const fetchReplacementSuggestions = vi.fn();
vi.mock("../../../services/exerciseReplacementSuggestionsApi", () => ({
  fetchReplacementSuggestions: (...args: unknown[]) => fetchReplacementSuggestions(...args),
}));

const trackReplacementSuggestionEvent = vi.fn();
vi.mock("./replacementSuggestionEvents", () => ({
  trackReplacementSuggestionEvent: (...args: unknown[]) => trackReplacementSuggestionEvent(...args),
}));

import { ReplacementSuggestionsSheet } from "./ReplacementSuggestionsSheet";

function exercicio(over: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-alt-1",
    externalId: null,
    source: "seed",
    name: "Supino inclinado com halteres",
    normalizedName: "supino inclinado com halteres",
    bodyPart: "peito",
    targetMuscle: "Peitoral maior",
    secondaryMuscles: [],
    equipment: "halteres",
    tags: [],
    movementLabExerciseId: null,
    ownerPersonalId: null,
    status: "active",
    instructions: [],
    tips: [],
    media: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function sugestao(over: Partial<ReplacementSuggestion> = {}): ReplacementSuggestion {
  return {
    exercise: exercicio(),
    tier: "HEURISTIC",
    label: "Boa alternativa",
    usedBeforeBadge: false,
    reason: "Trabalha o mesmo músculo-alvo (Peitoral maior).",
    ...over,
  };
}

function renderSheet(over: Partial<React.ComponentProps<typeof ReplacementSuggestionsSheet>> = {}) {
  const onClose = vi.fn();
  const onPick = vi.fn();
  const onManualSearch = vi.fn();
  const utils = render(
    <ReplacementSuggestionsSheet
      open
      originalExerciseId="ex-original"
      originalName="Supino reto"
      onClose={onClose}
      onPick={onPick}
      onManualSearch={onManualSearch}
      {...over}
    />,
  );
  return { ...utils, onClose, onPick, onManualSearch };
}

beforeEach(() => {
  vi.clearAllMocks();
  __limparOverlays();
});

describe("carregamento", () => {
  it("mostra loading e depois a lista, com selo de impressão registrado", async () => {
    let resolve!: (v: unknown) => void;
    fetchReplacementSuggestions.mockReturnValue(new Promise((r) => (resolve = r)));
    renderSheet();

    expect(screen.getAllByText("Buscando alternativas…").length).toBeGreaterThan(0);
    // Não bloqueia: a saída manual já está disponível durante o loading.
    expect(screen.getByRole("button", { name: "Buscar outro exercício" })).toBeTruthy();

    resolve({
      originalExerciseId: "ex-original",
      cautionAdvisory: false,
      suggestions: [sugestao({ exercise: exercicio({ id: "ex-alt-1", name: "Supino máquina" }) })],
    });

    expect(await screen.findByText("Supino máquina")).toBeTruthy();
    expect(screen.getByText("Boa alternativa")).toBeTruthy();
    expect(screen.getByText("Trabalha o mesmo músculo-alvo (Peitoral maior).")).toBeTruthy();
    expect(trackReplacementSuggestionEvent).toHaveBeenCalledWith("replacement_suggestions_opened");
    expect(trackReplacementSuggestionEvent).toHaveBeenCalledWith("replacement_suggestion_impression", {
      count: 1,
      cautionAdvisory: false,
    });
  });
});

describe("fallback obrigatório — o P0 nunca fica dependente do motor", () => {
  it("erro (fetch devolve null) cai no fallback manual", async () => {
    fetchReplacementSuggestions.mockResolvedValue(null);
    const { onManualSearch } = renderSheet();

    expect(await screen.findByText("Não encontramos uma sugestão pronta agora.")).toBeTruthy();
    expect(trackReplacementSuggestionEvent).toHaveBeenCalledWith("replacement_suggestions_error");

    await userEvent.click(screen.getByRole("button", { name: "Buscar outro exercício" }));
    expect(onManualSearch).toHaveBeenCalledTimes(1);
    expect(trackReplacementSuggestionEvent).toHaveBeenCalledWith("replacement_manual_search_selected", {
      hadSuggestions: false,
    });
  });

  it("lista vazia cai no fallback manual", async () => {
    fetchReplacementSuggestions.mockResolvedValue({
      originalExerciseId: "ex-original",
      cautionAdvisory: false,
      suggestions: [],
    });
    renderSheet();

    expect(await screen.findByText("Não encontramos uma sugestão pronta agora.")).toBeTruthy();
    expect(trackReplacementSuggestionEvent).toHaveBeenCalledWith("replacement_suggestions_empty");
  });

  it("sem id de catálogo (ficha legada) cai direto no fallback, sem chamar o motor", async () => {
    renderSheet({ originalExerciseId: null });

    expect(await screen.findByText("Não encontramos uma sugestão pronta agora.")).toBeTruthy();
    expect(fetchReplacementSuggestions).not.toHaveBeenCalled();
  });
});

describe("escolha de sugestão", () => {
  it("segue o MESMO caminho da busca manual — onPick com o exercício escolhido", async () => {
    fetchReplacementSuggestions.mockResolvedValue({
      originalExerciseId: "ex-original",
      cautionAdvisory: false,
      suggestions: [
        sugestao({
          exercise: exercicio({ id: "ex-alt-9", name: "Crucifixo com halteres", bodyPart: "peito" }),
          tier: "PERSONAL_DEFINED",
          label: "Recomendado pelo seu Personal",
          usedBeforeBadge: true,
        }),
      ],
    });
    const { onPick } = renderSheet();

    await userEvent.click(await screen.findByRole("button", { name: /Crucifixo com halteres/ }));

    expect(onPick).toHaveBeenCalledWith({ id: "ex-alt-9", name: "Crucifixo com halteres", bodyPart: "peito" });
    expect(trackReplacementSuggestionEvent).toHaveBeenCalledWith("replacement_suggestion_selected", {
      tier: "PERSONAL_DEFINED",
      position: 0,
      usedBeforeBadge: true,
    });
  });

  it("usedBeforeBadge aparece como selo A MAIS, nunca troca o rótulo de confiança", async () => {
    fetchReplacementSuggestions.mockResolvedValue({
      originalExerciseId: "ex-original",
      cautionAdvisory: false,
      suggestions: [sugestao({ label: "Boa alternativa", usedBeforeBadge: true })],
    });
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText("Boa alternativa")).toBeTruthy();
      expect(screen.getByText("Você já usou esta alternativa")).toBeTruthy();
    });
  });

  it("fecha sem escolher registra 'ignorado' quando havia sugestão na tela", async () => {
    fetchReplacementSuggestions.mockResolvedValue({
      originalExerciseId: "ex-original",
      cautionAdvisory: false,
      suggestions: [sugestao()],
    });
    const { onClose } = renderSheet();

    await screen.findByText(sugestao().exercise.name);
    await userEvent.click(screen.getByRole("button", { name: "Fechar sugestões" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trackReplacementSuggestionEvent).toHaveBeenCalledWith("replacement_suggestion_ignored", { count: 1 });
  });
});

describe("D8 — motivo dor/desconforto reduz confiança, nunca elimina opções", () => {
  it("cautionAdvisory suprime os rótulos de confiança e mostra o aviso fixo, sem afirmar segurança", async () => {
    fetchReplacementSuggestions.mockResolvedValue({
      originalExerciseId: "ex-original",
      cautionAdvisory: true,
      suggestions: [sugestao({ label: null }), sugestao({ exercise: exercicio({ id: "ex-alt-2" }), label: null })],
    });
    renderSheet();

    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(1));
    // Nenhum rótulo de confiança no DOM.
    expect(screen.queryByText("Recomendado")).toBeNull();
    expect(screen.queryByText("Boa alternativa")).toBeNull();
    expect(screen.queryByText("Recomendado pelo seu Personal")).toBeNull();
    // Aviso fixo da spec (§18) — nunca afirmação de segurança.
    expect(screen.getByText("Escolha outra opção ou siga a orientação do seu Personal.")).toBeTruthy();
    expect(screen.getByText("Outras opções")).toBeTruthy();
  });
});

describe("botão voltar do Android (useDismissable)", () => {
  it("fecha o overlay via a pilha do botão voltar", async () => {
    fetchReplacementSuggestions.mockResolvedValue({
      originalExerciseId: "ex-original",
      cautionAdvisory: false,
      suggestions: [],
    });
    const { onClose } = renderSheet();
    await screen.findByText("Não encontramos uma sugestão pronta agora.");

    expect(fecharTopo()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
