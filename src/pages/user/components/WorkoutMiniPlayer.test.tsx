import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessao = {
  route: "/app/user/workout/1/sessao",
  startedAt: Date.now(),
  restEndsAt: null,
  currentExercise: "Supino",
};
let atual: typeof sessao | null = sessao;

vi.mock("../workoutSession/inProgressSession", () => ({
  findInProgressSession: () => atual,
  sessaoAtiva: () => true,
}));

import { WorkoutMiniPlayer } from "./WorkoutMiniPlayer";

const lerVar = () => document.documentElement.style.getPropertyValue("--mini-player-h");

describe("WorkoutMiniPlayer — reserva de layout", () => {
  beforeEach(() => {
    atual = sessao;
    document.documentElement.style.removeProperty("--mini-player-h");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 64 } as DOMRect);
  });

  it("publica a altura medida enquanto visível e remove ao sumir", () => {
    vi.useFakeTimers();
    const { container } = render(
      <MemoryRouter initialEntries={["/app/user/profile"]}>
        <WorkoutMiniPlayer />
      </MemoryRouter>,
    );
    expect(container.querySelector(".wmp")).not.toBeNull();
    expect(lerVar()).toBe("64px");

    atual = null;
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(container.querySelector(".wmp")).toBeNull();
    expect(lerVar()).toBe("");
    vi.useRealTimers();
  });

  it("não publica nada na própria tela de treino", () => {
    const { container } = render(
      <MemoryRouter initialEntries={[sessao.route]}>
        <WorkoutMiniPlayer />
      </MemoryRouter>,
    );
    expect(container.querySelector(".wmp")).toBeNull();
    expect(lerVar()).toBe("");
  });
});
