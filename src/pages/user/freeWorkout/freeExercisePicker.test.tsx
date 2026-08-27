/**
 * Vazio do seletor com chip de grupo ligado.
 *
 * Buscar "supino" com o chip "Costas" ativo devolve nada — e o aluno concluía
 * que o app não tem supino, quando tem dez, escondidos pelo filtro. O vazio
 * precisa dizer ONDE procurou e oferecer a saída sem obrigar a apagar o que
 * digitou.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const searchExercises = vi.fn().mockResolvedValue([]);
vi.mock("../../../services/exercisesApi", () => ({
  searchExercises: (...args: unknown[]) => searchExercises(...args),
}));

import { FreeExercisePickerSheet } from "./FreeExercisePickerSheet";

function abrirFolha() {
  return render(
    <FreeExercisePickerSheet
      open
      onClose={() => {}}
      onAdd={() => {}}
      selectedIds={new Set<string>()}
    />,
  );
}

describe("FreeExercisePickerSheet — busca sem resultado", () => {
  it("diz que o filtro de grupo está ativo e oferece buscar em todos", async () => {
    const user = userEvent.setup();
    abrirFolha();

    await user.click(screen.getByRole("button", { name: "Costas" }));
    await user.type(screen.getByLabelText("Buscar exercício"), "supino");

    expect(
      await screen.findByText('Nenhum exercício de Costas encontrado para "supino".'),
    ).toBeInTheDocument();

    const saida = screen.getByRole("button", { name: "Buscar em todos os grupos" });
    await user.click(saida);

    // O texto digitado permanece: tirar o filtro não pode custar a busca.
    expect(screen.getByLabelText("Buscar exercício")).toHaveValue("supino");
    expect(screen.getByRole("button", { name: "Costas" })).toHaveAttribute("aria-pressed", "false");
    expect(
      await screen.findByText('Nenhum exercício encontrado para "supino".'),
    ).toBeInTheDocument();
    expect(searchExercises).toHaveBeenLastCalledWith(
      expect.objectContaining({ bodyPart: undefined, q: "supino" }),
    );
  });
});
