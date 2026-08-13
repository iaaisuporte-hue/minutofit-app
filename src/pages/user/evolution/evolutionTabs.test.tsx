/**
 * Contrato das sub-abas da Evolução (Spec 033, P1).
 *
 * O que estes testes travam:
 *  - as 6 abas existem e renderizam;
 *  - a aba vive na URL, então deep link e F5 preservam onde o aluno estava
 *    (num PWA, o Android mata a aba e recarrega o tempo todo);
 *  - aba desconhecida degrada para a primeira em vez de tela branca;
 *  - nenhuma aba promete funcionalidade que não existe.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

// A rede não participa: aqui o alvo é o roteamento das abas.
vi.mock("../../../features/performance/performanceApi", () => ({
  getPerformanceOverview: vi.fn().mockResolvedValue(null),
  getTrainingCalendar: vi.fn().mockResolvedValue([]),
  getPrRecords: vi.fn().mockResolvedValue({ gated: false, records: [], events: [] }),
  getProgression: vi.fn().mockResolvedValue({ gated: false, windowDays: 90, exercises: [] }),
  getGoals: vi.fn().mockResolvedValue({ gated: false, goals: [], activeCount: 0, maxActive: 5 }),
  createGoal: vi.fn(),
  abandonGoal: vi.fn(),
}));
vi.mock("../../../features/performance/performanceEvents", () => ({
  postPerformanceEvent: vi.fn(),
}));
vi.mock("../../../services/workoutSessionApi", () => ({
  listWorkoutSessionsPage: vi.fn().mockResolvedValue({ sessions: [], nextCursor: null }),
  getWorkoutSessionDetail: vi.fn().mockResolvedValue(null),
  getWorkoutStats: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../../auth/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({ loading: false, planName: "Free", features: [], hasFeature: () => false, refresh: vi.fn() }),
}));

import MetabolicStatePage, { EVOLUTION_TABS } from "../MetabolicStatePage";
import { postPerformanceEvent } from "../../../features/performance/performanceEvents";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/evolucao" element={<MetabolicStatePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Evolução · barra de abas", () => {
  it("declara exatamente as 6 abas da spec, na ordem", () => {
    expect(EVOLUTION_TABS.map((t) => t.id)).toEqual([
      "visao-geral",
      "progressao",
      "recordes",
      "consistencia",
      "metas",
      "historico",
    ]);
  });

  it("renderiza as 6 abas como tablist", () => {
    renderAt("/evolucao");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
    for (const t of EVOLUTION_TABS) {
      expect(screen.getByRole("tab", { name: new RegExp(t.label, "i") })).toBeTruthy();
    }
  });

  it("sem ?tab abre a Visão geral", () => {
    renderAt("/evolucao");
    expect(screen.getByRole("tab", { name: /Visão geral/i }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("Evolução · deep link", () => {
  it("?tab=historico abre direto o Histórico", async () => {
    renderAt("/evolucao?tab=historico");
    expect(screen.getByRole("tab", { name: /Histórico/i }).getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(screen.getByRole("tabpanel")).toBeTruthy());
  });

  it("cada aba é alcançável por URL", async () => {
    for (const tab of EVOLUTION_TABS) {
      const { unmount } = renderAt(`/evolucao?tab=${tab.id}`);
      await waitFor(() =>
        expect(
          screen.getByRole("tab", { name: new RegExp(tab.label, "i") }).getAttribute("aria-selected"),
        ).toBe("true"),
      );
      unmount();
    }
  });

  it("aba desconhecida cai na primeira em vez de tela branca", () => {
    renderAt("/evolucao?tab=nao-existe");
    expect(screen.getByRole("tab", { name: /Visão geral/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel")).toBeTruthy();
  });
});

describe("Evolução · troca de aba", () => {
  it("clicar numa aba a seleciona e reflete na URL", async () => {
    const user = userEvent.setup();
    renderAt("/evolucao");
    await user.click(screen.getByRole("tab", { name: /Consistência/i }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Consistência/i }).getAttribute("aria-selected")).toBe("true"),
    );
  });

  it("emite telemetria de abertura e de troca de aba", async () => {
    const user = userEvent.setup();
    renderAt("/evolucao");
    expect(postPerformanceEvent).toHaveBeenCalledWith("performance.opened", expect.anything());
    await user.click(screen.getByRole("tab", { name: /Recordes/i }));
    expect(postPerformanceEvent).toHaveBeenCalledWith("performance.tab_viewed", { tab: "recordes" });
  });
});

describe("Evolução · nenhuma aba promete o que não entrega", () => {
  // A lista de "em breve" esvaziou na Onda P4: Recordes saiu na P2, Metas aqui.
  // O teste continua porque a regra vale para a próxima aba que nascer.
  it("nenhuma aba carrega o marcador 'em breve'", () => {
    renderAt("/evolucao");
    for (const tab of EVOLUTION_TABS) {
      expect(screen.getByRole("tab", { name: new RegExp(tab.label, "i") }).textContent)
        .not.toMatch(/em breve/i);
    }
  });

  it("a aba Metas abre funcional, com o estado real de quem não tem meta", async () => {
    renderAt("/evolucao?tab=metas");
    await waitFor(() => expect(screen.getByText(/Nenhuma meta por enquanto/i)).toBeTruthy());
    // Estado vazio explica e convida — sem exibir número que ninguém mediu.
    expect(screen.getByRole("button", { name: /Criar meta/i })).toBeTruthy();
    expect(screen.queryByText(/\b\d+\s?kg\b/i)).toBeNull();
  });
});
