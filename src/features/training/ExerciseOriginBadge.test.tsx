import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExerciseOriginBadge } from "./ExerciseOriginBadge";

describe("ExerciseOriginBadge", () => {
  it("builder do personal: exercício global vira selo S2CORE", () => {
    render(<ExerciseOriginBadge ownerPersonalId={null} context="personal" />);
    expect(screen.getByText("S2CORE")).toBeInTheDocument();
  });

  it("builder do personal: exercício próprio vira 'Meu exercício'", () => {
    render(<ExerciseOriginBadge ownerPersonalId="42" context="personal" />);
    expect(screen.getByText("Meu exercício")).toBeInTheDocument();
  });

  it("picker do aluno: exercício global não ganha selo (densidade de lista mobile)", () => {
    const { container } = render(<ExerciseOriginBadge ownerPersonalId={null} context="student" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("picker do aluno: exercício do personal atribuído vira 'Do seu personal'", () => {
    render(<ExerciseOriginBadge ownerPersonalId="42" context="student" />);
    expect(screen.getByText("Do seu personal")).toBeInTheDocument();
  });

  it("usa as classes de badge do design system, nunca cor hardcoded", () => {
    render(<ExerciseOriginBadge ownerPersonalId={null} context="personal" />);
    expect(screen.getByText("S2CORE")).toHaveClass("badge", "badge-neutral");
  });

  it("variante compact reduz padding/fonte sem trocar a classe de cor", () => {
    render(<ExerciseOriginBadge ownerPersonalId="42" context="personal" compact />);
    const badge = screen.getByText("Meu exercício");
    expect(badge).toHaveClass("badge-brand");
    expect(badge.style.fontSize).toBe("10px");
  });
});
