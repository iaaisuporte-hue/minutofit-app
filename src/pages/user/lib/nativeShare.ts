// Compartilhar, salvar e capturar foto — caminho nativo do app empacotado.
//
// Por que este arquivo existe: no app Capacitor NENHUMA das três APIs web que
// a tela usava funciona, e todas falham em SILÊNCIO, que é o pior modo de
// falhar (QA mobile set/2026):
//
//  - `navigator.share` não existe no WebView do Android. O botão "Compartilhar
//    nos Stories" simplesmente sumia — a função principal da tela.
//  - `<a download>` com data:/blob: é inerte no WebView. "Baixar imagem" não
//    baixava nada e não dizia nada.
//  - `<input type=file capture>` abre a câmera, mas quando a permissão é negada
//    o chooser fecha sem evento nenhum: nada acontece e não há como explicar.
//
// Na web (PWA/desktop) tudo continua pelo caminho antigo — as funções abaixo
// decidem sozinhas, e quem chama não precisa saber em que plataforma está.

import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNativeApp } from "../../../lib/platform";
import type { ComposedImage, WorkoutShareStats } from "./shareWorkoutImage";
import { buildShareText } from "./shareWorkoutImage";

const BRAND = "S2Core";

/** Base64 puro (sem o prefixo `data:...;base64,`) — é o que o Filesystem quer. */
function base64Puro(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

function nomeArquivo(ext = "jpg"): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `s2core-treino-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

/** Resultado de uma ação: a UI transforma em toast de sucesso/erro/cancelado. */
export type AcaoResultado =
  | { ok: true }
  | { ok: false; cancelado: true }
  | { ok: false; cancelado?: false; motivo: string };

/**
 * Há um caminho de compartilhamento com imagem nesta plataforma?
 * Nativo: sempre. Web: só com Web Share API capaz de arquivo.
 */
export function podeCompartilharImagem(): boolean {
  if (isNativeApp()) return true;
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    const probe = new File([new Blob([""], { type: "image/png" })], "probe.png", { type: "image/png" });
    return nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Abre o share sheet do sistema com a arte do treino (Instagram, WhatsApp,
 * Telegram, o que estiver instalado). No nativo o arquivo precisa existir em
 * disco: o plugin compartilha por URI, não por blob.
 */
export async function compartilharArte(
  image: ComposedImage,
  stats?: WorkoutShareStats | null,
): Promise<AcaoResultado> {
  const texto = buildShareText({ focus: image.focus, stats });

  if (isNativeApp()) {
    try {
      // Cache: some com a limpeza do sistema. A arte é descartável — o que
      // importa preservar é o treino, que já está no servidor.
      const escrita = await Filesystem.writeFile({
        path: nomeArquivo(),
        data: base64Puro(image.dataUrl),
        directory: Directory.Cache,
      });
      await Share.share({
        title: `${BRAND} — treino concluído`,
        text: texto,
        files: [escrita.uri],
        dialogTitle: "Compartilhar treino",
      });
      return { ok: true };
    } catch (err) {
      if (foiCancelado(err)) return { ok: false, cancelado: true };
      return { ok: false, motivo: "Não consegui abrir o compartilhamento agora." };
    }
  }

  // Web / PWA
  try {
    const file = new File([image.blob], "treino.jpg", { type: image.blob.type || "image/jpeg" });
    const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
    if (typeof nav.share !== "function") return { ok: false, motivo: "Compartilhamento indisponível." };
    if (typeof nav.canShare === "function" && !nav.canShare({ files: [file] })) {
      return { ok: false, motivo: "Compartilhamento indisponível." };
    }
    await navigator.share({ files: [file], title: `${BRAND} — treino concluído`, text: texto });
    return { ok: true };
  } catch (err) {
    if (foiCancelado(err)) return { ok: false, cancelado: true };
    return { ok: false, motivo: "Não consegui abrir o compartilhamento agora." };
  }
}

/**
 * Salva a arte no aparelho.
 *
 * Android: `Directory.Documents` grava em armazenamento compartilhado sem pedir
 * permissão a partir do Android 10 (escopo por app). Não usamos a galeria: isso
 * exigiria WRITE_EXTERNAL_STORAGE/MediaStore e uma permissão a mais, que a
 * SPEC §13 manda evitar quando não é indispensável. Quem quer a foto na
 * galeria usa "Compartilhar" → "Salvar imagem" do próprio sistema.
 */
export async function salvarArte(image: ComposedImage): Promise<AcaoResultado> {
  if (isNativeApp()) {
    try {
      await Filesystem.writeFile({
        path: nomeArquivo(),
        data: base64Puro(image.dataUrl),
        directory: Directory.Documents,
        recursive: true,
      });
      return { ok: true };
    } catch {
      return { ok: false, motivo: "Não consegui salvar a imagem no aparelho." };
    }
  }

  try {
    if (typeof document === "undefined") return { ok: false, motivo: "Indisponível." };
    const a = document.createElement("a");
    a.href = image.dataUrl;
    a.download = nomeArquivo();
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não consegui salvar a imagem." };
  }
}

/** De onde vem a foto de fundo. */
export type OrigemFoto = "camera" | "galeria";

export type FotoResultado =
  | { ok: true; file: File }
  | { ok: false; cancelado: true }
  | { ok: false; cancelado?: false; permissaoNegada: boolean; motivo: string };

/**
 * Pede uma foto ao aparelho.
 *
 * A permissão de câmera só é solicitada AQUI, no toque de "Tirar foto" — nunca
 * no boot (SPEC §13). Negada, devolvemos `permissaoNegada` para a tela poder
 * explicar e oferecer a galeria, em vez de não fazer nada.
 *
 * `width: 1600` limita o bitmap na origem: a foto de um celular moderno tem
 * ~4000px de lado e o canvas do card só usa 1080 — decodificar o original
 * inteiro é memória jogada fora e é onde aparelhos de entrada travam (§36).
 * O plugin também já corrige a orientação EXIF ao reamostrar.
 */
export async function pedirFoto(origem: OrigemFoto): Promise<FotoResultado> {
  if (!isNativeApp()) {
    return { ok: false, permissaoNegada: false, motivo: "web" };
  }
  try {
    if (origem === "camera") {
      const perm = await Camera.checkPermissions();
      if (perm.camera !== "granted") {
        const pedido = await Camera.requestPermissions({ permissions: ["camera"] });
        if (pedido.camera !== "granted") {
          return {
            ok: false,
            permissaoNegada: true,
            motivo:
              "Para tirar uma foto do treino, permita o acesso à câmera nas configurações do aparelho.",
          };
        }
      }
    }

    const foto = await Camera.getPhoto({
      quality: 82,
      width: 1600,
      resultType: CameraResultType.Base64,
      // `Photos` usa o seletor nativo moderno: o app recebe só a imagem
      // escolhida e não pede acesso à biblioteca inteira (SPEC §14).
      source: origem === "camera" ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
      saveToGallery: false,
    });

    if (!foto.base64String) {
      return { ok: false, permissaoNegada: false, motivo: "Não recebi a imagem do aparelho." };
    }
    const bin = atob(foto.base64String);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const tipo = foto.format === "png" ? "image/png" : "image/jpeg";
    const file = new File([bytes], `foto.${foto.format || "jpg"}`, { type: tipo });
    return { ok: true, file };
  } catch (err) {
    if (foiCancelado(err)) return { ok: false, cancelado: true };
    const msg = String((err as { message?: string })?.message ?? err);
    if (/permission|denied|not authorized/i.test(msg)) {
      return {
        ok: false,
        permissaoNegada: true,
        motivo:
          origem === "camera"
            ? "Para tirar uma foto do treino, permita o acesso à câmera nas configurações do aparelho."
            : "Para escolher uma foto, permita o acesso às fotos nas configurações do aparelho.",
      };
    }
    return { ok: false, permissaoNegada: false, motivo: "Não consegui abrir a câmera agora." };
  }
}

/** Cancelamento do usuário não é erro — nem toast, nem Sentry. */
function foiCancelado(err: unknown): boolean {
  const e = err as { name?: string; message?: string };
  const msg = String(e?.message ?? "");
  return (
    e?.name === "AbortError" ||
    /cancel|dismiss|user denied.*share|no activity|share canceled/i.test(msg)
  );
}
