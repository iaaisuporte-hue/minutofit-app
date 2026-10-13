import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimelineSummary } from "./RelationshipTimeline";

// jsdom não faz layout: simulamos o corte medindo scrollHeight/clientHeight do <p>.
function mockLayout(clamped: { scroll: number; client: number }) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => clamped.scroll });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => clamped.client });
}

afterEach(() => {
  // @ts-expect-error restaura o comportamento do jsdom
  delete HTMLElement.prototype.scrollHeight;
  // @ts-expect-error restaura o comportamento do jsdom
  delete HTMLElement.prototype.clientHeight;
});

const LONG = "Aluno relatou dificuldade em manter a frequência nos dias úteis; combinar treino curto de 30 minutos.";

describe("TimelineSummary", () => {
  it("texto que cabe em 2 linhas não ganha botão", () => {
    mockLayout({ scroll: 30, client: 30 });
    render(<TimelineSummary text="Curto" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("texto cortado: mostra a prévia e o botão; o texto completo continua no DOM", () => {
    mockLayout({ scroll: 90, client: 32 });
    render(<TimelineSummary text={LONG} />);
    const btn = screen.getByRole("button", { name: "Ver mais" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(LONG)).toHaveClass("pp-timeline-summary--clamped");
  });

  it("expande e recolhe por toque e por teclado, mantendo o foco no controle", async () => {
    mockLayout({ scroll: 90, client: 32 });
    const user = userEvent.setup();
    render(<TimelineSummary text={LONG} />);

    await user.click(screen.getByRole("button", { name: "Ver mais" }));
    const less = screen.getByRole("button", { name: "Ver menos" });
    expect(less).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(LONG)).not.toHaveClass("pp-timeline-summary--clamped");

    less.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Ver mais" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(LONG)).toHaveClass("pp-timeline-summary--clamped");

    screen.getByRole("button", { name: "Ver mais" }).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Ver menos" })).toBeInTheDocument();
  });
});
