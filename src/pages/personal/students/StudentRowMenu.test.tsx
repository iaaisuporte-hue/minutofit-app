import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StudentRowMenu } from "./StudentRowMenu";

function setup(onRemove = vi.fn()) {
  render(
    <MemoryRouter>
      <StudentRowMenu
        label="Mais ações para Maria"
        items={[
          { kind: "link", label: "Ver ficha(s)", to: "/app/personal/students/1/workouts" },
          { kind: "link", label: "Criar treino", to: "/app/personal/students/1/workouts/builder" },
          { kind: "button", label: "Retirar", danger: true, onSelect: onRemove },
        ]}
      />
    </MemoryRouter>,
  );
  return { onRemove, user: userEvent.setup() };
}

describe("StudentRowMenu", () => {
  it("expõe todas as ações existentes (nenhuma foi removida) num menu acessível", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Mais ações para Maria" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Ver ficha(s)", "Criar treino", "Retirar"]);
  });

  it("a ação destrutiva é separada e diferenciada, e dispara o fluxo existente de confirmação", async () => {
    const { onRemove, user } = setup();
    await user.click(screen.getByRole("button", { name: "Mais ações para Maria" }));
    expect(screen.getByRole("separator")).toBeInTheDocument();
    const remove = screen.getByRole("menuitem", { name: "Retirar" });
    expect(remove).toHaveClass("pp-row-menu__item--danger");
    await user.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("teclado: o foco vai ao 1º item, setas navegam e circulam, Escape fecha e devolve o foco ao gatilho", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Mais ações para Maria" });
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("menuitem", { name: "Ver ficha(s)" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Criar treino" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Retirar" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Ver ficha(s)" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("clique fora fecha sem devolver foco forçado", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Mais ações para Maria" }));
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
