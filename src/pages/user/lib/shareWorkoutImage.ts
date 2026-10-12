// Compartilhamento da conquista do treino como imagem-card de marca, no estilo
// GymRats/Strava: a foto do aluno (tirada ou da galeria) vira o FUNDO e os dados
// do treino + marca ficam sobrepostos com um scrim escuro para legibilidade.
//
// Este arquivo só DESENHA a arte (canvas → blob + dataUrl) e monta o texto que
// a acompanha. Compartilhar, salvar e capturar foto vivem em `nativeShare.ts`,
// porque no app empacotado nenhuma das APIs web equivalentes funciona — e todas
// falhavam em silêncio quando moravam aqui (QA mobile set/2026).
//
// O desenho é dividido em duas camadas que o editor de foto também usa:
// `renderBackground` (foto enquadrada + escurecimento + vidro do painel, muda a
// cada gesto) e `renderForeground` (faixa, textos e logo, fixa e cacheável).
// A exportação passa pelas MESMAS funções a 1080×H — a prévia do editor é a
// arte final por construção, não uma imitação dela.

import {
  clampTransform,
  coverRect,
  DEFAULT_ADJUST,
  DEFAULT_OVERLAY,
  DEFAULT_TRANSFORM,
  type OverlayPreset,
  type PhotoAdjust,
  type PhotoTransform,
  type ShareEdit,
} from "./sharePhotoTransform";
import { adjustSource, blurSource, disposeCanvas, loadPhotoSource } from "./sharePhotoSource";

const BRAND = "S2Core"; // marca pública do app (domínio s2core.com.br)

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

type HeroLine = { text: string; connector: boolean };

/**
 * Quebra o foco do treino em linhas-herói editoriais.
 * - Foco com "+" (ex.: "Peito + Tríceps + Ombros") → uma linha por grupo, com
 *   conector "+" verde DELIBERADO no fim de cada linha (nunca órfão por acidente).
 * - Foco simples (ex.: "Costas e Bíceps") → quebra por palavra.
 * A fonte encolhe até caber em `maxLines` sem estourar a largura.
 */
function buildHeroLines(
  ctx: CanvasRenderingContext2D,
  focus: string,
  maxWidth: number,
  startSize: number,
  maxLines: number,
  weight: number,
): { lines: HeroLine[]; size: number } {
  const segments = focus.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
  const multi = segments.length > 1;
  const minSize = Math.round(startSize * 0.6);
  const asLines = (): HeroLine[] =>
    multi
      ? segments.map((s, i) => ({ text: s, connector: i < segments.length - 1 }))
      : wrap(ctx, focus, maxWidth).map((t) => ({ text: t, connector: false }));
  const measure = (l: HeroLine) => ctx.measureText(l.text + (l.connector ? " +" : "")).width;

  for (let size = startSize; size >= minSize; size -= 4) {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
    const lines = asLines();
    if (lines.length <= maxLines && lines.every((l) => measure(l) <= maxWidth)) {
      return { lines, size };
    }
  }
  ctx.font = `${weight} ${minSize}px Inter, system-ui, sans-serif`;
  return { lines: asLines().slice(0, maxLines), size: minSize };
}

/** Corta `text` com reticências para caber em `maxWidth` na fonte corrente. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/** Caminho de retângulo com cantos arredondados (jsdom/Safari antigo não têm `roundRect`). */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

async function loadSvgLogo(): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.src = "/corefit-logo-light.svg";
    if (img.decode) await img.decode();
    else await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
    return img;
  } catch {
    return null;
  }
}

let logoPromise: Promise<HTMLImageElement | null> | null = null;

/**
 * Logo da marca decodificado uma vez por sessão. Falha NÃO fica em cache: um
 * tropeço de rede no primeiro card não pode condenar todos os seguintes ao
 * fallback de texto.
 */
export function getLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    const p = loadSvgLogo();
    logoPromise = p;
    void p.then((img) => {
      if (!img && logoPromise === p) logoPromise = null;
    });
  }
  return logoPromise;
}

/** Proporção do card: "story" = 1080×1920 (9:16, Stories) · "square" = 1080×1080 (feed). */
export type WorkoutShareFormat = "story" | "square";

/**
 * Estatísticas SEGURAS e motivacionais do treino para o card/texto. Apenas dados
 * de desempenho do próprio treino — NUNCA peso corporal, medidas, dor, fadiga,
 * dados clínicos, nome de personal/academia, IDs ou plano (ver docs/MATURE_FEATURES.md
 * › Compartilhamento social de treino › Privacidade).
 */
export type WorkoutShareStats = {
  /** Duração total em minutos. */
  durationMin?: number | null;
  /** Séries concluídas. */
  doneSets?: number | null;
  /** Séries previstas. */
  totalSets?: number | null;
  /** Percentual de conclusão (0–100). */
  completionPct?: number | null;
  /** Volume total levantado em kg. */
  volumeKg?: number | null;
  /** Sequência/consistência (dias seguidos). */
  streak?: number | null;
};

/**
 * Um exercício executado, para a mini tabela do card. Mesma classe de dado do
 * resto do card: o que a pessoa fez no treino. Sem carga por exercício, sem
 * dor/limitação, sem quem prescreveu — a allow-list da privacidade não muda.
 */
export type WorkoutShareExercise = {
  /** Nome do exercício, ex.: "Puxada frente". */
  name: string;
  /** Séries concluídas. */
  sets?: number | null;
  /** Repetições representativas, ex.: "12" ou "10-12". */
  reps?: string | null;
};

/** Uma linha já formatada da mini tabela. */
export type ExerciseRow = { name: string; detail: string };

/**
 * Converte a lista de exercícios nas linhas visíveis do card.
 * Corta em `maxRows` e, quando sobra gente de fora, gasta a última linha com
 * "+N exercícios" — a peça informa que foi resumida em vez de mentir por omissão.
 * Pura e exportada porque é ela que define o que a arte diz.
 */
export function buildExerciseRows(
  list: WorkoutShareExercise[] | null | undefined,
  maxRows: number,
): { rows: ExerciseRow[]; hiddenCount: number } {
  if (!list?.length || maxRows < 1) return { rows: [], hiddenCount: 0 };

  const usable = list
    .map((ex) => ({ ...ex, name: (ex.name ?? "").trim() }))
    .filter((ex) => ex.name.length > 0);
  if (!usable.length) return { rows: [], hiddenCount: 0 };

  const hiddenCount = usable.length > maxRows ? usable.length - (maxRows - 1) : 0;
  const visible = hiddenCount ? usable.slice(0, maxRows - 1) : usable;

  const rows = visible.map((ex) => {
    const sets = ex.sets != null && Number.isFinite(ex.sets) && ex.sets > 0 ? Math.round(ex.sets) : null;
    const reps = ex.reps?.toString().trim() || "";
    let detail = "";
    if (sets && reps) detail = `${sets} × ${reps}`;
    else if (sets) detail = `${sets} ${sets === 1 ? "série" : "séries"}`;
    else if (reps) detail = `${reps} reps`;
    return { name: ex.name, detail };
  });

  return { rows, hiddenCount };
}

/**
 * Foto já preparada para desenhar: `adjusted` com brilho/contraste aplicados e
 * `glass`, a cópia pequena borrada do painel (ver `sharePhotoSource.ts`).
 * `PhotoLayers` da sessão do editor satisfaz este tipo.
 */
export type CardPhoto = { adjusted: HTMLCanvasElement; glass: HTMLCanvasElement | null };

export type ComposeWorkoutInput = {
  /** Foco do treino exibido em destaque, ex.: "Superiores". */
  focus: string;
  /**
   * Linha de cima da arte. "TREINO CONCLUÍDO" por padrão; a atividade usa
   * "CORRIDA CONCLUÍDA", "CAMINHADA CONCLUÍDA" (SPEC P2 §63).
   *
   * Parametrizado em vez de duplicar o compositor: a arte, a identidade, o
   * scrim que garante legibilidade sobre foto e os dois formatos são os mesmos
   * — só o texto muda. Duplicar significaria manter duas artes em sincronia.
   */
  eyebrow?: string;
  /** Rótulo do painel de linhas. "EXERCÍCIOS EXECUTADOS" por padrão. */
  panelLabel?: string;
  /** Foto de fundo opcional (tirada ou da galeria). Sem ela, usa um fundo gradiente. */
  backgroundFile?: File | Blob | null;
  /**
   * Foto já decodificada pelo editor — tem prioridade sobre `backgroundFile`.
   * Canvas cru: o brilho/contraste de `photoAdjust` é aplicado aqui. `CardPhoto`
   * (as camadas que o editor já tem): usado como está, sem recalcular nada —
   * evita duplicar dois buffers grandes no "Concluir"; o ajuste de cor de
   * `photoAdjust` é ignorado porque já veio aplicado.
   * O que é passado aqui nunca é liberado por esta função.
   */
  photoSource?: HTMLCanvasElement | CardPhoto | null;
  /** Enquadramento e ajuste de cor da foto. Campos ausentes = padrão (sem edição). */
  photoAdjust?: Partial<PhotoTransform & PhotoAdjust> | null;
  /** Escurecimento sobre a foto. Padrão: "medium". Sem foto é ignorado. */
  overlay?: OverlayPreset;
  /** Proporção do card. Padrão: "story". */
  format?: WorkoutShareFormat;
  /** Exercícios executados — viram a mini tabela do rodapé. Vazio = bloco some. */
  exercises?: WorkoutShareExercise[] | null;
};

/** Monta os "chips" de stats seguros (linha única) a partir das estatísticas. */
function buildStatChips(stats?: WorkoutShareStats | null): string[] {
  if (!stats) return [];
  const chips: string[] = [];
  if (stats.durationMin && stats.durationMin > 0) chips.push(`${Math.round(stats.durationMin)} min`);
  if (stats.doneSets != null && stats.totalSets != null && stats.totalSets > 0) {
    chips.push(`${stats.doneSets}/${stats.totalSets} séries`);
  }
  if (stats.volumeKg && stats.volumeKg > 0) chips.push(`${Math.round(stats.volumeKg)} kg`);
  if (stats.streak && stats.streak > 1) chips.push(`${stats.streak} dias seguidos`);
  return chips;
}

/**
 * Métricas do painel de exercícios. Calculadas ANTES de desenhar porque todo o
 * rodapé é ancorado de baixo p/ cima: sem a altura do painel não há onde
 * começar a data, o herói e o eyebrow.
 */
type PanelMetrics = {
  height: number;
  padX: number;
  padY: number;
  labelSize: number;
  gapLabelRows: number;
  rowH: number;
  nameSize: number;
  detailSize: number;
  radius: number;
};

function panelMetrics(isStory: boolean, rowCount: number, hasOverflow: boolean): PanelMetrics {
  const m: Omit<PanelMetrics, "height"> = isStory
    ? { padX: 38, padY: 30, labelSize: 25, gapLabelRows: 26, rowH: 54, nameSize: 32, detailSize: 32, radius: 30 }
    : { padX: 30, padY: 24, labelSize: 21, gapLabelRows: 20, rowH: 44, nameSize: 26, detailSize: 26, radius: 24 };
  const lines = rowCount + (hasOverflow ? 1 : 0);
  return { ...m, height: m.padY * 2 + m.labelSize + m.gapLabelRows + lines * m.rowH - 10 };
}

/**
 * Quanto escurecer a foto, por preset. A legibilidade mora no scrim do rodapé
 * (gradiente localizado onde o texto está) e no véu do painel — não num véu
 * uniforme sobre a foto inteira, que era o que deixava a foto apagada. Só o
 * "Forte" mantém um véu global, e fica ≈ à arte anterior para quem prefere.
 */
export type OverlayStyle = {
  /** Véu uniforme sobre a foto inteira (0 = nenhum). */
  globalVeil: number;
  /** Opacidade do scrim onde o texto começa. */
  scrimText: number;
  /** Opacidade do scrim na base da peça. */
  scrimBase: number;
  /** Véu escuro sobre o vidro do painel de exercícios. */
  panelVeil: number;
  /** Sombra sutil no título/eyebrow — compensa o scrim mais leve do "Suave". */
  textShadow: boolean;
};

export const OVERLAY_PRESETS: Readonly<Record<OverlayPreset, Readonly<OverlayStyle>>> = Object.freeze({
  soft: Object.freeze({ globalVeil: 0, scrimText: 0.48, scrimBase: 0.8, panelVeil: 0.66, textShadow: true }),
  medium: Object.freeze({ globalVeil: 0, scrimText: 0.56, scrimBase: 0.88, panelVeil: 0.74, textShadow: false }),
  strong: Object.freeze({ globalVeil: 0.2, scrimText: 0.7, scrimBase: 0.94, panelVeil: 0.8, textShadow: false }),
});

// Sem foto o fundo é o gradiente da marca, que já é escuro: valores fixos,
// iguais aos de antes do editor — o card sem foto não muda.
const NO_PHOTO_SCRIM_TEXT = 0.34;
const NO_PHOTO_SCRIM_BASE = 0.88;
const NO_PHOTO_PANEL_VEIL = 0.46;

function overlayStyle(preset: OverlayPreset | null | undefined): OverlayStyle {
  return OVERLAY_PRESETS[preset ?? DEFAULT_OVERLAY] ?? OVERLAY_PRESETS[DEFAULT_OVERLAY];
}

/** O que o card diz. Separado do resto do input porque só isto afeta o layout. */
export type CardContent = Pick<ComposeWorkoutInput, "focus" | "exercises" | "eyebrow" | "panelLabel">;

/**
 * Posição de tudo no card, em coordenadas lógicas (1080×H). Calculada uma vez
 * por formato/conteúdo: o editor redesenha a foto a cada gesto sem medir texto.
 */
export type CardLayout = {
  format: WorkoutShareFormat;
  width: number;
  height: number;
  isStory: boolean;
  padX: number;
  logo: { x: number; y: number; w: number; h: number };
  hero: { lines: HeroLine[]; size: number; lineH: number; lastBaseline: number };
  eyebrow: { text: string; size: number; baseline: number };
  /** Topo do bloco de texto — de onde o scrim deriva. */
  textTop: number;
  panel: {
    x: number; y: number; w: number; h: number; m: PanelMetrics;
    rows: ExerciseRow[]; hiddenCount: number; title: string;
  } | null;
};

let measureCtx: CanvasRenderingContext2D | null = null;

/** Contexto 1×1 só para `measureText` — o layout não depende de onde se vai desenhar. */
function measureContext(): CanvasRenderingContext2D {
  if (measureCtx) return measureCtx;
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  measureCtx = ctx;
  return ctx;
}

export function computeCardLayout(format: WorkoutShareFormat, content: CardContent): CardLayout {
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  const isStory = format === "story";
  const ctx = measureContext();
  // Lift extra no rodapé: Story afasta da UI do Instagram; square dá respiro
  // mínimo. Mantido só o necessário — cada pixel aqui é foto a menos.
  const lift = isStory ? 108 : 36;

  // Mini tabela do rodapé. Teto de linhas por formato: a peça é uma conquista,
  // não um relatório — 12 exercícios listados afogariam o título.
  // O quadrado tem metade da altura do Story para o mesmo rodapé — cabe menos.
  const { rows: exerciseRows, hiddenCount } = buildExerciseRows(content.exercises, isStory ? 6 : 3);
  const hasPanel = exerciseRows.length > 0;
  const pm = hasPanel ? panelMetrics(isStory, exerciseRows.length, hiddenCount > 0) : null;

  // Bloco de rodapé coeso, ancorado de baixo p/ cima com ritmo consistente:
  // [eyebrow] · [herói multilinha] · [exercícios] · [logo]
  const padX = 96;

  // Zona segura inferior (no Story, afasta da UI do Instagram)
  const bottomSafe = lift + (isStory ? 16 : 24);

  // — Logo (âncora de marca, base do bloco)
  const logoW = isStory ? 400 : 260;
  const logoH = Math.round(logoW * (56 / 264));
  const logoTop = H - bottomSafe - logoH;

  // — Tokens de espaçamento vertical (ritmo do rodapé)
  const gapHeroBelow = isStory ? 52 : 38;
  const gapHeroEyebrow = isStory ? 26 : 20;

  // — Painel de exercícios: entra ENTRE o herói e o logo. A ordem de leitura
  //   fica eyebrow → título → detalhe → marca, e o rodapé inteiro só sobe:
  //   sem exercícios, `panelH` é 0 e a composição é a mesma de antes.
  const panelW = W - padX * 2;
  const panelH = pm?.height ?? 0;
  const gapLogoPanel = isStory ? 38 : 28;
  const panelTop = hasPanel ? logoTop - gapLogoPanel - panelH : logoTop;

  // — Herói (foco do treino): encolhe p/ caber em até 3 linhas, "+" verde deliberado
  // 96 em vez de 132: com o painel de exercícios embaixo, um herói de 132px em
  // duas linhas comia um terço do Story e sobrava pouca foto.
  const hero = buildHeroLines(ctx, content.focus, W - padX * 2, isStory ? 96 : 82, 3, 800);
  const heroLineH = Math.round(hero.size * 1.06);
  const heroLastBaseline = (hasPanel ? panelTop : logoTop) - gapHeroBelow;

  // — Topo do bloco de texto
  const heroTopBaseline = heroLastBaseline - (hero.lines.length - 1) * heroLineH;
  const eyebrowSize = isStory ? 34 : 29;
  const eyebrowBaseline = heroTopBaseline - Math.round(hero.size * 0.72) - gapHeroEyebrow;

  return {
    format,
    width: W,
    height: H,
    isStory,
    padX,
    logo: { x: padX, y: logoTop, w: logoW, h: logoH },
    hero: { lines: hero.lines, size: hero.size, lineH: heroLineH, lastBaseline: heroLastBaseline },
    eyebrow: { text: content.eyebrow ?? "TREINO CONCLUÍDO", size: eyebrowSize, baseline: eyebrowBaseline },
    textTop: eyebrowBaseline - eyebrowSize,
    panel: pm
      ? {
          x: padX, y: panelTop, w: panelW, h: pm.height, m: pm,
          rows: exerciseRows, hiddenCount,
          title: content.panelLabel ?? "EXERCÍCIOS EXECUTADOS",
        }
      : null,
  };
}

/** Canvas zerado por `disposeCanvas` faz o `drawImage` lançar — tratar como ausente. */
function drawable(c: HTMLCanvasElement | null | undefined): c is HTMLCanvasElement {
  return !!c && c.width > 0 && c.height > 0;
}

/**
 * Camada de fundo: foto enquadrada (ou gradiente), escurecimento e o vidro do
 * painel de exercícios. É a única parte que muda durante um gesto.
 *
 * Desenha em coordenadas lógicas sobre um canvas de `largura lógica × scale`:
 * o `ctx.scale` é aplicado aqui (somado à transformação que já houver).
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  scale: number,
  photo: CardPhoto | null,
  edit: Pick<ShareEdit, "transform" | "overlay">,
  layout: CardLayout,
): void {
  const { width: W, height: H } = layout;
  const hasPhoto = !!photo && drawable(photo.adjusted);
  const style = overlayStyle(edit.overlay);

  ctx.save();
  ctx.scale(scale, scale);

  // 1) Fundo: foto (cover enquadrado) ou gradiente
  let rect: ReturnType<typeof coverRect> | null = null;
  if (hasPhoto) {
    const frame = { imgW: photo.adjusted.width, imgH: photo.adjusted.height, canvasW: W, canvasH: H };
    // Limitado de novo aqui: o export pode receber `photoAdjust` de qualquer
    // chamador, e borda vazia na arte final não é aceitável.
    rect = coverRect(frame, clampTransform(frame, edit.transform));
    ctx.drawImage(photo.adjusted, rect.dx, rect.dy, rect.dw, rect.dh);
    if (style.globalVeil > 0) {
      ctx.fillStyle = `rgba(7,12,18,${style.globalVeil})`;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0b1220");
    grad.addColorStop(1, "#0f2a24");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // 2) Scrim derivado do bloco medido em vez de uma fração fixa da altura:
  //    o rodapé cresce com o painel de exercícios e com um herói de 3 linhas, e
  //    uma fração fixa deixava o topo do texto sobre a parte clara da foto —
  //    visível no formato quadrado, onde o bloco ocupa quase a peça inteira.
  const fade = layout.isStory ? 300 : 240; // altura da transição até o texto começar
  const scrimStart = Math.max(0, layout.textTop - fade);
  const scrim = ctx.createLinearGradient(0, scrimStart, 0, H);
  const textStop = Math.min(0.95, (layout.textTop - scrimStart) / Math.max(1, H - scrimStart));
  scrim.addColorStop(0, "rgba(7,12,18,0)");
  scrim.addColorStop(textStop, `rgba(7,12,18,${hasPhoto ? style.scrimText : NO_PHOTO_SCRIM_TEXT})`);
  scrim.addColorStop(1, `rgba(7,12,18,${hasPhoto ? style.scrimBase : NO_PHOTO_SCRIM_BASE})`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // 3) Fundo do painel de exercícios (recortado nos cantos arredondados).
  //    Precisa ser legível TAMBÉM sobre foto clara, então não conta com o
  //    scrim: mostra a própria foto borrada dentro do recorte (vidro), no mesmo
  //    retângulo da foto — acompanha o enquadramento — e por cima um véu
  //    escuro próprio. Sem foto, um véu mais leve para parecer nativo da peça.
  const p = layout.panel;
  if (p) {
    ctx.save();
    roundRectPath(ctx, p.x, p.y, p.w, p.h, p.m.radius);
    ctx.clip();
    if (hasPhoto && rect && drawable(photo.glass)) {
      ctx.drawImage(photo.glass, rect.dx, rect.dy, rect.dw, rect.dh);
    }
    ctx.fillStyle = `rgba(8,13,20,${hasPhoto ? style.panelVeil : NO_PHOTO_PANEL_VEIL})`;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }

  ctx.restore();
}

/** Borda e texto da mini tabela "Exercícios executados" (o fundo é do `renderBackground`). */
function drawPanelForeground(
  ctx: CanvasRenderingContext2D,
  p: NonNullable<CardLayout["panel"]>,
  label: string,
  isStory: boolean,
) {
  const { x, y, w, h, m, rows, hiddenCount, title } = p;

  // — Borda hairline: separa o cartão de fundos claros sem pesar
  ctx.save();
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, m.radius);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.stroke();
  ctx.restore();

  const hasTracking = "letterSpacing" in ctx;
  const setTracking = (v: string) => {
    if (hasTracking) (ctx as unknown as { letterSpacing: string }).letterSpacing = v;
  };

  // — Rótulo do bloco (oliva da marca, tracked). Usa a oliva CLARA: sobre o véu
  //   escuro do painel, o #7B9919 fica em 2,8:1 e um rótulo pequeno some.
  const labelX = x + m.padX;
  const labelBaseline = y + m.padY + m.labelSize;
  ctx.textAlign = "left";
  ctx.font = `700 ${m.labelSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = label;
  setTracking(isStory ? "3px" : "2px");
  ctx.fillText(title, labelX, labelBaseline);
  setTracking("0px");

  // — Linhas: nome à esquerda, séries × reps à direita (mini tabela)
  const rowsTop = labelBaseline + m.gapLabelRows;
  const rightX = x + w - m.padX;
  const gapNameDetail = 24;

  rows.forEach((row, i) => {
    const top = rowsTop + i * m.rowH;
    const baseline = top + m.rowH / 2 + Math.round(m.nameSize * 0.34);

    if (i > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.09)";
      ctx.fillRect(labelX, top, w - m.padX * 2, 1);
    }

    ctx.font = `700 ${m.detailSize}px Inter, system-ui, sans-serif`;
    const detailW = row.detail ? ctx.measureText(row.detail).width : 0;
    if (row.detail) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fillText(row.detail, rightX, baseline);
    }

    ctx.textAlign = "left";
    ctx.font = `500 ${m.nameSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    const nameMax = w - m.padX * 2 - (detailW ? detailW + gapNameDetail : 0);
    ctx.fillText(ellipsize(ctx, row.name, nameMax), labelX, baseline);
  });

  if (hiddenCount > 0) {
    const top = rowsTop + rows.length * m.rowH;
    const baseline = top + m.rowH / 2 + Math.round(m.nameSize * 0.34);
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fillRect(labelX, top, w - m.padX * 2, 1);
    ctx.textAlign = "left";
    ctx.font = `600 ${Math.round(m.nameSize * 0.92)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(
      `+${hiddenCount} ${hiddenCount === 1 ? "exercício" : "exercícios"}`,
      labelX,
      baseline,
    );
  }

  ctx.textAlign = "left";
}

/**
 * Camada fixa: faixa de marca, eyebrow, título, texto do painel e logo. Não
 * pinta fundo nenhum — pode ser desenhada uma vez num canvas transparente e
 * reaproveitada a cada frame do editor.
 *
 * `overlay` é o preset em uso, ou `null` quando não há foto (aí nenhuma
 * sombra entra e o card sem foto sai como sempre saiu). Sombra ignora a
 * transformação do contexto, por isso blur/deslocamento são multiplicados
 * por `scale` à mão.
 */
export function renderForeground(
  ctx: CanvasRenderingContext2D,
  scale: number,
  layout: CardLayout,
  logo: HTMLImageElement | null,
  overlay: OverlayPreset | null,
): void {
  const { width: W, isStory, padX, hero, eyebrow } = layout;
  const primary = cssVar("--color-primary", "#7B9919");
  // Oliva clara do design system (`--highlight`) — variante para fundo escuro.
  const primaryBright = cssVar("--color-primary-hover", "#91B51E");
  const shadow = overlay !== null && overlayStyle(overlay).textShadow;

  ctx.save();
  ctx.scale(scale, scale);
  ctx.textAlign = "left";

  // Faixa de marca no topo — verde primário S2Core (coeso com o logo)
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, W, 14);

  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 14 * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2 * scale;
  }

  // Herói, sobre o scrim
  hero.lines.forEach((line, i) => {
    const fromBottom = hero.lines.length - 1 - i;
    const yy = hero.lastBaseline - fromBottom * hero.lineH;
    ctx.font = `800 ${hero.size}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line.text, padX, yy);
    if (line.connector) {
      const w = ctx.measureText(line.text).width;
      ctx.fillStyle = primary;
      ctx.fillText(" +", padX + w, yy);
    }
  });

  // Eyebrow (acima do herói): tracked, branco suave
  ctx.font = `700 ${eyebrow.size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  const hasTracking = "letterSpacing" in ctx;
  if (hasTracking) (ctx as unknown as { letterSpacing: string }).letterSpacing = isStory ? "4px" : "3px";
  ctx.fillText(eyebrow.text, padX, eyebrow.baseline);
  if (hasTracking) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";

  if (shadow) {
    // O painel tem véu próprio; sombra ali só borraria o texto pequeno.
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  if (layout.panel) drawPanelForeground(ctx, layout.panel, primaryBright, isStory);

  // Logo (SVG claro para fundo escuro; fallback p/ texto)
  const { x: logoX, y: logoTop, w: logoW, h: logoH } = layout.logo;
  if (logo) {
    ctx.drawImage(logo, logoX, logoTop, logoW, logoH);
  } else {
    ctx.font = "800 56px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(BRAND, logoX, logoTop + logoH - 12);
    const brandWidth = ctx.measureText(BRAND).width;
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.arc(logoX + brandWidth + 18, logoTop + logoH - 30, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Card completo: fundo + camada fixa, no contexto e escala dados. */
export function renderWorkoutCard(
  ctx: CanvasRenderingContext2D,
  scale: number,
  layout: CardLayout,
  photo: CardPhoto | null,
  edit: Pick<ShareEdit, "transform" | "overlay">,
  logo: HTMLImageElement | null,
): void {
  renderBackground(ctx, scale, photo, edit, layout);
  const hasPhoto = !!photo && drawable(photo.adjusted);
  renderForeground(ctx, scale, layout, logo, hasPhoto ? edit.overlay : null);
}

export type ComposedImage = { blob: Blob; dataUrl: string; focus: string; format: WorkoutShareFormat };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("falha ao ler imagem"));
    reader.readAsDataURL(blob);
  });
}

/** Monta o card-imagem (story 1080×1920 ou square 1080²) e devolve blob + dataUrl. */
export async function composeWorkoutImage({
  focus,
  backgroundFile,
  photoSource,
  photoAdjust,
  overlay = DEFAULT_OVERLAY,
  format = "story",
  exercises,
  eyebrow,
  panelLabel,
}: ComposeWorkoutInput): Promise<ComposedImage> {
  const layout = computeCardLayout(format, { focus, exercises, eyebrow, panelLabel });
  const transform: PhotoTransform = {
    zoom: photoAdjust?.zoom ?? DEFAULT_TRANSFORM.zoom,
    offsetX: photoAdjust?.offsetX ?? DEFAULT_TRANSFORM.offsetX,
    offsetY: photoAdjust?.offsetY ?? DEFAULT_TRANSFORM.offsetY,
  };
  const adjust: PhotoAdjust = {
    brightness: photoAdjust?.brightness ?? DEFAULT_ADJUST.brightness,
    contrast: photoAdjust?.contrast ?? DEFAULT_ADJUST.contrast,
  };

  // Só o que esta chamada criou é liberado no fim — a fonte do editor não.
  const owned: HTMLCanvasElement[] = [];
  const canvas = document.createElement("canvas");
  owned.push(canvas);
  try {
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponível");

    let photo: CardPhoto | null = null;
    if (photoSource && "adjusted" in photoSource) {
      photo = photoSource;
    } else {
      let source: HTMLCanvasElement | null = photoSource ?? null;
      if (!source && backgroundFile) {
        source = await loadPhotoSource(backgroundFile);
        owned.push(source);
      }
      if (source) {
        const adjusted = adjustSource(source, adjust);
        if (adjusted !== source) owned.push(adjusted);
        const glass = blurSource(adjusted);
        owned.push(glass);
        photo = { adjusted, glass };
      }
    }

    const logo = await getLogo();
    renderWorkoutCard(ctx, 1, layout, photo, { transform, overlay }, logo);

    // Um encode só: o dataUrl sai do próprio blob em vez de um segundo
    // `toDataURL`, que recomprimiria a peça inteira de novo.
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) throw new Error("falha ao gerar imagem");
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl, focus, format };
  } finally {
    owned.forEach(disposeCanvas);
  }
}

const CTA = "Treine com inteligência metabólica";

/**
 * Texto motivacional SEGURO para compartilhar/copiar. Só inclui foco, stats
 * seguros (duração/séries/volume/sequência), marca e CTA — nunca dados sensíveis.
 */
export function buildShareText(input: { focus: string; dayName?: string; stats?: WorkoutShareStats | null }): string {
  const chips = buildStatChips(input.stats);
  const lines = [`Treino de ${input.focus} concluído 💪`];
  if (chips.length) lines.push(chips.join(" · "));
  lines.push(`${CTA} — ${BRAND}`);
  return lines.join("\n");
}

/** Fallback universal: copia o texto motivacional seguro para a área de transferência. */
export async function copyShareText(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai no retorno false */
  }
  return false;
}
