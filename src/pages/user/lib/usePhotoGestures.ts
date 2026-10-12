// Gestos de enquadramento da foto no editor: arrastar com um dedo, pinça com
// dois (zoom ancorado entre os dedos + arraste junto) e roda do mouse no desktop.
//
// Pointer Events puros, sem lib: o `framer-motion` do projeto não faz pinça e
// um plugin novo seria peso para três gestos. Todo cálculo vive em
// `sharePhotoTransform.ts`; aqui só se traduz evento → coordenada do card.

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { applyPan, applyPinch, type PhotoFrame, type PhotoTransform } from "./sharePhotoTransform";

export type PhotoGestureOptions = {
  /**
   * Superfície que recebe os toques — o próprio canvas da prévia. A conversão
   * de px de tela para coordenada do card usa o retângulo dela, então ela
   * precisa ter a proporção do card (sem letterbox por `object-fit`).
   * Use `touch-action: none` no CSS dela.
   */
  targetRef: RefObject<HTMLElement | null>;
  /** Foto + card atuais; `null` (sem foto) ignora os gestos. */
  getFrame: () => PhotoFrame | null;
  /**
   * Enquadramento atual. Precisa refletir o último `onChange` de forma SÍNCRONA
   * (ex.: ler de um ref atualizado dentro do `onChange`) — o estado React pode
   * ainda não ter renderizado quando o próximo gesto começa, e a foto pularia
   * de volta.
   */
  getTransform: () => PhotoTransform;
  /** No máximo uma chamada por frame, sempre com o valor mais recente. */
  onChange: (t: PhotoTransform) => void;
  /** Liga/desliga. Os listeners são (re)instalados quando vira `true`. */
  enabled?: boolean;
};

type Point = { x: number; y: number };

// Sensibilidade da roda: `ctrlKey` é como o Chrome/Safari entregam a pinça do
// trackpad (deltas pequenos e frequentes); roda de mouse manda degraus de ~100.
const WHEEL_ZOOM_PINCH = 0.01;
const WHEEL_ZOOM_MOUSE = 0.0015;
const LINE_HEIGHT_PX = 16;

export function usePhotoGestures({ targetRef, getFrame, getTransform, onChange, enabled = true }: PhotoGestureOptions): void {
  // Callbacks mais recentes sem reinstalar listeners a cada render.
  const latest = useRef({ getFrame, getTransform, onChange });
  useLayoutEffect(() => {
    latest.current = { getFrame, getTransform, onChange };
  });

  useEffect(() => {
    const el = targetRef.current;
    if (!enabled || !el) return;

    // Ponteiros ativos, em px de tela. Mais de dois são ignorados.
    const pointers = new Map<number, Point>();
    // Valor de trabalho enquanto há gesto ou frame pendente: eventos chegam
    // várias vezes por frame e não podem esperar o estado do pai renderizar.
    let working: PhotoTransform | null = null;
    let raf: number | null = null;
    // Retângulo medido no início do gesto: medir a cada `pointermove` forçaria layout.
    let rect: DOMRect | null = null;

    const current = (): PhotoTransform => {
      if (working && (pointers.size > 0 || raf !== null)) return working;
      return latest.current.getTransform();
    };

    const schedule = (t: PhotoTransform) => {
      working = t;
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        if (working) latest.current.onChange(working);
      });
    };

    /** Px de tela → coordenada lógica do card. */
    const toCard = (p: Point, frame: PhotoFrame): Point => {
      const r = rect ?? el.getBoundingClientRect();
      const sx = r.width > 0 ? frame.canvasW / r.width : 1;
      const sy = r.height > 0 ? frame.canvasH / r.height : 1;
      return { x: (p.x - r.left) * sx, y: (p.y - r.top) * sy };
    };

    const onPointerDown = (e: PointerEvent) => {
      // Só botão principal: botão do meio/direito do mouse não arrasta foto.
      if (e.button !== 0 || pointers.size >= 2) return;
      if (!latest.current.getFrame()) return;
      if (pointers.size === 0) {
        rect = el.getBoundingClientRect();
        working = current();
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ponteiro já liberado pelo navegador — o gesto segue sem captura */
      }
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      const frame = latest.current.getFrame();
      if (!prev || !frame) return;
      const next = { x: e.clientX, y: e.clientY };
      const base = current();

      if (pointers.size === 1) {
        const a = toCard(prev, frame);
        const b = toCard(next, frame);
        pointers.set(e.pointerId, next);
        schedule(applyPan(base, frame, b.x - a.x, b.y - a.y));
        return;
      }

      // Dois dedos: foco e distância antes e depois de ESTE dedo mover.
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (!other) return;
      const o = toCard(other, frame);
      const a = toCard(prev, frame);
      const b = toCard(next, frame);
      pointers.set(e.pointerId, next);
      const focalBefore = { x: (o.x + a.x) / 2, y: (o.y + a.y) / 2 };
      const focalAfter = { x: (o.x + b.x) / 2, y: (o.y + b.y) / 2 };
      const distBefore = Math.hypot(a.x - o.x, a.y - o.y);
      const distAfter = Math.hypot(b.x - o.x, b.y - o.y);
      const scaleDelta = distBefore > 0 ? distAfter / distBefore : 1;
      schedule(
        applyPinch(base, frame, focalBefore, scaleDelta, {
          dx: focalAfter.x - focalBefore.x,
          dy: focalAfter.y - focalBefore.y,
        }),
      );
    };

    // Soltar, cancelar (o sistema roubou o toque) e perder a captura terminam
    // o gesto do mesmo jeito: a foto fica onde está, nunca "volta".
    const onPointerEnd = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (pointers.size === 0) rect = null;
    };

    const onWheel = (e: WheelEvent) => {
      const frame = latest.current.getFrame();
      if (!frame) return;
      // Sem isto a página rola (ou dá zoom de página, no `ctrlKey`) junto.
      e.preventDefault();
      const unit = e.deltaMode === 1 ? LINE_HEIGHT_PX : e.deltaMode === 2 ? frame.canvasH : 1;
      const k = e.ctrlKey ? WHEEL_ZOOM_PINCH : WHEEL_ZOOM_MOUSE;
      const scaleDelta = Math.exp(-e.deltaY * unit * k);
      const focal = toCard({ x: e.clientX, y: e.clientY }, frame);
      schedule(applyPinch(current(), frame, focal, scaleDelta));
    };

    // O iOS ainda rola/dá zoom de página em alguns casos mesmo com
    // `touch-action: none`; cancelar o `touchmove` fecha a brecha.
    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    // Toque longo no Android abre "salvar imagem" no meio do arraste.
    const onContextMenu = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);
    el.addEventListener("lostpointercapture", onPointerEnd);
    // `passive: false` explícito: Chrome trata wheel/touchmove no alvo como
    // passivos por padrão e ignoraria o `preventDefault`.
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
      el.removeEventListener("lostpointercapture", onPointerEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("contextmenu", onContextMenu);
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      pointers.clear();
    };
  }, [targetRef, enabled]);
}
