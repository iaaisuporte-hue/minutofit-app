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

export type ComposeWorkoutInput = {
  /** Foco do treino exibido em destaque, ex.: "Superiores". */
  focus: string;
  /** Nome do dia, ex.: "Treino B" — omitido se igual ao foco. */
  dayName?: string;
  /** Foto de fundo opcional (tirada ou da galeria). Sem ela, usa um fundo gradiente. */
  backgroundFile?: File | Blob | null;
  /** Proporção do card. Padrão: "story". */
  format?: WorkoutShareFormat;
};

export type ComposedImage = { blob: Blob; dataUrl: string; focus: string; format: WorkoutShareFormat };

/** Monta o card-imagem (story 1080×1920 ou square 1080²) e devolve blob + dataUrl. */
export async function composeWorkoutImage({ focus, dayName, backgroundFile, format = "story" }: ComposeWorkoutInput): Promise<ComposedImage> {
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  // Lift extra no rodapé: Story afasta da UI do Instagram; square dá respiro mínimo.
  const lift = format === "story" ? 140 : 40;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");

  const primary = cssVar("--color-primary", "#16a34a");
  const accent = cssVar("--color-accent", "#06b6d4");

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

  // 3) Faixa de marca (accent) no topo
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 14);

  // 4) Texto ancorado no rodapé (com lift extra no formato story)
  const padX = 96;
  ctx.textAlign = "left";

  // Story: fonte maior ocupa melhor os 1920px de altura; square mantém 110px
  const focusFontSize = format === "story" ? 128 : 110;
  ctx.font = `800 ${focusFontSize}px Inter, system-ui, sans-serif`;
  const focusLines = wrap(ctx, focus, W - padX * 2).slice(0, 2);
  const lineH = focusFontSize + 14;
  const focusBottom = H - 234 - lift;

  ctx.fillStyle = "#ffffff";
  focusLines.forEach((line, i) => {
    const yy = focusBottom - (focusLines.length - 1 - i) * lineH;
    ctx.fillText(line, padX, yy);
  });

  const focusTop = focusBottom - (focusLines.length - 1) * lineH - (focusFontSize - 18);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "700 38px Inter, system-ui, sans-serif";
  ctx.fillText("TREINO CONCLUÍDO", padX, focusTop - 8);

  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const meta = dayName && dayName.trim() && dayName.trim() !== focus.trim()
    ? `${dayName.trim()} · ${dateStr}`
    : dateStr;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "500 36px Inter, system-ui, sans-serif";
  ctx.fillText(meta, padX, H - 148 - lift);

  // Logo CoreFit (SVG claro para fundo escuro) — fallback para texto se SVG não carregar
  const logoImg = await loadSvgLogo();
  if (logoImg) {
    // viewBox 264×56 → story: 260px, square: 220px
    const logoW = format === "story" ? 260 : 220;
    const logoH = Math.round(logoW * (56 / 264));
    ctx.drawImage(logoImg, padX, H - 80 - lift - logoH, logoW, logoH);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 52px Inter, system-ui, sans-serif";
    ctx.fillText(BRAND, padX, H - 80 - lift);
    const brandWidth = ctx.measureText(BRAND).width;
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.arc(padX + brandWidth + 18, H - 98 - lift, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) throw new Error("falha ao gerar imagem");
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { blob, dataUrl, focus, format };
}

/**
 * Abre o menu nativo de compartilhar com a imagem já composta.
 * Deve ser chamado a partir de um gesto do usuário. Retorna true se compartilhado.
 */
export async function shareImageBlob(image: ComposedImage): Promise<boolean> {
  const file = new File([image.blob], "treino.jpg", { type: image.blob.type || "image/jpeg" });
  const nav = navigator as ShareableNavigator;
  if (typeof nav.share !== "function") return false;
  if (typeof nav.canShare === "function" && !nav.canShare({ files: [file] })) return false;
  try {
    await navigator.share({
      files: [file],
      title: `${BRAND} — treino concluído`,
      text: `Treino de ${image.focus} concluído. 💪 ${BRAND}`,
    });
    return true;
  } catch {
    // AbortError (cancelado) ou falha — não é erro a propagar.
    return false;
  }
}
