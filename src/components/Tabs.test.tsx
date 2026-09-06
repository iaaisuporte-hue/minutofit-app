import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

const TABS = [
  { id: "plano", label: "Plano" },
  { id: "adesao", label: "Adesão" },
  { id: "contexto", label: "Contexto" },
];

// SPEC 036 §29/§45 — a TabBar do Nutri era 8 botões sem role="tablist" nem
// navegação por teclado. Este componente é o primitivo global que qualquer
// tela profissional (Personal, Nutri, futuros papéis) deve reusar em vez de
// reimplementar a semântica ARIA à mão.
describe("Tabs", () => {
  it("expõe role=tablist/tab e aria-selected na aba ativa", () => {
    render(<Tabs tabs={TABS} active="adesao" onSelect={() => {}} idPrefix="t" />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Adesão" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Plano" })).toHaveAttribute("aria-selected", "false");
  });

  it("aria-controls do botão bate com o id que tabPanelProps geraria", () => {
    render(<Tabs tabs={TABS} active="plano" onSelect={() => {}} idPrefix="t" />);
    expect(screen.getByRole("tab", { name: "Plano" })).toHaveAttribute("aria-controls", "t-panel-plano");
    expect(screen.getByRole("tab", { name: "Plano" })).toHaveAttribute("id", "t-tab-plano");
  });

  it("clique chama onSelect com o id da aba", async () => {
    const onSelect = vi.fn();
    render(<Tabs tabs={TABS} active="plano" onSelect={onSelect} idPrefix="t" />);
    await userEvent.click(screen.getByRole("tab", { name: "Contexto" }));
    expect(onSelect).toHaveBeenCalledWith("contexto");
  });

  it("seta direita move o foco e seleciona a próxima aba; seta esquerda volta", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<Tabs tabs={TABS} active="plano" onSelect={onSelect} idPrefix="t" />);
    screen.getByRole("tab", { name: "Plano" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenCalledWith("adesao");
    rerender(<Tabs tabs={TABS} active="adesao" onSelect={onSelect} idPrefix="t" />);
    expect(screen.getByRole("tab", { name: "Adesão" })).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(onSelect).toHaveBeenCalledWith("plano");
  });

  it("Home e End pulam para a primeira/última aba", async () => {
    const onSelect = vi.fn();
    render(<Tabs tabs={TABS} active="adesao" onSelect={onSelect} idPrefix="t" />);
    screen.getByRole("tab", { name: "Adesão" }).focus();
    await userEvent.keyboard("{End}");
    expect(onSelect).toHaveBeenCalledWith("contexto");
    await userEvent.keyboard("{Home}");
    expect(onSelect).toHaveBeenCalledWith("plano");
  });

  it("só a aba ativa é alcançável por Tab (roving tabindex)", () => {
    render(<Tabs tabs={TABS} active="adesao" onSelect={() => {}} idPrefix="t" />);
    expect(screen.getByRole("tab", { name: "Adesão" })).toHaveAttribute("tabIndex", "0");
    expect(screen.getByRole("tab", { name: "Plano" })).toHaveAttribute("tabIndex", "-1");
    expect(screen.getByRole("tab", { name: "Contexto" })).toHaveAttribute("tabIndex", "-1");
  });
});
