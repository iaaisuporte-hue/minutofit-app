/**
 * Preferência de lembrete de treino.
 *
 * Os dois casos que a revisão de UX apontou são silenciosos por natureza e não
 * aparecem olhando a tela: a preferência dizer "Ativado" com a permissão negada
 * no aparelho (nada é entregue e nada explica por quê), e religar no meio de um
 * treino aberto não reagendar nada — deixando justamente sem lembrete quem
 * acabou de pedir para ser lembrado.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { agendarLembretesTreino, cancelarLembretesTreino, notificacaoPermitida } = vi.hoisted(() => ({
  agendarLembretesTreino: vi.fn(),
  cancelarLembretesTreino: vi.fn(),
  notificacaoPermitida: vi.fn(),
}));

vi.mock("../workoutSession/pendingWorkoutReminder", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  agendarLembretesTreino: (...a: unknown[]) => {
    agendarLembretesTreino(...a);
    return Promise.resolve(2);
  },
  cancelarLembretesTreino: () => {
    cancelarLembretesTreino();
    return Promise.resolve();
  },
}));
vi.mock("../workoutSession/notificationPermission", () => ({
  notificacaoPermitida: () => notificacaoPermitida(),
}));

import { WorkoutReminderSetting } from "./WorkoutReminderSetting";
import { saveFreeDraft } from "../workoutSession/sessionDraft";

const AVISO = /Ative as notificações do S2CORE nos ajustes do aparelho/;

function semearTreinoAberto(lastActivityAt: number) {
  saveFreeDraft({
    version: 1, mode: "free", startedAt: lastActivityAt - 60_000, currentIndex: 0,
    exercises: [{
      exerciseId: "ex-1", name: "Supino", biSetGroupId: null,
      sets: [{
        setIndex: 1, plannedReps: "10", plannedRestS: 60, loadKg: "40",
        reps: "10", done: true, restDoneS: null, completedAt: lastActivityAt,
      }],
    }],
    restEndsAt: null, restForKey: null, clientKey: "k",
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  notificacaoPermitida.mockResolvedValue(true);
});

describe("WorkoutReminderSetting", () => {
  it("nasce ativada e sem aviso quando o sistema permite notificar", async () => {
    render(<WorkoutReminderSetting />);
    expect(screen.getByRole("button", { name: "Ativado" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(notificacaoPermitida).toHaveBeenCalled());
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it("com a permissão negada, diz que o aparelho está bloqueando", async () => {
    notificacaoPermitida.mockResolvedValue(false);
    render(<WorkoutReminderSetting />);
    // Sem isto o controle diria "Ativado" e nunca entregaria nada.
    expect(await screen.findByText(AVISO)).toBeTruthy();
  });

  it("desativar cancela o que já estava agendado no sistema", async () => {
    render(<WorkoutReminderSetting />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Desativado" }));
    expect(cancelarLembretesTreino).toHaveBeenCalled();
    // E o aviso de permissão some: não há mais o que entregar.
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it("religar reagenda o treino que está aberto, sem esperar a próxima série", async () => {
    const ultimaSerie = Date.now() - 10 * 60 * 1000;
    semearTreinoAberto(ultimaSerie);
    render(<WorkoutReminderSetting />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Desativado" }));
    await user.click(screen.getByRole("button", { name: "Ativado" }));

    expect(agendarLembretesTreino).toHaveBeenCalledTimes(1);
    const [sessao, quando] = agendarLembretesTreino.mock.calls[0];
    expect(sessao).toMatchObject({ mode: "free", planId: null, dayIndex: null });
    // A referência é a última atividade REAL, não o instante do toque no botão.
    expect(quando).toBe(ultimaSerie);
  });

  it("religar sem treino aberto não agenda nada", async () => {
    render(<WorkoutReminderSetting />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Desativado" }));
    await user.click(screen.getByRole("button", { name: "Ativado" }));
    expect(agendarLembretesTreino).not.toHaveBeenCalled();
  });
});
