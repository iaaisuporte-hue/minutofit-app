/**
 * Desafios na tela (Spec 034, Onda C2).
 *
 * O alvo aqui é o que a interface PROMETE e o que ela deixa de mostrar: o
 * convite precisa ser consentimento informado (quem, o quê, como é medido, o
 * que os outros veem), e nenhuma tela pode exibir percentual, nome ou posição
 * de outro participante.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getChallengeDetail = vi.fn();
const getActiveChallenge = vi.fn();
const joinChallenge = vi.fn();
const leaveChallenge = vi.fn();

vi.mock("./performanceApi", () => ({
  getChallengeDetail: (...a: unknown[]) => getChallengeDetail(...a),
  getActiveChallenge: (...a: unknown[]) => getActiveChallenge(...a),
  joinChallenge: (...a: unknown[]) => joinChallenge(...a),
  leaveChallenge: (...a: unknown[]) => leaveChallenge(...a),
}));

import ChallengeDetailPage from "../../pages/user/ChallengeDetailPage";
import { ChallengeCard } from "../../pages/user/components/ChallengeCard";

const DESAFIO = {
  id: "10",
  title: "Quatro semanas firmes",
  description: "Compromisso da turma",
  kind: "consistency" as const,
  ruleText: "Cumprir pelo menos 80% da sua frequência prevista em 4 semanas.",
  startsOn: "2026-02-02",
  endsOn: "2026-03-01",
  state: "running" as const,
};

function detalhe(over: Record<string, unknown> = {}) {
  return {
    challenge: DESAFIO,
    myStatus: "active",
    myProgress: {
      pct: 50,
      weeksDone: 2,
      weeksRequired: 4,
      achieved: false,
      blockedReason: null,
      band: "in_progress",
    },
    participantsCount: 8,
    bands: [
      { band: "completed", label: "Concluído", count: 3 },
      { band: "almost", label: "Quase lá", count: 2 },
      { band: "in_progress", label: "Em andamento", count: 2 },
      { band: "inactive", label: "Sem atividade", count: 1 },
    ],
    ...over,
  };
}

function renderDetalhe() {
  return render(
    <MemoryRouter initialEntries={["/app/user/desafios/10"]}>
      <Routes>
        <Route path="/app/user/desafios/:challengeId" element={<ChallengeDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Convite · consentimento informado, não um botão", () => {
  beforeEach(() => {
    getChallengeDetail.mockResolvedValue(detalhe({ myStatus: "invited" }));
  });

  it("diz quem convidou, o objetivo, o período e COMO o progresso é medido", async () => {
    renderDetalhe();

    await waitFor(() => expect(screen.getByText(/Seu personal convidou você/i)).toBeTruthy());
    expect(screen.getByText(/Como o progresso é medido/i)).toBeTruthy();
    expect(screen.getByText(/80% da sua frequência prevista/i)).toBeTruthy();
    expect(screen.getByText(/02\/02\/2026 a 01\/03\/2026/)).toBeTruthy();
  });

  it("diz o que os outros NÃO verão, item por item, antes do botão", async () => {
    const { container } = renderDetalhe();
    await waitFor(() => expect(container.querySelector(".ch-privacy")).toBeTruthy());

    const privacidade = container.querySelector(".ch-privacy")!.textContent ?? "";
    for (const termo of ["carga", "peso", "prontidão", "Progress Score", "saúde", "percentual"]) {
      expect(privacidade.toLowerCase()).toContain(termo.toLowerCase());
    }
  });

  it("explica que o progresso é medido contra a PRÓPRIA frequência", async () => {
    // É a tese do produto dita ao usuário: ninguém compete por volume.
    renderDetalhe();
    await waitFor(() =>
      expect(screen.getByText(/sua própria frequência prevista/i)).toBeTruthy(),
    );
  });

  it("diz o que o PERSONAL vê — não só o que os outros não veem", async () => {
    // Omitir isso faria o aluno concluir que ninguém vê seu número, quando o
    // personal vê. Consentimento informado é dizer quem vê o quê.
    getChallengeDetail.mockResolvedValue(
      detalhe({
        myStatus: "invited",
        challenge: { ...DESAFIO, invitedByName: "Marina" },
      }),
    );
    renderDetalhe();

    await waitFor(() => expect(screen.getByText(/Marina convidou você/i)).toBeTruthy());
    expect(screen.getByText(/Marina acompanha seu percentual/i)).toBeTruthy();
  });

  it("oferece RECUSAR — consentimento sem recusa não é consentimento", async () => {
    leaveChallenge.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderDetalhe();

    await waitFor(() => expect(screen.getByRole("button", { name: /Agora não/i })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /Agora não/i }));
    await waitFor(() => expect(leaveChallenge).toHaveBeenCalledWith("10"));
  });

  it("avisa que dá para sair e que a visibilidade acaba na hora", async () => {
    renderDetalhe();
    await waitFor(() => expect(screen.getByText(/pode sair quando quiser/i)).toBeTruthy());
  });

  it("entrar chama a ação e recarrega o estado", async () => {
    joinChallenge.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderDetalhe();

    await waitFor(() => expect(screen.getByRole("button", { name: /Entrar no desafio/i })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /Entrar no desafio/i }));

    await waitFor(() => expect(joinChallenge).toHaveBeenCalledWith("10"));
  });

  it("falha ao entrar é dita, não engolida", async () => {
    joinChallenge.mockResolvedValue({ ok: false, error: "Este desafio não está mais aberto" });
    const user = userEvent.setup();
    renderDetalhe();

    await waitFor(() => expect(screen.getByRole("button", { name: /Entrar no desafio/i })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /Entrar no desafio/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText(/não está mais aberto/i)).toBeTruthy();
  });
});

describe("Acompanhamento · o próprio progresso e nada de ninguém", () => {
  it("mostra a própria barra e as semanas cumpridas", async () => {
    getChallengeDetail.mockResolvedValue(detalhe());
    renderDetalhe();

    await waitFor(() => expect(screen.getByRole("progressbar")).toBeTruthy());
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByText(/2 de 4 semanas/i)).toBeTruthy();
  });

  it("as faixas trazem CONTAGENS, nunca nomes nem percentuais alheios", async () => {
    getChallengeDetail.mockResolvedValue(detalhe());
    const { container } = renderDetalhe();

    await waitFor(() => expect(screen.getByText(/Como está a turma/i)).toBeTruthy());
    expect(screen.getByText(/3 pessoas/)).toBeTruthy();
    expect(screen.getByText(/1 pessoa$/)).toBeTruthy();

    // Uma única barra de progresso na tela: a do próprio aluno.
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
    expect(screen.getByText(/ninguém vê o percentual de ninguém/i)).toBeTruthy();
  });

  it("com menos de 5 participantes, explica a ausência em vez de mostrar vazio", async () => {
    getChallengeDetail.mockResolvedValue(detalhe({ bands: null, participantsCount: 3 }));
    renderDetalhe();

    await waitFor(() =>
      expect(screen.getByText(/a partir de 5 participantes/i)).toBeTruthy(),
    );
    expect(screen.queryByText(/Como está a turma/i)).toBeNull();
  });

  it("progresso indefinido diz o que falta, nunca 0%", async () => {
    getChallengeDetail.mockResolvedValue(
      detalhe({
        myProgress: {
          pct: null,
          weeksDone: 0,
          weeksRequired: 4,
          blockedReason: "no_target",
          band: "inactive",
        },
      }),
    );
    renderDetalhe();

    await waitFor(() =>
      expect(screen.getByText(/Defina uma meta de frequência semanal/i)).toBeTruthy(),
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/^0%/)).toBeNull();
  });

  it("sair está disponível e chama a ação", async () => {
    getChallengeDetail.mockResolvedValue(detalhe());
    leaveChallenge.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderDetalhe();

    await waitFor(() => expect(screen.getByRole("button", { name: /Sair do desafio/i })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /Sair do desafio/i }));
    await waitFor(() => expect(leaveChallenge).toHaveBeenCalledWith("10"));
  });

  it("falha ao abrir oferece retry e não acusa o usuário", async () => {
    // O cliente devolve `null` tanto para 404 quanto para queda de rede: a
    // copy não pode afirmar que o desafio não existe.
    getChallengeDetail.mockResolvedValue(null);
    renderDetalhe();

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível abrir o desafio/i)).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: /Tentar novamente/i })).toBeTruthy();
  });
});

describe("Card da tela Hoje", () => {
  function renderCard() {
    return render(
      <MemoryRouter>
        <ChallengeCard />
      </MemoryRouter>,
    );
  }

  it("some por completo quando não há desafio", async () => {
    getActiveChallenge.mockResolvedValue(null);
    const { container } = renderCard();
    await waitFor(() => expect(getActiveChallenge).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("mostra o próprio progresso e leva ao detalhe", async () => {
    getActiveChallenge.mockResolvedValue({
      ...DESAFIO,
      myStatus: "active",
      myProgress: { pct: 75, weeksDone: 3, weeksRequired: 4, band: "almost" },
    });
    renderCard();

    await waitFor(() => expect(screen.getByText(DESAFIO.title)).toBeTruthy());
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("75");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/app/user/desafios/10");
  });

  it("nunca menciona outro participante", async () => {
    getActiveChallenge.mockResolvedValue({
      ...DESAFIO,
      myStatus: "active",
      myProgress: { pct: 75, weeksDone: 3, weeksRequired: 4, band: "almost" },
    });
    const { container } = renderCard();

    await waitFor(() => expect(screen.getByText(DESAFIO.title)).toBeTruthy());
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/1º|2º|3º|posição|ranking|colocado/i);
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
  });
});

describe("Card da tela Hoje · o convite precisa ser visível", () => {
  it("mostra o convite com o nome de quem convidou", async () => {
    // Sem este estado, o convite não aparecia em lugar nenhum do app: o
    // personal convidava e o aluno nunca ficava sabendo.
    getActiveChallenge.mockResolvedValue({
      ...DESAFIO,
      invitedByName: "Marina",
      myStatus: "invited",
      myProgress: { pct: null, weeksDone: 0, weeksRequired: 4, band: "inactive" },
    });
    render(
      <MemoryRouter>
        <ChallengeCard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Marina convidou você/i)).toBeTruthy());
    // E não finge progresso num compromisso que a pessoa não assumiu.
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("Desafio de academia · a origem muda a copy de privacidade (C3)", () => {
  it("institucional diz que a gestão vê SÓ números do grupo", async () => {
    // O personal acompanha o percentual de cada aluno; a academia não. Usar a
    // mesma frase nos dois casos seria impreciso onde a precisão importa.
    getChallengeDetail.mockResolvedValue(
      detalhe({
        myStatus: "invited",
        challenge: { ...DESAFIO, scope: "academy", invitedByName: "Academia Central" },
      }),
    );
    renderDetalhe();

    await waitFor(() => expect(screen.getByText(/Academia Central convidou você/i)).toBeTruthy());
    expect(screen.getByText(/vê apenas números do grupo/i)).toBeTruthy();
    expect(screen.queryByText(/acompanha seu percentual/i)).toBeNull();
  });

  it("do personal, mantém a frase de acompanhamento individual", async () => {
    getChallengeDetail.mockResolvedValue(
      detalhe({
        myStatus: "invited",
        challenge: { ...DESAFIO, scope: "personal", invitedByName: "Marina" },
      }),
    );
    renderDetalhe();

    await waitFor(() => expect(screen.getByText(/Marina acompanha seu percentual/i)).toBeTruthy());
    expect(screen.queryByText(/apenas números do grupo/i)).toBeNull();
  });

  it("mostra a origem no cabeçalho, sem hierarquizar", async () => {
    getChallengeDetail.mockResolvedValue(
      detalhe({ challenge: { ...DESAFIO, scope: "academy", invitedByName: "Academia Central" } }),
    );
    renderDetalhe();

    await waitFor(() => expect(screen.getByText(/Criado por/i)).toBeTruthy());
    expect(screen.getByText(/Academia Central \(academia\)/i)).toBeTruthy();
  });
});
