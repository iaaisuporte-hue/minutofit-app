// Compartilhamento da conquista do treino como imagem-card de marca.
// Gera um PNG no canvas (foco do treino + marca do app) e abre o menu nativo
// de compartilhar do celular via Web Share API com arquivo. Restrito ao mobile
// por capacidade: navegadores desktop não compartilham arquivos por share().

const BRAND = "MinutoFit"; // marca pública do app (domínio minutofit.com.br)

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

export type ShareWorkoutInput = {
  /** Foco do treino exibido em destaque, ex.: "Superiores". */
  focus: string;
  /** Nome do dia, ex.: "Treino B" — omitido se igual ao foco. */
  dayName?: string;
};

/**
 * Gera o card-imagem e dispara o compartilhamento nativo.
 * Retorna true se compartilhado, false se cancelado/indisponível.
 */
export async function shareWorkoutImage({ focus, dayName }: ShareWorkoutInput): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const primary = cssVar("--color-primary", "#16a34a");
  const accent = cssVar("--color-accent", "#06b6d4");

  // Fundo
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#0b1220");
  grad.addColorStop(1, "#0f2a24");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Faixa de marca (accent) no topo
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, size, 14);

  const padX = 96;
  ctx.textAlign = "left";

  // Eyebrow
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "700 34px Inter, system-ui, sans-serif";
  ctx.fillText("TREINO CONCLUÍDO", padX, 210);

  // Foco em destaque (até 2 linhas)
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 116px Inter, system-ui, sans-serif";
  const lines = wrap(ctx, focus, size - padX * 2).slice(0, 2);
  let y = 372;
  for (const line of lines) {
    ctx.fillText(line, padX, y);
    y += 128;
  }

  // Nome do dia (se diferente do foco)
  if (dayName && dayName.trim() && dayName.trim() !== focus.trim()) {
    ctx.fillStyle = primary;
    ctx.font = "700 44px Inter, system-ui, sans-serif";
    ctx.fillText(dayName.trim(), padX, y + 16);
    y += 70;
  }

  // Data
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 34px Inter, system-ui, sans-serif";
  ctx.fillText(dateStr, padX, y + 64);

  // Marca no rodapé
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 56px Inter, system-ui, sans-serif";
  ctx.fillText(BRAND, padX, size - 110);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png", 0.92));
  if (!blob) return false;
  const file = new File([blob], "treino.png", { type: "image/png" });

  const nav = navigator as ShareableNavigator;
  if (typeof nav.canShare === "function" && !nav.canShare({ files: [file] })) return false;

  try {
    await navigator.share({
      files: [file],
      title: `${BRAND} — treino concluído`,
      text: `Treino de ${focus} concluído. 💪 ${BRAND}`,
    });
    return true;
  } catch {
    // AbortError (usuário cancelou) ou falha — não é erro a propagar.
    return false;
  }
}
