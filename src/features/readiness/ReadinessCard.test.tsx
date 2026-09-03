import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const api = vi.hoisted(() => ({ getReadinessToday: vi.fn(), postEffortFeedback: vi.fn() }));
const ev = vi.hoisted(() => ({ postReadinessEvent: vi.fn() }));
vi.mock("./readinessApi", () => api);
vi.mock("./readinessEvents", () => ev);

import { ReadinessCard } from "./ReadinessCard";
import type { ReadinessToday } from "./readinessApi";

const base = (over: Partial<ReadinessToday> = {}): ReadinessToday => ({
  date: "2026-09-02", score: 74, state: "ready", recommendation: "NORMAL",
  confidence: "high", dataCompleteness: 0.88, mode: "established",
  headline: "Pronto para treinar", microcopy: "Sinais dentro do esperado. Bom treino.",
  reasons: [], muscleRecovery: [], algorithmVersion: "1.0", ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("ReadinessCard — nunca só o número (§2, §3)", () => {
  it("mostra estado, score, confiança e recomendação juntos", async () => {
    api.getReadinessToday.mockResolvedValue(base());
    render(<ReadinessCard />);
    expect(await screen.findByText("Pronto para treinar")).toBeInTheDocument();
    expect(screen.getByText("74")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.getByText(/Sinais dentro do esperado/)).toBeInTheDocument();
  });

  it('"Por quê?" abre os motivos — sem fórmula (§32)', async () => {
    api.getReadinessToday.mockResolvedValue(base({
      score: 49, state: "light", headline: "Pegue leve hoje",
      reasons: [
        { id: "sleep.below_baseline", label: "Sono abaixo do seu padrão", direction: "negative", severity: "caution" },
        { id: "muscle.recovered", label: "Musculatura recuperada", direction: "positive", severity: "info" },
      ],
    }));
    render(<ReadinessCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Por quê?" }));
    expect(screen.getByText("Sono abaixo do seu padrão")).toBeInTheDocument();
    expect(screen.getByText("Musculatura recuperada")).toBeInTheDocument();
    // Nada de peso, multiplicação ou nome de componente técnico.
    expect(document.body.textContent).not.toMatch(/0\.28|weight|subjective|trainingLoad/);
  });

  it("mostra a recuperação por grupo muscular (§29)", async () => {
    api.getReadinessToday.mockResolvedValue(base({
      muscleRecovery: [
        { group: "quads", label: "Quadríceps", recovery: 51, state: "recovering" },
        { group: "chest", label: "Peito", recovery: 92, state: "recovered" },
      ],
    }));
    render(<ReadinessCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Por quê?" }));
    expect(screen.getByText("Quadríceps")).toBeInTheDocument();
    expect(screen.getByText("51%")).toBeInTheDocument();
    // Grupo recuperado não polui a lista — só o que exige atenção aparece.
    expect(screen.queryByText("Peito")).not.toBeInTheDocument();
  });

  it("traz o limite de responsabilidade (§52)", async () => {
    api.getReadinessToday.mockResolvedValue(base());
    render(<ReadinessCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Por quê?" }));
    expect(screen.getByText(/não substituem avaliação profissional/i)).toBeInTheDocument();
  });
});

describe("score null é resultado, não erro (§11, §31)", () => {
  it('cold start mostra "—" e "Estamos calibrando" — NUNCA zero', async () => {
    api.getReadinessToday.mockResolvedValue(base({
      score: null, state: "calibrating", recommendation: "CHECKIN_FIRST",
      confidence: "low", mode: "cold_start", headline: "Estamos calibrando",
      microcopy: "Faça o check-in do dia para começarmos a entender o seu padrão.",
    }));
    render(<ReadinessCard />);
    expect(await screen.findByText("Estamos calibrando")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    // Sem score não faz sentido exibir "/100".
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
  });

  it("confiança baixa é exibida junto do score, não escondida (§9)", async () => {
    api.getReadinessToday.mockResolvedValue(base({ score: 69, confidence: "low" }));
    render(<ReadinessCard />);
    expect(await screen.findByText("69")).toBeInTheDocument();
    expect(screen.getByText("Baixa")).toBeInTheDocument();
  });
});

describe("feature flag (§74)", () => {
  it("indisponível: a seção não renderiza nada — sem erro, porque não há erro", async () => {
    api.getReadinessToday.mockResolvedValue(null);
    const { container } = render(<ReadinessCard />);
    await waitFor(() => expect(api.getReadinessToday).toHaveBeenCalled());
    expect(container.querySelector(".rdn")).toBeNull();
    expect(container.textContent).toBe("");
  });
});

describe("instrumentação (§71)", () => {
  it("registra a visualização sem mandar score nem dado de saúde", async () => {
    api.getReadinessToday.mockResolvedValue(base({ score: 74 }));
    render(<ReadinessCard />);
    await waitFor(() => expect(ev.postReadinessEvent).toHaveBeenCalledWith(
      "readiness_viewed", { state: "ready", confidence: "high", mode: "established" },
    ));
    const payload = JSON.stringify(ev.postReadinessEvent.mock.calls);
    expect(payload).not.toContain("74");
    expect(payload).not.toMatch(/sleep|hrv|pain|score/i);
  });

  it("registra a abertura do detalhe", async () => {
    api.getReadinessToday.mockResolvedValue(base());
    render(<ReadinessCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Por quê?" }));
    expect(ev.postReadinessEvent).toHaveBeenCalledWith("readiness_details_opened", { state: "ready" });
  });
});

describe("dado parcial não se apresenta como medição (FECHAMENTO §6)", () => {
  it("cobertura baixa exibe o selo experimental e a porcentagem", async () => {
    api.getReadinessToday.mockResolvedValue(base({ score: 73, dataCompleteness: 0.42, confidence: "low" }));
    render(<ReadinessCard />);
    expect(await screen.findByText("experimental")).toBeInTheDocument();
    expect(screen.getByText(/cobertura 42%/)).toBeInTheDocument();
  });

  it("cobertura alta NÃO exibe o selo — o motor está bem alimentado", async () => {
    api.getReadinessToday.mockResolvedValue(base({ dataCompleteness: 0.88 }));
    render(<ReadinessCard />);
    expect(await screen.findByText("74")).toBeInTheDocument();
    expect(screen.queryByText("experimental")).not.toBeInTheDocument();
    expect(screen.getByText(/cobertura 88%/)).toBeInTheDocument();
  });

  it('o "Por quê?" nomeia as fontes que faltam, em vez de só dizer "poucos dados"', async () => {
    api.getReadinessToday.mockResolvedValue(base({ dataCompleteness: 0.24, confidence: "low" }));
    render(<ReadinessCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Por quê?" }));
    expect(screen.getByText(/variabilidade cardíaca, frequência de repouso nem duração de sono/i))
      .toBeInTheDocument();
    expect(screen.getByText(/Cobertura de dados: 24%/)).toBeInTheDocument();
  });

  it("o limiar do selo é o mesmo da confiança alta do backend (0,75)", async () => {
    api.getReadinessToday.mockResolvedValue(base({ dataCompleteness: 0.75 }));
    const { unmount } = render(<ReadinessCard />);
    expect(await screen.findByText("74")).toBeInTheDocument();
    expect(screen.queryByText("experimental")).not.toBeInTheDocument();
    unmount();

    api.getReadinessToday.mockResolvedValue(base({ dataCompleteness: 0.74 }));
    render(<ReadinessCard />);
    expect(await screen.findByText("experimental")).toBeInTheDocument();
  });
});
