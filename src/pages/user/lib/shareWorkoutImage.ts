// Compartilhamento da conquista do treino como imagem-card de marca, no estilo
// GymRats/Strava: a foto do aluno (tirada ou da galeria) vira o FUNDO e os dados
// do treino + marca ficam sobrepostos com um scrim escuro para legibilidade.
//
// Fluxo: compose (gera blob + preview) → share (Web Share API com arquivo).
// Separados de propósito: o share() precisa de gesto do usuário e é chamado a
// partir do botão "Compartilhar" do preview. Restrito ao mobile por capacidade.

const BRAND = "S2Core"; // marca pública do app (domínio s2core.com.br)

type ShareableNavigator = Navigator & {
  canShare?: (data?: ShareData) => boolean;
};

/** True só quando o dispositivo consegue compartilhar um arquivo de imagem (≈ mobile). */
export function canShareWorkoutImage(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as ShareableNavigator;
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    const probe = new File([new Blob([""], { type: "image/png" })], "probe.png", { type: "image/png" });
    return nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

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

/** Desenha a imagem cobrindo o canvas (object-fit: cover, centralizada). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height;
  const cr = w / h;
  let dw: number, dh: number, dx: number, dy: number;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
    dy = 0;
  } else {
    dw = w;
    dh = w / ir;
    dx = 0;
    dy = (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
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

async function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    if (img.decode) await img.decode();
    else await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    return img;
  } finally {
    // revoga após o draw — adiado para o caller não perder a imagem; aqui é seguro
    // pois decode() já carregou os pixels.
    URL.revokeObjectURL(url);
  }
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

export type ComposeWorkoutInput = {
  /** Foco do treino exibido em destaque, ex.: "Superiores". */
  focus: string;
  /** Foto de fundo opcional (tirada ou da galeria). Sem ela, usa um fundo gradiente. */
  backgroundFile?: File | Blob | null;
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
 * Mini tabela "Exercícios executados" — cartão translúcido escurecido.
 *
 * O ponto crítico é ser legível TAMBÉM com foto de fundo, e a foto pode ser
 * clara. Por isso o painel não conta com o scrim: ele redesenha a própria foto
 * borrada dentro do recorte (vidro) e por cima aplica um véu escuro próprio.
 * Sem foto, o mesmo painel usa um véu mais leve para parecer nativo da peça —
 * e não um remendo colado sobre o gradiente.
 */
function drawExercisePanel(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number; y: number; w: number; m: PanelMetrics;
    rows: ExerciseRow[]; hiddenCount: number;
    bgImage: HTMLImageElement | null; canvasW: number; canvasH: number;
    label: string; isStory: boolean;
  },
) {
  const { x, y, w, m, rows, hiddenCount, bgImage, canvasW, canvasH, label, isStory } = opts;
  const h = m.height;

  // — Fundo do cartão (recortado nos cantos arredondados)
  ctx.save();
  roundRectPath(ctx, x, y, w, h, m.radius);
  ctx.clip();
  if (bgImage) {
    // `ctx.filter` não existe em jsdom nem em Safari antigo — sem ele o véu
    // escuro abaixo continua garantindo o contraste sozinho.
    try {
      ctx.filter = "blur(22px)";
      drawCover(ctx, bgImage, canvasW, canvasH);
    } catch {
      /* sem blur — segue só com o véu */
    }
    ctx.filter = "none";
  }
  ctx.fillStyle = bgImage ? "rgba(8,13,20,0.78)" : "rgba(8,13,20,0.46)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  ctx.fillRect(x, y, w, h);
  ctx.restore();

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
  ctx.fillText("EXERCÍCIOS EXECUTADOS", labelX, labelBaseline);
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

export type ComposedImage = { blob: Blob; dataUrl: string; focus: string; format: WorkoutShareFormat };

/** Monta o card-imagem (story 1080×1920 ou square 1080²) e devolve blob + dataUrl. */
export async function composeWorkoutImage({ focus, backgroundFile, format = "story", exercises }: ComposeWorkoutInput): Promise<ComposedImage> {
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  // Lift extra no rodapé: Story afasta da UI do Instagram; square dá respiro
  // mínimo. Mantido só o necessário — cada pixel aqui é foto a menos.
  const lift = format === "story" ? 108 : 36;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");

  const primary = cssVar("--color-primary", "#7B9919");
  // Oliva clara do design system (`--highlight`) — variante para fundo escuro.
  const primaryBright = cssVar("--color-primary-hover", "#91B51E");

  const isStory = format === "story";

  // Mini tabela do rodapé. Teto de linhas por formato: a peça é uma conquista,
  // não um relatório — 12 exercícios listados afogariam o título.
  // O quadrado tem metade da altura do Story para o mesmo rodapé — cabe menos.
  const { rows: exerciseRows, hiddenCount } = buildExerciseRows(exercises, isStory ? 6 : 3);
  const hasPanel = exerciseRows.length > 0;
  const pm = hasPanel ? panelMetrics(isStory, exerciseRows.length, hiddenCount > 0) : null;

  // 1) Fundo: foto (cover) ou gradiente
  let bgImage: HTMLImageElement | null = null;
  if (backgroundFile) {
    bgImage = await loadImage(backgroundFile);
    drawCover(ctx, bgImage, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0b1220");
    grad.addColorStop(1, "#0f2a24");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // 2) Bloco de rodapé coeso, ancorado de baixo p/ cima com ritmo consistente:
  //    [stats] · [eyebrow] · [herói multilinha] · [data] · [exercícios] · [logo]
  const padX = 96;
  ctx.textAlign = "left";

  // Zona segura inferior (no Story, afasta da UI do Instagram)
  const bottomSafe = lift + (isStory ? 16 : 24);

  // — Logo (âncora de marca, base do bloco)
  const logoImg = await loadSvgLogo();
  const logoW = isStory ? 400 : 260;
  const logoH = Math.round(logoW * (56 / 264));
  const logoTop = H - bottomSafe - logoH;

  // — Tokens de espaçamento vertical (ritmo do rodapé)
  const gapHeroBelow = isStory ? 52 : 38;
  const gapHeroEyebrow = isStory ? 26 : 20;

  // — Painel de exercícios: entra ENTRE a data e o logo. A ordem de leitura
  //   fica eyebrow → título → data → detalhe → marca, e o rodapé inteiro só
  //   sobe: sem exercícios, `panelH` é 0 e a composição é a mesma de antes.
  const panelW = W - padX * 2;
  const panelH = pm?.height ?? 0;
  const gapLogoPanel = isStory ? 38 : 28;
  const panelTop = hasPanel ? logoTop - gapLogoPanel - panelH : logoTop;

  // — Herói (foco do treino): encolhe p/ caber em até 3 linhas, "+" verde deliberado
  // 96 em vez de 132: com o painel de exercícios embaixo, um herói de 132px em
  // duas linhas comia um terço do Story e sobrava pouca foto.
  const hero = buildHeroLines(ctx, focus, W - padX * 2, isStory ? 96 : 82, 3, 800);
  const heroLineH = Math.round(hero.size * 1.06);
  const heroLastBaseline = (hasPanel ? panelTop : logoTop) - gapHeroBelow;

  // — Topo do bloco de texto
  const heroTopBaseline = heroLastBaseline - (hero.lines.length - 1) * heroLineH;
  const eyebrowSize = isStory ? 34 : 29;
  const eyebrowBaseline = heroTopBaseline - Math.round(hero.size * 0.72) - gapHeroEyebrow;

  // 3) Tratamento de legibilidade, agora que se sabe ONDE o texto começa.
  //    O scrim é derivado do bloco medido em vez de uma fração fixa da altura:
  //    o rodapé cresce com o painel de exercícios e com um herói de 3 linhas, e
  //    uma fração fixa deixava o topo do texto sobre a parte clara da foto —
  //    visível no formato quadrado, onde o bloco ocupa quase a peça inteira.
  const textTop = eyebrowBaseline - eyebrowSize;
  if (bgImage) {
    // Véu global: a foto é escolha do usuário e pode ser clara em qualquer
    // ponto. Sem ele, branco sobre céu/parede branca some. Leve de propósito —
    // quem escolheu a foto quer ver a foto; o scrim cobre a área do texto.
    ctx.fillStyle = "rgba(7,12,18,0.26)";
    ctx.fillRect(0, 0, W, H);
  }
  const fade = isStory ? 300 : 240; // altura da transição até o texto começar
  const scrimStart = Math.max(0, textTop - fade);
  const scrim = ctx.createLinearGradient(0, scrimStart, 0, H);
  const textStop = Math.min(0.95, (textTop - scrimStart) / Math.max(1, H - scrimStart));
  scrim.addColorStop(0, "rgba(7,12,18,0)");
  scrim.addColorStop(textStop, bgImage ? "rgba(7,12,18,0.66)" : "rgba(7,12,18,0.34)");
  scrim.addColorStop(1, bgImage ? "rgba(7,12,18,0.94)" : "rgba(7,12,18,0.88)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // 4) Faixa de marca no topo — verde primário S2Core (coeso com o logo)
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, W, 14);

  // 5) Texto do rodapé, sobre o scrim
  hero.lines.forEach((line, i) => {
    const fromBottom = hero.lines.length - 1 - i;
    const yy = heroLastBaseline - fromBottom * heroLineH;
    ctx.font = `800 ${hero.size}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line.text, padX, yy);
    if (line.connector) {
      const w = ctx.measureText(line.text).width;
      ctx.fillStyle = primary;
      ctx.fillText(" +", padX + w, yy);
    }
  });

  // — Eyebrow (acima do herói): tracked, branco suave
  ctx.font = `700 ${eyebrowSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  const hasTracking = "letterSpacing" in ctx;
  if (hasTracking) (ctx as unknown as { letterSpacing: string }).letterSpacing = isStory ? "4px" : "3px";
  ctx.fillText("TREINO CONCLUÍDO", padX, eyebrowBaseline);
  if (hasTracking) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";

  // — Painel "Exercícios executados"
  if (hasPanel && pm) {
    drawExercisePanel(ctx, {
      x: padX, y: panelTop, w: panelW, m: pm,
      rows: exerciseRows, hiddenCount,
      bgImage, canvasW: W, canvasH: H,
      label: primaryBright, isStory,
    });
  }

  // — Logo (SVG claro para fundo escuro; fallback p/ texto)
  if (logoImg) {
    ctx.drawImage(logoImg, padX, logoTop, logoW, logoH);
  } else {
    ctx.font = "800 56px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(BRAND, padX, logoTop + logoH - 12);
    const brandWidth = ctx.measureText(BRAND).width;
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.arc(padX + brandWidth + 18, logoTop + logoH - 30, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) throw new Error("falha ao gerar imagem");
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { blob, dataUrl, focus, format };
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

/**
 * Abre o menu nativo de compartilhar com a imagem já composta (mobile).
 * Deve ser chamado a partir de um gesto do usuário. Retorna true se compartilhado.
 */
export async function shareImageBlob(image: ComposedImage, stats?: WorkoutShareStats | null): Promise<boolean> {
  const file = new File([image.blob], "treino.jpg", { type: image.blob.type || "image/jpeg" });
  const nav = navigator as ShareableNavigator;
  if (typeof nav.share !== "function") return false;
  if (typeof nav.canShare === "function" && !nav.canShare({ files: [file] })) return false;
  try {
    await navigator.share({
      files: [file],
      title: `${BRAND} — treino concluído`,
      text: buildShareText({ focus: image.focus, stats }),
    });
    return true;
  } catch {
    // AbortError (cancelado) ou falha — não é erro a propagar.
    return false;
  }
}

/** Fallback desktop: baixa a imagem composta como arquivo .jpg. */
export function downloadComposedImage(image: ComposedImage, filename = "treino-s2core.jpg"): void {
  if (typeof document === "undefined") return;
  const a = document.createElement("a");
  a.href = image.dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
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
