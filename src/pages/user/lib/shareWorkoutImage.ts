// Compartilhamento da conquista do treino como imagem-card de marca, no estilo
// GymRats/Strava: a foto do aluno (tirada ou da galeria) vira o FUNDO e os dados
// do treino + marca ficam sobrepostos com um scrim escuro para legibilidade.
//
// Fluxo: compose (gera blob + preview) → share (Web Share API com arquivo).
// Separados de propósito: o share() precisa de gesto do usuário e é chamado a
// partir do botão "Compartilhar" do preview. Restrito ao mobile por capacidade.

const BRAND = "S2Core"; // marca pública do app (domínio corefit.com.br)

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

export type ComposeWorkoutInput = {
  /** Foco do treino exibido em destaque, ex.: "Superiores". */
  focus: string;
  /** Nome do dia, ex.: "Treino B" — omitido se igual ao foco. */
  dayName?: string;
  /** Foto de fundo opcional (tirada ou da galeria). Sem ela, usa um fundo gradiente. */
  backgroundFile?: File | Blob | null;
  /** Proporção do card. Padrão: "story". */
  format?: WorkoutShareFormat;
  /** Estatísticas seguras opcionais — exibidas como linha discreta no card. */
  stats?: WorkoutShareStats | null;
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

export type ComposedImage = { blob: Blob; dataUrl: string; focus: string; format: WorkoutShareFormat };

/** Monta o card-imagem (story 1080×1920 ou square 1080²) e devolve blob + dataUrl. */
export async function composeWorkoutImage({ focus, dayName, backgroundFile, format = "story", stats }: ComposeWorkoutInput): Promise<ComposedImage> {
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  // Lift extra no rodapé: Story afasta da UI do Instagram; square dá respiro mínimo.
  const lift = format === "story" ? 140 : 40;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");

  const primary = cssVar("--color-primary", "#7B9919");

  // 1) Fundo: foto (cover) ou gradiente
  if (backgroundFile) {
    const img = await loadImage(backgroundFile);
    drawCover(ctx, img, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0b1220");
    grad.addColorStop(1, "#0f2a24");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // 2) Scrim escuro de baixo p/ cima — story precisa de cobertura maior (mais foto exposta)
  const scrimStart = format === "story" ? H * 0.28 : H * 0.34;
  const scrim = ctx.createLinearGradient(0, scrimStart, 0, H);
  scrim.addColorStop(0, "rgba(7,12,18,0)");
  scrim.addColorStop(1, "rgba(7,12,18,0.88)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // 3) Faixa de marca no topo — verde primário S2Core (coeso com o logo)
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, W, 14);

  // 4) Bloco de rodapé coeso, ancorado de baixo p/ cima com ritmo consistente:
  //    [eyebrow] · [herói multilinha] · [data] · [logo]
  const padX = 96;
  const isStory = format === "story";
  ctx.textAlign = "left";

  // Zona segura inferior (no Story, afasta da UI do Instagram)
  const bottomSafe = lift + (isStory ? 16 : 24);

  // — Logo (âncora de marca, base do bloco)
  const logoImg = await loadSvgLogo();
  const logoW = isStory ? 470 : 300;
  const logoH = Math.round(logoW * (56 / 264));
  const logoTop = H - bottomSafe - logoH;

  // — Tokens de espaçamento vertical (ritmo do rodapé)
  const gapLogoDate = isStory ? 78 : 58;
  const gapDateHero = isStory ? 82 : 56;
  const gapHeroEyebrow = isStory ? 42 : 30;

  // — Data (acima do logo)
  const dateSize = isStory ? 38 : 34;
  const dateBaseline = logoTop - gapLogoDate;

  // — Herói (foco do treino): encolhe p/ caber em até 3 linhas, "+" verde deliberado
  const hero = buildHeroLines(ctx, focus, W - padX * 2, isStory ? 132 : 108, 3, 800);
  const heroLineH = Math.round(hero.size * 1.06);
  const heroLastBaseline = dateBaseline - dateSize - gapDateHero;

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
  const heroTopBaseline = heroLastBaseline - (hero.lines.length - 1) * heroLineH;
  const eyebrowSize = isStory ? 40 : 34;
  const eyebrowBaseline = heroTopBaseline - Math.round(hero.size * 0.72) - gapHeroEyebrow;
  ctx.font = `700 ${eyebrowSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  const hasTracking = "letterSpacing" in ctx;
  if (hasTracking) (ctx as unknown as { letterSpacing: string }).letterSpacing = isStory ? "4px" : "3px";
  ctx.fillText("TREINO CONCLUÍDO", padX, eyebrowBaseline);
  if (hasTracking) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";

  // — Stats seguros (acima do eyebrow): linha discreta "45 min · 18/22 séries · 1240 kg"
  const chips = buildStatChips(stats);
  if (chips.length) {
    const statsSize = isStory ? 34 : 28;
    const statsBaseline = eyebrowBaseline - eyebrowSize - (isStory ? 30 : 22);
    ctx.font = `600 ${statsSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.fillText(chips.join("  ·  "), padX, statsBaseline);
  }

  // — Data
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const meta = dayName && dayName.trim() && dayName.trim() !== focus.trim()
    ? `${dayName.trim()} · ${dateStr}`
    : dateStr;
  ctx.font = `500 ${dateSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(meta, padX, dateBaseline);

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
