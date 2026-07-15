import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MobileBottomNav from "./MobileBottomNav";

// Contrato: o bottom nav do aluno tem EXATAMENTE 5 abas fixas, sem itens
// condicionais (regressão da Frente 1.1 / revisão mobile).
describe("MobileBottomNav", () => {
  it("renderiza exatamente as 5 abas fixas", () => {
    render(
      <MemoryRouter>
        <MobileBottomNav baseUrl="/app/user" />
      </MemoryRouter>,
    );
    for (const label of ["Hoje", "Treino", "Alimentação", "Evolução", "Perfil"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Nenhum item a mais (ex.: "Sair", "Atividades", "Mensagens" saíram do nav).
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
  });
});
