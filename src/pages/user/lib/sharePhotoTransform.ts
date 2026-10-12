// Geometria do enquadramento da foto no card de compartilhamento.
//
// Pura de propósito: o editor (preview em escala reduzida) e a exportação
// (1080×H) chamam as MESMAS funções, então o que a pessoa enquadra é o que sai.
// Tudo aqui trabalha em coordenadas lógicas do card — nunca em px de tela.

/**
 * Enquadramento da foto.
 * - `zoom` multiplica o tamanho de "cover" (1 = a foto cobre o card exatamente).
 * - `offsetX`/`offsetY` deslocam o centro da foto em FRAÇÃO do card (0.1 = 10%
 *   da largura/altura). Fração, e não px, para o mesmo enquadramento valer na
 *   prévia pequena e na exportação grande sem conversão.
 */
export type PhotoTransform = { zoom: number; offsetX: number; offsetY: number };

/** Ajuste de cor aplicado só na foto (o overlay vem depois, independente). */
export type PhotoAdjust = { brightness: number; contrast: number };

/** Intensidade do escurecimento sobre a foto. */
export type OverlayPreset = "soft" | "medium" | "strong";

/** Tudo que o editor guarda por formato (Story e Feed têm o seu). */
export type ShareEdit = { transform: PhotoTransform; adjust: PhotoAdjust; overlay: OverlayPreset };

/** Dimensões que o enquadramento precisa: a foto e o card onde ela entra. */
export type PhotoFrame = { imgW: number; imgH: number; canvasW: number; canvasH: number };

/** Retângulo de destino do `drawImage`, em coordenadas do card. */
export type CoverRect = { dx: number; dy: number; dw: number; dh: number };

export const MIN_ZOOM = 1;
// Teto de 3×: a foto do app nativo chega com ~1600px e a fonte é limitada a
// 2048px; além disso o zoom vira upscale visível, e não prometemos qualidade.
export const MAX_ZOOM = 3;

export const DEFAULT_TRANSFORM: Readonly<PhotoTransform> = Object.freeze({ zoom: 1, offsetX: 0, offsetY: 0 });
export const DEFAULT_ADJUST: Readonly<PhotoAdjust> = Object.freeze({ brightness: 1, contrast: 1 });
export const DEFAULT_OVERLAY: OverlayPreset = "medium";

/** Edição padrão — objetos novos, para o chamador poder guardar em estado sem aliasing. */
export function defaultEdit(): ShareEdit {
  return { transform: { ...DEFAULT_TRANSFORM }, adjust: { ...DEFAULT_ADJUST }, overlay: DEFAULT_OVERLAY };
}

/** Verdadeiro quando não há nada a restaurar (o "Restaurar" fica desabilitado). */
export function isDefaultEdit(e: ShareEdit): boolean {
  return (
    e.transform.zoom === DEFAULT_TRANSFORM.zoom &&
    e.transform.offsetX === DEFAULT_TRANSFORM.offsetX &&
    e.transform.offsetY === DEFAULT_TRANSFORM.offsetY &&
    e.adjust.brightness === DEFAULT_ADJUST.brightness &&
    e.adjust.contrast === DEFAULT_ADJUST.contrast &&
    e.overlay === DEFAULT_OVERLAY
  );
}

/** Tamanho de "cover" com zoom 1 — o mesmo cálculo do `drawCover` legado. */
function baseCover(f: PhotoFrame): { w: number; h: number } {
  const ir = f.imgW / f.imgH;
  const cr = f.canvasW / f.canvasH;
  return ir > cr ? { w: f.canvasH * ir, h: f.canvasH } : { w: f.canvasW, h: f.canvasW / ir };
}

/**
 * Onde desenhar a foto. Com `DEFAULT_TRANSFORM` devolve exatamente o retângulo
 * do `drawCover` antigo (cover centralizado) — a arte sem edição não muda.
 * Não limita nada: quem precisa de garantia de cobertura passa por `clampTransform`.
 */
export function coverRect(f: PhotoFrame, t: PhotoTransform = DEFAULT_TRANSFORM): CoverRect {
  const base = baseCover(f);
  const dw = base.w * t.zoom;
  const dh = base.h * t.zoom;
  return {
    dx: (f.canvasW - dw) / 2 + t.offsetX * f.canvasW,
    dy: (f.canvasH - dh) / 2 + t.offsetY * f.canvasH,
    dw,
    dh,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Zoom em [1, 3] e deslocamento limitado para a foto SEMPRE cobrir o card —
 * nunca aparece borda vazia, em nenhum canto. Valor não finito volta ao padrão
 * (um NaN aqui apagaria a foto inteira no `drawImage`).
 */
export function clampTransform(f: PhotoFrame, t: PhotoTransform): PhotoTransform {
  const zoom = Number.isFinite(t.zoom) ? clamp(t.zoom, MIN_ZOOM, MAX_ZOOM) : DEFAULT_TRANSFORM.zoom;
  const base = baseCover(f);
  // Folga de cada lado = (tamanho desenhado − card) / 2, convertida em fração do card.
  const maxX = Math.max(0, (base.w * zoom - f.canvasW) / (2 * f.canvasW));
  const maxY = Math.max(0, (base.h * zoom - f.canvasH) / (2 * f.canvasH));
  const ox = Number.isFinite(t.offsetX) ? t.offsetX : 0;
  const oy = Number.isFinite(t.offsetY) ? t.offsetY : 0;
  return { zoom, offsetX: clamp(ox, -maxX, maxX), offsetY: clamp(oy, -maxY, maxY) };
}

/** Arrasta a foto por (dx, dy) em px LÓGICOS do card. */
export function applyPan(prev: PhotoTransform, f: PhotoFrame, dx: number, dy: number): PhotoTransform {
  return clampTransform(f, {
    zoom: prev.zoom,
    offsetX: prev.offsetX + dx / f.canvasW,
    offsetY: prev.offsetY + dy / f.canvasH,
  });
}

/**
 * Pinça: multiplica o zoom por `scaleDelta` mantendo sob o `focal` (ponto entre
 * os dedos, em coordenadas do card) o mesmo ponto da foto — e depois desloca
 * esse ponto por `pan` (o arraste simultâneo dos dois dedos).
 *
 * A âncora usa o zoom JÁ limitado, então no teto de 3× o gesto vira só arraste
 * em vez de "escorregar" a foto. O limite de cobertura pode quebrar a âncora
 * perto da borda — de propósito: borda vazia é pior que o ponto andar.
 */
export function applyPinch(
  prev: PhotoTransform,
  f: PhotoFrame,
  focal: { x: number; y: number },
  scaleDelta: number,
  pan: { dx: number; dy: number } = { dx: 0, dy: 0 },
): PhotoTransform {
  const delta = Number.isFinite(scaleDelta) && scaleDelta > 0 ? scaleDelta : 1;
  const zoom = clamp(prev.zoom * delta, MIN_ZOOM, MAX_ZOOM);
  const before = coverRect(f, prev);
  // Posição do ponto da foto sob o foco, relativa ao retângulo (0..1).
  const u = (focal.x - before.dx) / before.dw;
  const v = (focal.y - before.dy) / before.dh;
  const base = baseCover(f);
  const dw = base.w * zoom;
  const dh = base.h * zoom;
  const dx = focal.x + pan.dx - u * dw;
  const dy = focal.y + pan.dy - v * dh;
  return clampTransform(f, {
    zoom,
    offsetX: (dx - (f.canvasW - dw) / 2) / f.canvasW,
    offsetY: (dy - (f.canvasH - dh) / 2) / f.canvasH,
  });
}
