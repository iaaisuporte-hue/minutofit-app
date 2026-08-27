import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Stub do modal (evita o canvas/Web Share); só precisamos provar que o botão
// existe e ABRE o fluxo de compartilhamento — esta é a regressão que protegemos.
vi.mock("./ShareWorkoutModal", () => ({
  ShareWorkoutModal: (props: { focus: string; exercises?: { name: string }[] | null }) =>
    React.createElement(
      "div",
      { "data-testid": "share-modal-stub" },
      `${props.focus}|${(props.exercises ?? []).map((e) => e.name).join(",")}`,
    ),
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

  // A arte tem que mostrar o que foi TREINADO. Chamado a partir de uma tela de
  // plano, o gatilho recebe a ficha prescrita nas props — se ele publicasse
  // isso, quem fez treino livre compartilharia o treino que NÃO fez.
  it("prefere a sessão executada às props da ficha quando há resolver", async () => {
    const resolveShareData = vi.fn().mockResolvedValue({
      focus: "Costas e Ombros",
      dayName: "Treino livre",
      stats: { doneSets: 17, totalSets: 17 },
      exercises: [{ name: "Remada Baixa no Cabo", sets: 3, reps: "12" }],
    });

    render(
      <WorkoutShareTrigger
        focus="Treino B"
        exercises={[{ name: "Supino reto", sets: 4, reps: "10" }]}
        resolveShareData={resolveShareData}
      />,
    );
    await userEvent.click(screen.getByTestId("workout-share-trigger"));

    const modal = await screen.findByTestId("share-modal-stub");
    expect(modal).toHaveTextContent("Costas e Ombros");
    expect(modal).toHaveTextContent("Remada Baixa no Cabo");
    expect(modal).not.toHaveTextContent("Supino reto");
    expect(modal).not.toHaveTextContent("Treino B");
  });

  it("avisa em vez de abrir card vazio quando não há sessão do dia", async () => {
    render(<WorkoutShareTrigger focus="Treino B" resolveShareData={vi.fn().mockResolvedValue(null)} />);
    await userEvent.click(screen.getByTestId("workout-share-trigger"));
    expect(await screen.findByRole("status")).toHaveTextContent(/não encontrei o treino de hoje/i);
    expect(screen.queryByTestId("share-modal-stub")).not.toBeInTheDocument();
  });
});
