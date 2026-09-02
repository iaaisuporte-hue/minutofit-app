import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mocka a lib de imagem (evita canvas no jsdom) e a camada nativa, que é quem
// decide se existe share sheet e o que acontece quando a permissão é negada.
const img = vi.hoisted(() => ({
  composeWorkoutImage: vi.fn(),
  copyShareText: vi.fn(),
  buildShareText: vi.fn(() => "texto seguro do treino"),
}));
const nat = vi.hoisted(() => ({
  podeCompartilharImagem: vi.fn(),
  compartilharArte: vi.fn(),
  salvarArte: vi.fn(),
  pedirFoto: vi.fn(),
}));
const plat = vi.hoisted(() => ({ isNativeApp: vi.fn(() => false), getPlatform: vi.fn(() => "web") }));

vi.mock("../lib/shareWorkoutImage", () => img);
vi.mock("../lib/nativeShare", () => nat);
vi.mock("../../../lib/platform", () => plat);

import { ShareWorkoutModal } from "./ShareWorkoutModal";

beforeEach(() => {
  vi.clearAllMocks();
  img.composeWorkoutImage.mockResolvedValue({
    blob: new Blob([""], { type: "image/jpeg" }),
    dataUrl: "data:image/jpeg;base64,xxx",
    focus: "Peito",
    format: "story",
  });
  img.copyShareText.mockResolvedValue(true);
  img.buildShareText.mockReturnValue("texto seguro do treino");
  plat.isNativeApp.mockReturnValue(false);
  nat.salvarArte.mockResolvedValue({ ok: true });
  nat.compartilharArte.mockResolvedValue({ ok: true });
});

async function montar(props: Partial<React.ComponentProps<typeof ShareWorkoutModal>> = {}) {
  render(<ShareWorkoutModal focus="Peito" onClose={props.onClose ?? (() => {})} {...props} />);
  await waitFor(() => expect(img.composeWorkoutImage).toHaveBeenCalled());
}

describe("ShareWorkoutModal — fallback de plataforma", () => {
  it("desktop (sem Web Share): mostra salvar e copiar, sem share sheet", async () => {
    nat.podeCompartilharImagem.mockReturnValue(false);
    await montar();
    expect(screen.getByText("Salvar imagem")).toBeInTheDocument();
    expect(screen.getByText("Copiar texto")).toBeInTheDocument();
    expect(screen.queryByText("Compartilhar")).not.toBeInTheDocument();
  });

  it("mobile/app: mostra o botão de compartilhar", async () => {
    nat.podeCompartilharImagem.mockReturnValue(true);
    await montar();
    expect(screen.getByText("Compartilhar")).toBeInTheDocument();
  });

  it("copiar texto usa o texto seguro (não vaza dado sensível)", async () => {
    nat.podeCompartilharImagem.mockReturnValue(false);
    await montar({ stats: { durationMin: 30 } });
    await userEvent.click(screen.getByText("Copiar texto"));
    expect(img.buildShareText).toHaveBeenCalledWith({
      focus: "Peito", dayName: undefined, stats: { durationMin: 30 },
    });
    expect(img.copyShareText).toHaveBeenCalledWith("texto seguro do treino");
  });
});

describe("ShareWorkoutModal — os dois formatos da SPEC", () => {
  it("oferece Story 9:16 e Feed 1:1 e recompõe ao trocar", async () => {
    nat.podeCompartilharImagem.mockReturnValue(false);
    await montar();
    expect(screen.getByText("Story 9:16")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Feed 1:1"));
    await waitFor(() =>
      expect(img.composeWorkoutImage).toHaveBeenLastCalledWith(
        expect.objectContaining({ format: "square" }),
      ),
    );
  });
});

describe("ShareWorkoutModal — feedback de ação (SPEC §19/§27)", () => {
  it("salvar com sucesso confirma na tela", async () => {
    nat.podeCompartilharImagem.mockReturnValue(false);
    await montar();
    await userEvent.click(screen.getByText("Salvar imagem"));
    expect(await screen.findByText("Imagem salva com sucesso.")).toBeInTheDocument();
  });

  it("falha ao salvar não fica silenciosa", async () => {
    nat.podeCompartilharImagem.mockReturnValue(false);
    nat.salvarArte.mockResolvedValue({ ok: false, motivo: "Não consegui salvar a imagem no aparelho." });
    await montar();
    await userEvent.click(screen.getByText("Salvar imagem"));
    expect(await screen.findByText("Não consegui salvar a imagem no aparelho.")).toBeInTheDocument();
  });
});

describe("ShareWorkoutModal — câmera no app empacotado (SPEC §12/§13)", () => {
  it("permissão negada explica e mantém a galeria como saída", async () => {
    plat.isNativeApp.mockReturnValue(true);
    nat.podeCompartilharImagem.mockReturnValue(true);
    nat.pedirFoto.mockResolvedValue({
      ok: false,
      permissaoNegada: true,
      motivo: "Para tirar uma foto do treino, permita o acesso à câmera nas configurações do aparelho.",
    });
    await montar();
    await userEvent.click(screen.getByText("Tirar foto"));
    expect(
      await screen.findByText(/permita o acesso à câmera nas configurações/i),
    ).toBeInTheDocument();
    // O fluxo não trava: a alternativa continua na tela.
    expect(screen.getByText("Galeria")).toBeInTheDocument();
  });

  it("cancelar a câmera não vira mensagem de erro", async () => {
    plat.isNativeApp.mockReturnValue(true);
    nat.podeCompartilharImagem.mockReturnValue(true);
    nat.pedirFoto.mockResolvedValue({ ok: false, cancelado: true });
    await montar();
    await userEvent.click(screen.getByText("Tirar foto"));
    await waitFor(() => expect(nat.pedirFoto).toHaveBeenCalledWith("camera"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("foto escolhida entra no card e confirma", async () => {
    plat.isNativeApp.mockReturnValue(true);
    nat.podeCompartilharImagem.mockReturnValue(true);
    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    nat.pedirFoto.mockResolvedValue({ ok: true, file });
    await montar();
    await userEvent.click(screen.getByText("Galeria"));
    await waitFor(() =>
      expect(img.composeWorkoutImage).toHaveBeenLastCalledWith(
        expect.objectContaining({ backgroundFile: file }),
      ),
    );
    expect(await screen.findByText("Foto adicionada ao card.")).toBeInTheDocument();
  });
});
