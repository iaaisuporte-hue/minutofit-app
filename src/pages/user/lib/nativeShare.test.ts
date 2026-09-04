import { beforeEach, describe, expect, it, vi } from "vitest";

const writeFile = vi.fn();
const share = vi.fn();
const isNativeApp = vi.fn();

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: (...a: unknown[]) => writeFile(...a) },
  Directory: { Cache: "CACHE", Documents: "DOCUMENTS" },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: (...a: unknown[]) => share(...a) } }));
vi.mock("@capacitor/camera", () => ({
  Camera: { getPhoto: vi.fn(), checkPermissions: vi.fn(), requestPermissions: vi.fn() },
  CameraResultType: { Base64: "base64" },
  CameraSource: { Camera: "CAMERA", Photos: "PHOTOS" },
}));
vi.mock("../../../lib/platform", () => ({ isNativeApp: () => isNativeApp() }));

const { salvarArte } = await import("./nativeShare");

const arte = {
  dataUrl: "data:image/jpeg;base64,AAAA",
  blob: new Blob(["x"], { type: "image/jpeg" }),
  focus: "peito",
} as unknown as Parameters<typeof salvarArte>[0];

beforeEach(() => {
  writeFile.mockReset().mockResolvedValue({ uri: "file:///cache/treino.jpg" });
  share.mockReset().mockResolvedValue(undefined);
  isNativeApp.mockReset();
});

describe("salvarArte no app empacotado (P0.4)", () => {
  beforeEach(() => isNativeApp.mockReturnValue(true));

  it("NÃO grava em Documents — esse caminho nunca chegou à galeria no Android moderno", async () => {
    await salvarArte(arte);
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.calls[0][0].directory).toBe("CACHE");
    expect(writeFile.mock.calls[0][0].directory).not.toBe("DOCUMENTS");
  });

  it("entrega o arquivo ao seletor do sistema, que é quem sabe salvar na galeria", async () => {
    const r = await salvarArte(arte);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].files).toEqual(["file:///cache/treino.jpg"]);
    expect(share.mock.calls[0][0].dialogTitle).toBe("Salvar imagem");
    expect(r).toEqual({ ok: true, escolhaDoSistema: true });
  });

  it("marca escolhaDoSistema para a tela não afirmar um sucesso que não pode verificar", async () => {
    const r = await salvarArte(arte);
    expect(r.ok && r.escolhaDoSistema).toBe(true);
  });

  it("fechar a folha é cancelamento, não erro", async () => {
    share.mockRejectedValue(new Error("Share canceled"));
    expect(await salvarArte(arte)).toEqual({ ok: false, cancelado: true });
  });

  it("falha real vira mensagem específica, não alerta genérico", async () => {
    writeFile.mockRejectedValue(new Error("EACCES"));
    const r = await salvarArte(arte);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.cancelado).toBeFalsy();
    expect(r).toMatchObject({ motivo: "Não consegui salvar a imagem no aparelho." });
  });
});

describe("salvarArte na web — comportamento preservado", () => {
  beforeEach(() => isNativeApp.mockReturnValue(false));

  it("continua baixando pelo link, sem tocar em plugin nativo", async () => {
    const click = vi.fn();
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = original(tag) as HTMLElement;
      if (tag === "a") (el as HTMLAnchorElement).click = click;
      return el;
    });
    const r = await salvarArte(arte);
    expect(r).toEqual({ ok: true });
    expect(click).toHaveBeenCalledTimes(1);
    expect(writeFile).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
