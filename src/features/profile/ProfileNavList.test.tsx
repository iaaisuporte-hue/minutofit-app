import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProfileNavList, type ProfileNavSection } from "./ProfileNavList";

// O Perfil-hub é a casa dos destinos secundários (substitui o menu "⋯").
describe("ProfileNavList", () => {
  it("renderiza títulos, itens e dispara onClick (ex.: aparência)", async () => {
    const onAparencia = vi.fn();
    const sections: ProfileNavSection[] = [
      { title: "Minha rede", items: [{ label: "Minha equipe", to: "/app/user/equipe" }] },
      {
        title: "Atividade e conhecimento",
        items: [
          { label: "Atividades", to: "/app/user/activities" },
          { label: "Glossário", to: "/app/user/glossario" },
        ],
      },
      { title: "Aplicativo", items: [{ label: "Aparência", onClick: onAparencia, right: <span>Claro</span> }] },
    ];

    render(
      <MemoryRouter>
        <ProfileNavList sections={sections} />
      </MemoryRouter>,
    );

    for (const label of ["Minha equipe", "Atividades", "Glossário", "Aparência"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Minha rede")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Aparência"));
    expect(onAparencia).toHaveBeenCalledTimes(1);
  });
});
