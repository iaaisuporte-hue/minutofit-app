import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Stub do modal (evita o canvas/Web Share); só precisamos provar que o botão
// existe e ABRE o fluxo de compartilhamento — esta é a regressão que protegemos.
vi.mock("./ShareWorkoutModal", () => ({
  ShareWorkoutModal: (props: { focus: string }) =>
    React.createElement("div", { "data-testid": "share-modal-stub" }, props.focus),
}));

import { WorkoutShareTrigger } from "./WorkoutShareTrigger";

describe("WorkoutShareTrigger (feature madura: compartilhar treino)", () => {
  it("renderiza o botão de compartilhar sempre (mobile e desktop)", () => {
    render(<WorkoutShareTrigger focus="Peito + Tríceps" dayName="Treino A" />);
    expect(screen.getByTestId("workout-share-trigger")).toBeInTheDocument();
    expect(screen.getByText("Compartilhar treino")).toBeInTheDocument();
  });

  it("não mostra o modal até clicar (abre o fluxo no clique)", async () => {
    render(<WorkoutShareTrigger focus="Costas" />);
    expect(screen.queryByTestId("share-modal-stub")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("workout-share-trigger"));
    expect(screen.getByTestId("share-modal-stub")).toBeInTheDocument();
  });

  it("propaga o foco do treino para o card (independente da origem da ficha)", async () => {
    render(<WorkoutShareTrigger focus="Treino adaptado MaaS" />);
    await userEvent.click(screen.getByTestId("workout-share-trigger"));
    expect(screen.getByTestId("share-modal-stub")).toHaveTextContent("Treino adaptado MaaS");
  });
});
