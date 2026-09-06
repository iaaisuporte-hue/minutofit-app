/**
 * Este card é a porta de entrada de quem reabre o app e cai na Hoje, sem
 * nunca voltar à tela do treino (`WorkoutSessionPage`) — é exatamente o
 * caminho que NÃO passa pelo `useEffect` de `iniciar()`/`parar()` da Lock
 * Screen (P1D). "Encerrar treino" aqui precisa desligar a superfície nativa
 * por conta própria (P1E) — sem isso, um serviço revivido por `START_STICKY`
 * depois de o processo morrer no meio de um treino ficaria órfão para
 * sempre, porque nenhum componente que o conheça chega a montar.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDraft, type DraftExercise } from "../workoutSession/sessionDraft";

const parar = vi.fn();
const cancelarLembretesTreino = vi.fn();

vi.mock("../workoutSession/liveSurface/createWorkoutLiveSurface", () => ({
  createWorkoutLiveSurface: () => ({ iniciar: vi.fn(), atualizar: vi.fn(), parar }),
}));
vi.mock("../workoutSession/pendingWorkoutReminder", () => ({
  cancelarLembretesTreino: (...a: unknown[]) => cancelarLembretesTreino(...a),
}));

import { ResumeWorkoutCard } from "./ResumeWorkoutCard";

function ex(nome: string, feitas: number, total: number): DraftExercise {
  return {
    exerciseId: null,
    name: nome,
    biSetGroupId: null,
    sets: Array.from({ length: total }, (_, i) => ({
      setIndex: i,
      plannedReps: "10",
      plannedRestS: 60,
      loadKg: i < feitas ? "40" : "",
      reps: i < feitas ? "10" : "",
      done: i < feitas,
      restDoneS: null,
      // Antigo de propósito: `completedAt: Date.now()` faria `sessaoAtiva()`
      // dar true, e este card só aparece para um treino que JÁ esfriou — o
      // "agora mesmo" é assunto do mini-player, não deste componente.
      completedAt: i < feitas ? 2000 : null,
    })),
  };
}

function semearTreinoAberto() {
  // startedAt bem antigo: sessaoAtiva() precisa dar falso para o card
  // aparecer (senão o mini-player é quem mostra o estado, não este card).
  saveDraft({
    version: 1, planId: 7, dayIndex: 2, startedAt: 1000, currentIndex: 0,
    exercises: [ex("Supino", 2, 4)], restEndsAt: null, restForKey: null,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  cancelarLembretesTreino.mockResolvedValue(undefined);
});

describe("ResumeWorkoutCard — encerrar sem nunca abrir a tela do treino", () => {
  it("não renderiza nada sem treino aberto", () => {
    const { container } = render(<MemoryRouter><ResumeWorkoutCard /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('"Encerrar treino" desliga a superfície nativa (P1E) mesmo sem WorkoutSessionPage montada', async () => {
    semearTreinoAberto();
    const user = userEvent.setup();
    render(<MemoryRouter><ResumeWorkoutCard /></MemoryRouter>);

    await screen.findByText(/treino em andamento/i);
    expect(parar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Encerrar treino" }));
    await user.click(screen.getByRole("button", { name: "Encerrar" }));

    await waitFor(() => expect(parar).toHaveBeenCalledTimes(1));
  });

  it("cancela os lembretes pendentes ao encerrar (mesmo fluxo)", async () => {
    semearTreinoAberto();
    const user = userEvent.setup();
    render(<MemoryRouter><ResumeWorkoutCard /></MemoryRouter>);

    await screen.findByText(/treino em andamento/i);
    await user.click(screen.getByRole("button", { name: "Encerrar treino" }));
    await user.click(screen.getByRole("button", { name: "Encerrar" }));

    await waitFor(() => expect(cancelarLembretesTreino).toHaveBeenCalledTimes(1));
  });

  it('"Continuar treino" NÃO desliga a superfície — a sessão real continua', async () => {
    semearTreinoAberto();
    const user = userEvent.setup();
    render(<MemoryRouter><ResumeWorkoutCard /></MemoryRouter>);

    await screen.findByText(/treino em andamento/i);
    await user.click(screen.getByRole("button", { name: "Continuar treino" }));

    expect(parar).not.toHaveBeenCalled();
  });
});
