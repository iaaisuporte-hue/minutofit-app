import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mocka a lib de imagem (evita canvas no jsdom) e controla a capacidade de
// share nativo para exercitar o FALLBACK desktop (baixar/copiar). vi.hoisted
// porque o factory do vi.mock é içado p/ o topo do arquivo.
const m = vi.hoisted(() => ({
  composeWorkoutImage: vi.fn(),
  canShareWorkoutImage: vi.fn(),
  copyShareText: vi.fn(),
  downloadComposedImage: vi.fn(),
  shareImageBlob: vi.fn(),
  buildShareText: vi.fn(() => "texto seguro do treino"),
}));

vi.mock("../lib/shareWorkoutImage", () => m);

import { ShareWorkoutModal } from "./ShareWorkoutModal";
const { composeWorkoutImage, canShareWorkoutImage, copyShareText, buildShareText } = m;

beforeEach(() => {
  vi.clearAllMocks();
  composeWorkoutImage.mockResolvedValue({
    blob: new Blob([""], { type: "image/jpeg" }),
    dataUrl: "data:image/jpeg;base64,xxx",
    focus: "Peito",
    format: "story",
  });
  copyShareText.mockResolvedValue(true);
});

describe("ShareWorkoutModal — fallback de plataforma", () => {
  it("desktop (sem Web Share): mostra baixar e copiar, sem share nativo", async () => {
    canShareWorkoutImage.mockReturnValue(false);
    render(<ShareWorkoutModal focus="Peito" onClose={() => {}} />);
    await waitFor(() => expect(composeWorkoutImage).toHaveBeenCalled());
    expect(screen.getByText("Baixar imagem")).toBeInTheDocument();
    expect(screen.getByText("Copiar texto")).toBeInTheDocument();
    expect(screen.queryByText("Compartilhar nos Stories")).not.toBeInTheDocument();
  });

  it("mobile (com Web Share): mostra compartilhar nos Stories", async () => {
    canShareWorkoutImage.mockReturnValue(true);
    render(<ShareWorkoutModal focus="Peito" onClose={() => {}} />);
    await waitFor(() => expect(composeWorkoutImage).toHaveBeenCalled());
    expect(screen.getByText("Compartilhar nos Stories")).toBeInTheDocument();
  });

  it("copiar texto usa o texto seguro (não vaza dado sensível)", async () => {
    canShareWorkoutImage.mockReturnValue(false);
    render(<ShareWorkoutModal focus="Peito" stats={{ durationMin: 30 }} onClose={() => {}} />);
    await waitFor(() => expect(composeWorkoutImage).toHaveBeenCalled());
    await userEvent.click(screen.getByText("Copiar texto"));
    expect(buildShareText).toHaveBeenCalledWith({ focus: "Peito", dayName: undefined, stats: { durationMin: 30 } });
    expect(copyShareText).toHaveBeenCalledWith("texto seguro do treino");
  });
});
