// Pipeline da foto do card de compartilhamento: decodifica UMA vez, normaliza
// o tamanho e deriva as cópias que o desenho por frame consome.
//
// Por que existe: o editor redesenha a cada gesto, e decodificar o arquivo ou
// rodar filtro de cor por frame trava o celular. Brilho/contraste não dependem
// de zoom/posição, então são aplicados na FONTE quando o slider muda — o frame
// só faz `drawImage`. Em memória ficam no máximo: fonte, fonte ajustada, vidro
// pequeno (+1 transitória durante a troca de ajuste ou de foto).

import { DEFAULT_ADJUST, type PhotoAdjust } from "./sharePhotoTransform";

// 2048px no lado maior cobre o Story (1920) com folga; acima disso só gasta
// memória (uma foto de 12 MP crua são ~48 MB em RGBA, e o WebView mata a aba).
export const MAX_SOURCE_EDGE = 2048;

// Fração do vidro em relação à fonte: o painel só mostra a foto borrada, então
// 1/8 basta e custa ~1/64 da memória.
const GLASS_FRACTION = 1 / 8;
// Raio do blur do vidro, em px do CARD. É o `blur(22px)` que o painel sempre usou.
const GLASS_BLUR_CARD_PX = 22;

/**
 * Libera os pixels de um canvas já. O GC sozinho demora — em WebView com foto
 * grande, três buffers esquecidos bastam para a aba ser morta.
 */
export function disposeCanvas(c: HTMLCanvasElement | null | undefined): void {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

/** Cabe (w, h) em `max` no lado maior mantendo a proporção. Nunca amplia. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const k = max / long;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function context2d(c: HTMLCanvasElement, opts?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const ctx = c.getContext("2d", opts);
  if (!ctx) {
    disposeCanvas(c);
    throw new Error("canvas indisponível");
  }
  return ctx;
}

/**
 * `<img>` + `decode()`. O WebKit rejeita `decode()` em algumas fotos grandes
 * mesmo carregando a imagem — por isso a rejeição não é fatal: se a imagem já
 * tem pixels, segue; se ainda está carregando, espera o `onload`.
 */
async function decodeImage(img: HTMLImageElement): Promise<void> {
  const viaEvents = () =>
    new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("falha ao decodificar a foto"));
    });
  if (typeof img.decode !== "function") return viaEvents();
  try {
    await img.decode();
  } catch {
    if (img.complete) {
      if (img.naturalWidth > 0) return;
      throw new Error("falha ao decodificar a foto");
    }
    await viaEvents();
  }
}

/**
 * Decodifica o arquivo num canvas destacado de no máximo `MAX_SOURCE_EDGE`.
 *
 * Usa só `<img>`, sem `createImageBitmap`: a orientação EXIF de bitmap mudou de
 * padrão entre versões de engine (foto da galeria sairia deitada em parte dos
 * aparelhos), enquanto `<img>` + `drawImage` respeita EXIF em todos os alvos.
 * O redimensionamento direto no decode também exigiria saber o tamanho antes —
 * ou seja, decodificar duas vezes.
 *
 * Falha de decodificação lança; o chamador mantém a mensagem de erro dele.
 */
export async function loadPhotoSource(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement | null = new Image();
  try {
    img.decoding = "async";
    img.src = url;
    await decodeImage(img);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error("foto sem dimensões");
    const size = fitWithin(w, h, MAX_SOURCE_EDGE);
    const canvas = createCanvas(size.width, size.height);
    const ctx = context2d(canvas);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, size.width, size.height);
    return canvas;
  } finally {
    // A cópia útil agora é o canvas: URL e `<img>` (com o bitmap decodificado
    // em tamanho cheio) saem de cena já, não quando o GC quiser.
    URL.revokeObjectURL(url);
    img.onload = null;
    img.onerror = null;
    img.removeAttribute("src");
    img = null;
  }
}

/** Brilho e contraste neutros: nenhuma cópia é necessária. */
export function isNeutralAdjust(a: PhotoAdjust): boolean {
  return a.brightness === DEFAULT_ADJUST.brightness && a.contrast === DEFAULT_ADJUST.contrast;
}

/**
 * Detecção por protótipo, não por "setar e reler": engines sem suporte aceitam
 * a atribuição numa propriedade solta e a releitura mente que funcionou.
 */
export function supportsCanvasFilter(): boolean {
  return typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;
}

/**
 * Tabela 0..255 com a MESMA matemática de `filter: brightness(b) contrast(c)`
 * (Filter Effects): brilho multiplica, o resultado é limitado a [0,255] e só
 * então vem o contraste em torno do meio-tom, `(v − 127,5)·c + 127,5`. O
 * limite intermediário importa: sem ele um pixel estourado pelo brilho
 * "voltaria" com contraste baixo, e o fallback divergiria do filtro nativo.
 */
export function buildAdjustLut(a: PhotoAdjust): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const bright = Math.min(255, Math.max(0, v * a.brightness));
    lut[v] = Math.round((bright - 127.5) * a.contrast + 127.5);
  }
  return lut;
}

/**
 * Fonte com brilho/contraste aplicados. Neutro devolve a PRÓPRIA fonte (zero
 * cópia); caso contrário, exatamente uma cópia do tamanho da fonte.
 * Sem `ctx.filter` (WebKit antigo) cai na tabela via `getImageData`.
 */
export function adjustSource(src: HTMLCanvasElement, a: PhotoAdjust): HTMLCanvasElement {
  if (isNeutralAdjust(a)) return src;
  const out = createCanvas(src.width, src.height);
  if (supportsCanvasFilter()) {
    const ctx = context2d(out);
    ctx.filter = `brightness(${a.brightness}) contrast(${a.contrast})`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = "none";
    return out;
  }
  const ctx = context2d(out, { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const lut = buildAdjustLut(a);
  const d = img.data;
  // Alfa intocado: a foto é opaca e o ajuste é só de cor.
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/**
 * Cópia pequena e borrada da fonte ajustada, usada como "vidro" do painel de
 * exercícios. Feita uma vez por ajuste: por frame o painel só a desenha esticada
 * no mesmo retângulo da foto, então acompanha o enquadramento e sai idêntica na
 * prévia e na exportação.
 */
export function blurSource(adjusted: HTMLCanvasElement): HTMLCanvasElement {
  const w = Math.max(1, Math.round(adjusted.width * GLASS_FRACTION));
  const h = Math.max(1, Math.round(adjusted.height * GLASS_FRACTION));
  const out = createCanvas(w, h);
  const ctx = context2d(out);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Base nítida por baixo: o blur puxa transparência das bordas, e sem ela o
  // contorno do vidro escureceria.
  ctx.drawImage(adjusted, 0, 0, w, h);
  if (supportsCanvasFilter()) {
    // Raio convertido para a escala do vidro (1 px aqui ≈ 1/GLASS_FRACTION px
    // da fonte, que tem ~a escala do card).
    ctx.filter = `blur(${(GLASS_BLUR_CARD_PX * GLASS_FRACTION).toFixed(2)}px)`;
    ctx.drawImage(adjusted, 0, 0, w, h);
    ctx.filter = "none";
    return out;
  }
  // Sem filtro: reduz mais 4× e amplia de volta com suavização — o bilinear do
  // upscale faz o papel do blur.
  const tiny = createCanvas(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)));
  try {
    const tctx = context2d(tiny);
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = "high";
    tctx.drawImage(adjusted, 0, 0, tiny.width, tiny.height);
    ctx.drawImage(tiny, 0, 0, w, h);
  } finally {
    disposeCanvas(tiny);
  }
  return out;
}

/** Camadas prontas para desenhar. `adjusted` é a própria `source` quando o ajuste é neutro. */
export type PhotoLayers = {
  readonly source: HTMLCanvasElement;
  readonly adjusted: HTMLCanvasElement;
  readonly glass: HTMLCanvasElement;
  readonly adjust: PhotoAdjust;
};

/**
 * Dono das camadas da foto enquanto o editor está aberto.
 *
 * Cada troca devolve um objeto `PhotoLayers` NOVO (serve de estado React), e
 * os canvases do objeto anterior que não foram reaproveitados são zerados —
 * não desenhe com um `PhotoLayers` antigo depois de trocar.
 */
export type PhotoSession = {
  /** Camadas atuais, ou `null` antes da primeira foto e após `dispose()`. */
  readonly layers: PhotoLayers | null;
  /**
   * Decodifica e troca a foto. Se outra chamada a `load` (ou `dispose`)
   * acontecer antes desta terminar, o resultado obsoleto é liberado e a
   * promessa resolve `null`. Falha de decodificação lança e mantém a foto
   * atual. Ao resolver com camadas novas, as antigas já foram zeradas — pare
   * de desenhar com elas assim que a promessa voltar.
   */
  load(file: Blob, adjust?: PhotoAdjust): Promise<PhotoLayers | null>;
  /**
   * Reaplica brilho/contraste. Mesmo valor = cache (devolve as camadas atuais).
   * O chamador faz o debounce do slider; isto é síncrono e caro em foto grande.
   */
  setAdjust(adjust: PhotoAdjust): PhotoLayers | null;
  /** Libera tudo. A sessão continua utilizável (StrictMode remonta efeitos). */
  dispose(): void;
};

function sameAdjust(a: PhotoAdjust, b: PhotoAdjust): boolean {
  return a.brightness === b.brightness && a.contrast === b.contrast;
}

/** Libera ajustada e vidro, preservando o que ainda estiver em uso. */
function releaseDerived(layers: PhotoLayers, keep: ReadonlySet<HTMLCanvasElement>) {
  if (layers.adjusted !== layers.source && !keep.has(layers.adjusted)) disposeCanvas(layers.adjusted);
  if (!keep.has(layers.glass)) disposeCanvas(layers.glass);
}

function buildLayers(source: HTMLCanvasElement, adjust: PhotoAdjust): PhotoLayers {
  const adjusted = adjustSource(source, adjust);
  try {
    return { source, adjusted, glass: blurSource(adjusted), adjust: { ...adjust } };
  } catch (err) {
    if (adjusted !== source) disposeCanvas(adjusted);
    throw err;
  }
}

export function createPhotoSession(): PhotoSession {
  let layers: PhotoLayers | null = null;
  // Cada `load`/`dispose` invalida o que estava em voo: só o resultado da
  // geração corrente entra; os demais são liberados ao chegar.
  let generation = 0;

  function freeAll() {
    if (!layers) return;
    releaseDerived(layers, new Set());
    disposeCanvas(layers.source);
    layers = null;
  }

  return {
    get layers() {
      return layers;
    },

    async load(file, adjust = DEFAULT_ADJUST) {
      const gen = ++generation;
      let source: HTMLCanvasElement;
      try {
        source = await loadPhotoSource(file);
      } catch (err) {
        if (gen !== generation) return null; // falhou, mas ninguém espera mais por ela
        throw err;
      }
      if (gen !== generation) {
        disposeCanvas(source);
        return null;
      }
      // A foto antiga sai ANTES de derivar a nova: manter as duas somaria até
      // seis buffers grandes no pico. O custo é a sessão ficar vazia se a
      // derivação falhar (contexto 2D indisponível) — raro, e o chamador já
      // trata o erro como "tente outra foto".
      freeAll();
      try {
        layers = buildLayers(source, adjust);
      } catch (err) {
        disposeCanvas(source);
        throw err;
      }
      return layers;
    },

    setAdjust(adjust) {
      if (!layers) return null;
      if (sameAdjust(layers.adjust, adjust)) return layers;
      const prev = layers;
      // Nova ajustada primeiro, depois solta a antiga, depois o vidro: o pico
      // fica em 4 buffers (fonte, ajustada antiga, vidro antigo, ajustada nova).
      const adjusted = adjustSource(prev.source, adjust);
      releaseDerived(prev, new Set([adjusted]));
      let glass: HTMLCanvasElement;
      try {
        glass = blurSource(adjusted);
      } catch (err) {
        // A ajustada antiga já foi solta, então não há estado coerente para
        // onde voltar: a sessão fica vazia e o chamador trata como erro de foto.
        if (adjusted !== prev.source) disposeCanvas(adjusted);
        disposeCanvas(prev.source);
        layers = null;
        throw err;
      }
      layers = { source: prev.source, adjusted, glass, adjust: { ...adjust } };
      return layers;
    },

    dispose() {
      generation++;
      freeAll();
    },
  };
}
