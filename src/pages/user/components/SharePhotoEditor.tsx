import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronLeft, RotateCcw } from "lucide-react";
import {
  computeCardLayout,
  getLogo,
  renderBackground,
  renderForeground,
  type CardLayout,
  type WorkoutShareExercise,
  type WorkoutShareFormat,
} from "../lib/shareWorkoutImage";
import { disposeCanvas, type PhotoLayers, type PhotoSession } from "../lib/sharePhotoSource";
import {
  defaultEdit,
  isDefaultEdit,
  type OverlayPreset,
  type PhotoAdjust,
  type PhotoFrame,
  type PhotoTransform,
  type ShareEdit,
} from "../lib/sharePhotoTransform";
import { usePhotoGestures } from "../lib/usePhotoGestures";
import { useDismissable } from "../../../lib/overlayStack";
import "./sharePhotoEditor.css";

// Editor de foto do card de compartilhamento: enquadrar (pinça/arraste),
// brilho/contraste da foto e escurecimento do fundo, por formato.
//
// Desempenho: nada de JPEG, decode ou filtro por frame. A cada frame só se
// redesenha o fundo (`renderBackground`) e se cola a camada fixa (texto,
// painel, logo) já pintada num canvas destacado. Brilho/contraste mudam a
// fonte via `session.setAdjust` com debounce — não o frame. A exportação final
// é do modal ("Concluir"), com as MESMAS funções de desenho.

export type ShareEdits = Record<WorkoutShareFormat, ShareEdit>;

export type SharePhotoEditorResult = {
  format: WorkoutShareFormat;
  edits: ShareEdits;
  /** Camadas com o ajuste do formato escolhido já aplicado (ou `null` se a foto se perdeu). */
  layers: PhotoLayers | null;
};

type Props = {
  session: PhotoSession;
  /** Camadas da sessão já sincronizadas com o ajuste de `initialEdits[initialFormat]`. */
  initialLayers: PhotoLayers;
  initialFormat: WorkoutShareFormat;
  /** Estado ao abrir — é para ele que "Voltar" retorna (o modal mantém a cópia dele). */
  initialEdits: ShareEdits;
  focus: string;
  exercises?: WorkoutShareExercise[] | null;
  eyebrow?: string;
  panelLabel?: string;
  onDone: (result: SharePhotoEditorResult) => void;
  onBack: () => void;
};

const CARD_W = 1080;
const ADJUST_DEBOUNCE_MS = 60;
const HINT_KEY = "s2core:share:gestureHintSeen";

const BRIGHTNESS = { min: 0.6, max: 1.4 } as const;
const CONTRAST = { min: 0.7, max: 1.3 } as const;

const FORMATS: ReadonlyArray<readonly [WorkoutShareFormat, string]> = [
  ["story", "Story 9:16"],
  ["square", "Feed 1:1"],
];
const OVERLAYS: ReadonlyArray<readonly [OverlayPreset, string]> = [
  ["soft", "Suave"],
  ["medium", "Médio"],
  ["strong", "Forte"],
];

type Stage = { w: number; h: number; dpr: number };
type View = { cssW: number; cssH: number; bw: number; bh: number; scale: number };

function cardHeight(fmt: WorkoutShareFormat): number {
  return fmt === "story" ? 1920 : 1080;
}

/**
 * Maior retângulo com a proporção EXATA do card que cabe no palco. Exata
 * porque o gesto converte px de tela em coordenada do card pelo retângulo do
 * próprio canvas — qualquer letterbox desalinharia o dedo da foto.
 * O backing store usa DPR limitado a 2: acima disso só gasta memória.
 */
function fitView(stage: Stage, fmt: WorkoutShareFormat): View {
  if (stage.w <= 0 || stage.h <= 0) return { cssW: 0, cssH: 0, bw: 0, bh: 0, scale: 0 };
  const ratio = cardHeight(fmt) / CARD_W;
  const cssW = Math.floor(Math.min(stage.w, stage.h / ratio));
  if (cssW <= 0) return { cssW: 0, cssH: 0, bw: 0, bh: 0, scale: 0 };
  const dpr = Math.min(2, Math.max(1, stage.dpr || 1));
  const bw = Math.max(1, Math.round(cssW * dpr));
  const bh = Math.max(1, Math.round(bw * ratio));
  return { cssW, cssH: cssW * ratio, bw, bh, scale: bw / CARD_W };
}

/**
 * Canvas (re)dimensionado e limpo. Atribuir largura/altura sempre limpa o
 * bitmap, mesmo com o mesmo valor — é isso que se quer ao trocar a chave.
 */
function resetCanvas(existing: HTMLCanvasElement | null, width: number, height: number): HTMLCanvasElement {
  const canvas = existing ?? document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function readHintSeen(): boolean {
  try {
    return window.sessionStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true; // storage bloqueado: melhor não mostrar do que mostrar sempre
  }
}

function sameAdjust(a: PhotoAdjust, b: PhotoAdjust): boolean {
  return a.brightness === b.brightness && a.contrast === b.contrast;
}

/** "+12%" / "−8%" / "Neutro" — leitura do slider relativa ao valor neutro (1,0). */
function relativeLabel(v: number): string {
  const pct = Math.round((v - 1) * 100);
  if (pct === 0) return "Neutro";
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

export function SharePhotoEditor({
  session,
  initialLayers,
  initialFormat,
  initialEdits,
  focus,
  exercises,
  eyebrow,
  panelLabel,
  onDone,
  onBack,
}: Props) {
  const [format, setFormat] = useState<WorkoutShareFormat>(initialFormat);
  const [edits, setEdits] = useState<ShareEdits>(initialEdits);
  const [layers, setLayers] = useState<PhotoLayers | null>(initialLayers);
  const [stage, setStage] = useState<Stage>({ w: 0, h: 0, dpr: 1 });
  const [logoReady, setLogoReady] = useState(false);
  const [showHint, setShowHint] = useState(() => !readHintSeen());

  // Espelhos síncronos do estado: o desenho (rAF) e os gestos leem daqui, não
  // do estado React, que só chega no próximo render. Ler o estado faria o
  // frame usar camadas já zeradas pelo `setAdjust` ou a foto "voltar" no gesto.
  const formatRef = useRef(initialFormat);
  const editsRef = useRef(initialEdits);
  const layersRef = useRef<PhotoLayers | null>(initialLayers);
  const stageRef = useRef<Stage>({ w: 0, h: 0, dpr: 1 });
  const logoRef = useRef<HTMLImageElement | null | undefined>(undefined);
  const contentRef = useRef({ focus, exercises, eyebrow, panelLabel });
  const layoutCache = useRef(new Map<WorkoutShareFormat, CardLayout>());
  const fgRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const adjustTimer = useRef<number | null>(null);

  useLayoutEffect(() => {
    contentRef.current = { focus, exercises, eyebrow, panelLabel };
    // Conteúdo novo = texto novo: layout e camada fixa precisam ser refeitos.
    layoutCache.current.clear();
    if (fgRef.current) fgRef.current.key = "";
  }, [focus, exercises, eyebrow, panelLabel]);

  const layoutFor = useCallback((fmt: WorkoutShareFormat): CardLayout => {
    let l = layoutCache.current.get(fmt);
    if (!l) {
      l = computeCardLayout(fmt, contentRef.current);
      layoutCache.current.set(fmt, l);
    }
    return l;
  }, []);

  /** Camada fixa pintada uma vez por (formato, overlay, escala). Um canvas só, reaproveitado. */
  const foregroundFor = useCallback(
    (fmt: WorkoutShareFormat, overlay: OverlayPreset | null, v: View, layout: CardLayout) => {
      const key = `${fmt}|${overlay ?? "none"}|${v.bw}x${v.bh}`;
      const cached = fgRef.current;
      if (cached && cached.key === key && cached.canvas.width > 0) return cached.canvas;
      const canvas = resetCanvas(cached?.canvas ?? null, v.bw, v.bh);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      renderForeground(ctx, v.scale, layout, logoRef.current ?? null, overlay);
      fgRef.current = { key, canvas };
      return canvas;
    },
    [],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    // Logo ainda carregando: esperar evita o "S2Core" em texto piscar antes do SVG.
    if (!canvas || logoRef.current === undefined) return;
    const fmt = formatRef.current;
    const v = fitView(stageRef.current, fmt);
    if (v.bw === 0) return;
    if (canvas.width !== v.bw) canvas.width = v.bw;
    if (canvas.height !== v.bh) canvas.height = v.bh;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const edit = editsRef.current[fmt];
    const photo = layersRef.current;
    const layout = layoutFor(fmt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderBackground(ctx, v.scale, photo, edit, layout);
    const hasPhoto = !!photo && photo.adjusted.width > 0;
    const fg = foregroundFor(fmt, hasPhoto ? edit.overlay : null, v, layout);
    if (fg) ctx.drawImage(fg, 0, 0);
  }, [layoutFor, foregroundFor]);

  /** Um único frame pendente; ele lê o estado mais recente quando roda. */
  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw, layers, edits, format, stage, logoReady]);

  // Logo decodificado uma vez por sessão (memo do módulo); só então o 1º frame.
  useEffect(() => {
    let alive = true;
    void getLogo().then((logo) => {
      if (!alive) return;
      logoRef.current = logo;
      if (fgRef.current) fgRef.current.key = "";
      setLogoReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Palco: mede a área livre e refaz a escala (e com ela a camada fixa) quando
  // a tela gira ou o teclado/barra do navegador muda a altura.
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { w: r.width, h: r.height, dpr: window.devicePixelRatio || 1 };
      const prev = stageRef.current;
      if (prev.w === next.w && prev.h === next.h && prev.dpr === next.dpr) return;
      stageRef.current = next;
      setStage(next);
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  // Saída do editor: frame pendente, debounce e TODOS os pixels deste editor
  // são liberados já — em WebView com foto grande, esperar o GC custa a aba.
  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (adjustTimer.current !== null) window.clearTimeout(adjustTimer.current);
      adjustTimer.current = null;
      disposeCanvas(fgRef.current?.canvas);
      fgRef.current = null;
      disposeCanvas(canvas);
    };
  }, []);

  // A dica aparece uma vez por sessão do app: já conta como vista ao abrir.
  useEffect(() => {
    if (!showHint) return;
    try {
      window.sessionStorage.setItem(HINT_KEY, "1");
    } catch {
      /* storage bloqueado — a dica só reaparece na próxima abertura */
    }
  }, [showHint]);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  function commitEdits(next: ShareEdits) {
    editsRef.current = next;
    setEdits(next);
  }

  function commitLayers(next: PhotoLayers | null) {
    layersRef.current = next;
    setLayers(next);
  }

  /** Aplica na fonte o ajuste do formato ATUAL (lido na hora, não capturado). */
  function applyAdjustNow(): PhotoLayers | null {
    if (adjustTimer.current !== null) {
      window.clearTimeout(adjustTimer.current);
      adjustTimer.current = null;
    }
    const want = editsRef.current[formatRef.current].adjust;
    const cur = layersRef.current;
    if (cur && sameAdjust(cur.adjust, want)) return cur;
    let next: PhotoLayers | null;
    try {
      next = session.setAdjust(want);
    } catch {
      // Contexto 2D indisponível: a sessão já se esvaziou; segue sem foto.
      next = session.layers;
    }
    commitLayers(next);
    return next;
  }

  function scheduleAdjust() {
    if (adjustTimer.current !== null) window.clearTimeout(adjustTimer.current);
    adjustTimer.current = window.setTimeout(() => {
      adjustTimer.current = null;
      applyAdjustNow();
    }, ADJUST_DEBOUNCE_MS);
  }

  function updateCurrent(patch: Partial<ShareEdit>) {
    const fmt = formatRef.current;
    commitEdits({ ...editsRef.current, [fmt]: { ...editsRef.current[fmt], ...patch } });
  }

  function onAdjust(key: keyof PhotoAdjust, value: number) {
    if (!Number.isFinite(value)) return;
    updateCurrent({ adjust: { ...editsRef.current[formatRef.current].adjust, [key]: value } });
    scheduleAdjust();
  }

  function onFormat(fmt: WorkoutShareFormat) {
    if (fmt === formatRef.current) return;
    formatRef.current = fmt;
    setFormat(fmt);
    // Cada formato tem seu ajuste; troca a fonte só se o valor for outro (cache por valor).
    applyAdjustNow();
  }

  function onRestore() {
    commitEdits({ ...editsRef.current, [formatRef.current]: defaultEdit() });
    applyAdjustNow();
  }

  function onConcluir() {
    const finalLayers = applyAdjustNow();
    onDone({ format: formatRef.current, edits: editsRef.current, layers: finalLayers });
  }

  // Identidade estável: `useDismissable` re-registra na pilha quando ela muda.
  const voltar = useCallback(() => {
    if (adjustTimer.current !== null) {
      window.clearTimeout(adjustTimer.current);
      adjustTimer.current = null;
    }
    onBack();
  }, [onBack]);
  useDismissable(voltar);

  const getFrame = useCallback((): PhotoFrame | null => {
    const l = layersRef.current;
    if (!l || l.source.width === 0 || l.source.height === 0) return null;
    return { imgW: l.source.width, imgH: l.source.height, canvasW: CARD_W, canvasH: cardHeight(formatRef.current) };
  }, []);
  const getTransform = useCallback(() => editsRef.current[formatRef.current].transform, []);
  const onTransform = useCallback((t: PhotoTransform) => {
    const fmt = formatRef.current;
    const next = { ...editsRef.current, [fmt]: { ...editsRef.current[fmt], transform: t } };
    editsRef.current = next;
    // Desenha já neste rAF (o frame lê `editsRef`); esperar render → efeito
    // somaria um frame de atraso entre o dedo e a foto.
    scheduleDraw();
    setEdits(next);
    setShowHint(false);
  }, [scheduleDraw]);
  usePhotoGestures({ targetRef: canvasRef, getFrame, getTransform, onChange: onTransform, enabled: true });

  const current = edits[format];
  const view = fitView(stage, format);
  const canRestore = !isDefaultEdit(current);
  const { brightness, contrast } = current.adjust;

  return (
    <div
      ref={rootRef}
      className="spe"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar foto"
      tabIndex={-1}
    >
      <div className="spe-header">
        <button type="button" className="spe-back" onClick={voltar}>
          <ChevronLeft size={20} aria-hidden="true" />
          Voltar
        </button>
        <div className="spe-segmented spe-formats" role="group" aria-label="Formato do card">
          {FORMATS.map(([fmt, label]) => (
            <button
              key={fmt}
              type="button"
              className="spe-seg"
              aria-pressed={format === fmt}
              onClick={() => onFormat(fmt)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="spe-stage">
        <div className="spe-fit" ref={fitRef}>
          <canvas
            ref={canvasRef}
            className="spe-canvas"
            role="img"
            aria-label="Prévia do card. Pince para dar zoom e arraste para posicionar a foto."
            style={{ width: view.cssW, height: view.cssH }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {showHint ? (
            <div className="spe-hint" aria-hidden="true">
              Pince para zoom · arraste para posicionar
            </div>
          ) : null}
        </div>
      </div>

      <div className="spe-controls">
        <div className="spe-group">
          <span className="spe-group-title">Ajuste da foto</span>
          <label className="spe-slider">
            <span className="spe-slider-label">Brilho</span>
            <input
              type="range"
              className="spe-range"
              min={BRIGHTNESS.min}
              max={BRIGHTNESS.max}
              step={0.01}
              value={brightness}
              aria-label="Brilho da foto"
              aria-valuetext={relativeLabel(brightness)}
              onChange={(e) => onAdjust("brightness", Number(e.target.value))}
            />
            <span className="spe-slider-value" aria-hidden="true">{relativeLabel(brightness)}</span>
          </label>
          <label className="spe-slider">
            <span className="spe-slider-label">Contraste</span>
            <input
              type="range"
              className="spe-range"
              min={CONTRAST.min}
              max={CONTRAST.max}
              step={0.01}
              value={contrast}
              aria-label="Contraste da foto"
              aria-valuetext={relativeLabel(contrast)}
              onChange={(e) => onAdjust("contrast", Number(e.target.value))}
            />
            <span className="spe-slider-value" aria-hidden="true">{relativeLabel(contrast)}</span>
          </label>
        </div>

        <div className="spe-group">
          <span className="spe-group-title" id="spe-overlay-title">Escurecimento do fundo</span>
          <span className="spe-group-help">Sombra sobre a foto para o texto ficar legível.</span>
          <div className="spe-segmented" role="group" aria-labelledby="spe-overlay-title">
            {OVERLAYS.map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                className="spe-seg"
                aria-pressed={current.overlay === preset}
                onClick={() => updateCurrent({ overlay: preset })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="spe-actions">
          <button type="button" className="spe-btn" onClick={onRestore} disabled={!canRestore}>
            <RotateCcw size={16} aria-hidden="true" />
            Restaurar
          </button>
          <button type="button" className="spe-btn spe-btn-primary" onClick={onConcluir}>
            <Check size={16} aria-hidden="true" />
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
