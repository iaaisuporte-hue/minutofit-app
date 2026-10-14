import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logout = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ logout, user: { name: "Nutri" } }) }));
vi.mock("../layout/AppShell", () => ({
  default: ({ mobileHeader, sidebar, children }: { mobileHeader: React.ReactNode; sidebar: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <header>{mobileHeader}</header>
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  ),
}));
vi.mock("../components/S2CoreLogo", () => ({ default: () => <span>logo</span> }));
vi.mock("./nutri/NutriTodayPage", () => ({ default: () => <div>hoje</div> }));
vi.mock("./nutri/NutritionPatientsPage", () => ({ default: () => <div>pacientes</div> }));
vi.mock("./nutri/PatientDetailNutriPage", () => ({ default: () => <div>detalhe</div> }));
vi.mock("./nutri/CreatePlanPage", () => ({ default: () => <div>plano</div> }));
vi.mock("./nutri/ConvitesPage", () => ({ default: () => <div>convites</div> }));
vi.mock("./professional/NetworkProfilePage", () => ({ default: () => <div>perfil</div> }));

import NutriApp from "./NutriApp";
import { __limparOverlays, fecharTopo } from "../lib/overlayStack";

const menu = () => document.querySelector("details.navDisclosure") as HTMLDetailsElement;
const abrir = () => {
  menu().open = true;
  fireEvent(menu(), new Event("toggle"));
};

describe("Nutri — menu mobile (N1)", () => {
  beforeEach(() => {
    logout.mockClear();
    __limparOverlays();
  });

  it("fecha o menu ao navegar por um link do painel", async () => {
    render(<MemoryRouter initialEntries={["/app/nutri"]}><NutriApp /></MemoryRouter>);
    abrir();
    expect(menu().open).toBe(true);
    fireEvent.click(menu().querySelector('a[href="/app/nutri/pacientes"]') as HTMLElement);
    await waitFor(() => expect(menu().open).toBe(false));
  });

  it("fecha com o botão voltar (pilha de overlays) antes de qualquer navegação", async () => {
    render(<MemoryRouter initialEntries={["/app/nutri"]}><NutriApp /></MemoryRouter>);
    abrir();
    await waitFor(() => expect(fecharTopo()).toBe(true));
    expect(menu().open).toBe(false);
    expect(fecharTopo()).toBe(false);
  });

  it("Sair da conta pede confirmação e só encerra a sessão ao confirmar", async () => {
    render(<MemoryRouter initialEntries={["/app/nutri"]}><NutriApp /></MemoryRouter>);
    abrir();
    fireEvent.click(menu().querySelector("button.logoutButton") as HTMLElement);
    expect(menu().open).toBe(false);
    expect(logout).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).toContain("Sair da conta?");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(logout).not.toHaveBeenCalled();
    fireEvent.click(menu().querySelector("button.logoutButton") as HTMLElement);
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("o Sair da barra lateral (desktop) também confirma", async () => {
    render(<MemoryRouter initialEntries={["/app/nutri"]}><NutriApp /></MemoryRouter>);
    fireEvent.click(document.querySelector("aside button.logoutButton") as HTMLElement);
    expect(logout).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
