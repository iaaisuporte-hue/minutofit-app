import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { __limparOverlays, fecharTopo } from "../../../lib/overlayStack";
import type { PhotoAdjust, PhotoLayers } from "../lib/sharePhotoSource";

// Mocka a lib de imagem (evita canvas no jsdom) e a camada nativa, que é quem
// decide se existe share sheet e o que acontece quando a permissão é negada.
const img = vi.hoisted(() => ({
  composeWorkoutImage: vi.fn(),
  copyShareText: vi.fn(),
  buildShareText: vi.fn(() => "texto seguro do treino"),
  // Usados pelo editor de foto. Sem canvas no jsdom o palco mede 0 e nada é
  // desenhado; o desenho tem teste próprio (SharePhotoEditor.test).
  computeCardLayout: vi.fn(),
  renderBackground: vi.fn(),
  renderForeground: vi.fn(),
  getLogo: vi.fn(async () => null),
}));
// Sessão de foto falsa com o contrato da real: `load` decodifica (ou rejeita),
// `setAdjust` devolve camadas novas só quando o valor muda.
const src = vi.hoisted(() => {
  const state = {
    session: null as null | {
      readonly layers: unknown;
      load: ReturnType<typeof vi.fn>;
      setAdjust: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    },
  };
  return {
    state,
    createPhotoSession: vi.fn(),
    disposeCanvas: vi.fn((c?: HTMLCanvasElement | null) => {
      if (c) { c.width = 0; c.height = 0; }
    }),
  };
});
const nat = vi.hoisted(() => ({
  podeCompartilharImagem: vi.fn(),
  compartilharArte: vi.fn(),
  salvarArte: vi.fn(),
  pedirFoto: vi.fn(),
}));
const plat = vi.hoisted(() => ({ isNativeApp: vi.fn(() => false), getPlatform: vi.fn(() => "web") }));

vi.mock("../lib/shareWorkoutImage", () => img);
vi.mock("../lib/sharePhotoSource", () => ({ createPhotoSession: src.createPhotoSession, disposeCanvas: src.disposeCanvas }));
vi.mock("../lib/nativeShare", () => nat);
vi.mock("../../../lib/platform", () => plat);

import { ShareWorkoutModal } from "./ShareWorkoutModal";

const FOTO = { width: 2000, height: 1500 } as HTMLCanvasElement;

function fakeSession() {
  const mk = (adjust: PhotoAdjust): PhotoLayers => ({ source: FOTO, adjusted: FOTO, glass: FOTO, adjust: { ...adjust } });
  let layers: PhotoLayers | null = null;
  const s = {
    get layers() { return layers; },
    load: vi.fn(async () => { layers = mk({ brightness: 1, contrast: 1 }); return layers; }),
    setAdjust: vi.fn((a: PhotoAdjust) => {
      if (!layers) return null;
      if (layers.adjust.brightness !== a.brightness || layers.adjust.contrast !== a.contrast) layers = mk(a);
      return layers;
    }),
    dispose: vi.fn(() => { layers = null; }),
  };
  return s;
}

beforeEach(() => {
  vi.clearAllMocks();
  __limparOverlays();
  src.state.session = fakeSession();
  src.createPhotoSession.mockImplementation(() => src.state.session);
  img.getLogo.mockResolvedValue(null);
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
    // A foto é decodificada uma vez e abre o editor; o card só é exportado
    // no "Concluir", com as camadas já decodificadas (não o File de novo).
    await waitFor(() => expect(src.state.session!.load).toHaveBeenCalledWith(file));
    await userEvent.click(await screen.findByRole("button", { name: "Concluir" }));
    await waitFor(() =>
      expect(img.composeWorkoutImage).toHaveBeenLastCalledWith(
        expect.objectContaining({ photoSource: src.state.session!.layers }),
      ),
    );
    expect(await screen.findByText("Foto adicionada ao card.")).toBeInTheDocument();
  });
});

const editor = () => screen.queryByRole("dialog", { name: "Ajustar foto" });

/** Web: escolhe a foto pelo `<input>` da galeria (o que não tem `capture`). */
async function escolherNaGaleriaWeb(container: HTMLElement, file = new File(["x"], "foto.jpg", { type: "image/jpeg" })) {
  const input = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(editor()).toBeInTheDocument());
  return file;
}

async function montarWeb(props: Partial<React.ComponentProps<typeof ShareWorkoutModal>> = {}) {
  nat.podeCompartilharImagem.mockReturnValue(true);
  const utils = render(<ShareWorkoutModal focus="Peito" onClose={props.onClose ?? (() => {})} {...props} />);
  await waitFor(() => expect(img.composeWorkoutImage).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Gerando…")).not.toBeInTheDocument());
  return utils;
}

describe("ShareWorkoutModal — editor de foto", () => {
  it("abre o editor depois da foto da câmera (nativo)", async () => {
    plat.isNativeApp.mockReturnValue(true);
    nat.podeCompartilharImagem.mockReturnValue(true);
    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    nat.pedirFoto.mockResolvedValue({ ok: true, file });
    await montar();
    await userEvent.click(screen.getByText("Tirar foto"));
    await waitFor(() => expect(editor()).toBeInTheDocument());
    expect(nat.pedirFoto).toHaveBeenCalledWith("camera");
    expect(src.state.session!.load).toHaveBeenCalledWith(file);
    // Editar não exporta nada.
    expect(img.composeWorkoutImage).toHaveBeenCalledTimes(1);
  });

  it("abre o editor depois da foto da galeria (web, via input)", async () => {
    const { container } = await montarWeb();
    const file = await escolherNaGaleriaWeb(container);
    expect(src.state.session!.load).toHaveBeenCalledWith(file);
    expect(screen.queryByRole("dialog", { name: "Compartilhar treino" })).not.toBeInTheDocument();
  });

  it("foto que não decodifica: fica na etapa share com a mensagem de sempre", async () => {
    const { container } = await montarWeb();
    src.state.session!.load.mockRejectedValueOnce(new Error("decode"));
    const input = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "ruim.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByText("Não consegui montar a imagem com essa foto. Tente outra.")).toBeInTheDocument();
    expect(editor()).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Compartilhar treino" })).toBeInTheDocument();
    expect(screen.queryByText("Ajustar foto")).not.toBeInTheDocument();
  });

  it("alternar formato 20× no editor não decodifica nem compõe", async () => {
    const { container } = await montarWeb();
    await escolherNaGaleriaWeb(container);
    const composeAntes = img.composeWorkoutImage.mock.calls.length;
    for (let i = 0; i < 20; i++) {
      fireEvent.click(screen.getByRole("button", { name: i % 2 === 0 ? "Feed 1:1" : "Story 9:16" }));
    }
    expect(src.state.session!.load).toHaveBeenCalledTimes(1);
    expect(img.composeWorkoutImage).toHaveBeenCalledTimes(composeAntes);
  });

  it("Concluir compõe uma vez com o formato e a edição daquele formato", async () => {
    const { container } = await montarWeb();
    await escolherNaGaleriaWeb(container);
    fireEvent.click(screen.getByRole("button", { name: "Feed 1:1" }));
    fireEvent.change(screen.getByLabelText("Brilho da foto"), { target: { value: "1.2" } });
    fireEvent.click(screen.getByRole("button", { name: "Forte" }));
    const composeAntes = img.composeWorkoutImage.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(img.composeWorkoutImage).toHaveBeenCalledTimes(composeAntes + 1));
    const layers = src.state.session!.layers as PhotoLayers;
    expect(layers.adjust).toEqual({ brightness: 1.2, contrast: 1 });
    expect(img.composeWorkoutImage).toHaveBeenLastCalledWith({
      focus: "Peito",
      exercises: undefined,
      eyebrow: undefined,
      panelLabel: undefined,
      format: "square",
      photoSource: layers,
      photoAdjust: { zoom: 1, offsetX: 0, offsetY: 0 },
      overlay: "strong",
    });
    expect(editor()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Feed 1:1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("trocar formato na etapa share recompõe com a edição salva daquele formato, sem decodificar", async () => {
    const { container } = await montarWeb();
    await escolherNaGaleriaWeb(container);
    fireEvent.click(screen.getByRole("button", { name: "Suave" }));
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(screen.getByText("Ajustar foto")).toBeEnabled());
    await userEvent.click(screen.getByText("Feed 1:1"));
    await waitFor(() =>
      expect(img.composeWorkoutImage).toHaveBeenLastCalledWith(
        expect.objectContaining({ format: "square", overlay: "medium", photoSource: src.state.session!.layers }),
      ),
    );
    await waitFor(() => expect(screen.getByText("Story 9:16")).toBeEnabled());
    await userEvent.click(screen.getByText("Story 9:16"));
    await waitFor(() =>
      expect(img.composeWorkoutImage).toHaveBeenLastCalledWith(
        expect.objectContaining({ format: "story", overlay: "soft" }),
      ),
    );
    expect(src.state.session!.load).toHaveBeenCalledTimes(1);
  });

  it("Voltar mantém a foto e descarta os ajustes desta abertura", async () => {
    const { container } = await montarWeb();
    await escolherNaGaleriaWeb(container);
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(screen.getByText("Ajustar foto")).toBeEnabled());

    // Segunda abertura: mexe e volta.
    await userEvent.click(screen.getByText("Ajustar foto"));
    expect(editor()).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Brilho da foto"), { target: { value: "1.3" } });
    fireEvent.click(screen.getByRole("button", { name: "Forte" }));
    const composeAntes = img.composeWorkoutImage.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(editor()).not.toBeInTheDocument();
    // A prévia já tinha a foto: nada a recompor.
    expect(img.composeWorkoutImage).toHaveBeenCalledTimes(composeAntes);
    expect(screen.getByText("Ajustar foto")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Ajustar foto"));
    expect((screen.getByLabelText("Brilho da foto") as HTMLInputElement).value).toBe("1");
    expect(screen.getByRole("button", { name: "Médio" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Voltar logo após escolher a foto mantém a foto na prévia", async () => {
    const { container } = await montarWeb();
    await escolherNaGaleriaWeb(container);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() =>
      expect(img.composeWorkoutImage).toHaveBeenLastCalledWith(
        expect.objectContaining({ photoSource: src.state.session!.layers, overlay: "medium" }),
      ),
    );
    expect(await screen.findByText("Ajustar foto")).toBeInTheDocument();
  });

  it("voltar do Android no editor volta para a etapa share em vez de fechar", async () => {
    const onClose = vi.fn();
    const { container } = await montarWeb({ onClose });
    await escolherNaGaleriaWeb(container);
    act(() => {
      expect(fecharTopo()).toBe(true);
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(editor()).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Compartilhar treino" })).toBeInTheDocument();
    act(() => {
      expect(fecharTopo()).toBe(true);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clique no fundo não fecha durante a edição", async () => {
    const onClose = vi.fn();
    const { container } = await montarWeb({ onClose });
    await escolherNaGaleriaWeb(container);
    fireEvent.click(container.querySelector('[role="presentation"]')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("unmount libera a sessão da foto", async () => {
    const { container, unmount } = await montarWeb();
    await escolherNaGaleriaWeb(container);
    unmount();
    expect(src.state.session!.dispose).toHaveBeenCalled();
  });
});
