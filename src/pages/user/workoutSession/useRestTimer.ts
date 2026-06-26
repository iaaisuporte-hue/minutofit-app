import { useCallback, useEffect, useRef, useState } from "react";

// Cronômetro de descanso (Fase 2). Baseado em INSTANTE ABSOLUTO (endsAt em ms),
// não em contagem de ticks — assim sobrevive a sair/voltar do app e à tela
// apagada (JS congela): ao reabrir, o restante é recalculado de endsAt - now.
// O alerta sonoro/vibração no fim degrada em silêncio onde a plataforma não
// suporta (iOS / desktop). Persistência do endsAt fica a cargo de quem usa
// (via onTick/restEndsAt) para o rascunho de sessão.

export interface RestTimer {
  /** Segundos restantes (0 quando inativo). */
  secondsLeft: number;
  /** Total planejado do descanso atual (para a barra de progresso). */
  totalSeconds: number;
  /** Há um descanso em andamento (rodando ou pausado). */
  active: boolean;
  running: boolean;
  /** Inicia um descanso de `seconds`. Ignora se seconds <= 0. */
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  /** Encerra o descanso e devolve quantos segundos foram efetivamente gastos. */
  skip: () => number;
  /** Soma segundos ao descanso atual (ex.: +15s). */
  add: (seconds: number) => void;
}

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* silencioso */
  }
}

function notifyDone() {
  beep();
  try {
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    /* silencioso */
  }
}

interface Options {
  /** Disparado quando o descanso chega a zero naturalmente. */
  onComplete?: () => void;
}

export function useRestTimer(opts: Options = {}): RestTimer {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [active, setActive] = useState(false);
  const [running, setRunning] = useState(false);

  // endsAt: instante (ms) em que o descanso termina (quando rodando).
  // pausedRemaining: segundos restantes quando pausado.
  const endsAtRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(opts.onComplete);
  useEffect(() => {
    onCompleteRef.current = opts.onComplete;
  }, [opts.onComplete]);

  const clearLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const settleDone = useCallback(() => {
    clearLoop();
    endsAtRef.current = null;
    pausedRemainingRef.current = null;
    setSecondsLeft(0);
    setRunning(false);
    setActive(false);
    if (!completedRef.current) {
      completedRef.current = true;
      notifyDone();
      onCompleteRef.current?.();
    }
  }, [clearLoop]);

  const recompute = useCallback(() => {
    if (endsAtRef.current == null) return;
    const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000));
    setSecondsLeft(left);
    if (left <= 0) settleDone();
  }, [settleDone]);

  const ensureLoop = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(recompute, 250);
  }, [recompute]);

  const start = useCallback(
    (seconds: number) => {
      if (!seconds || seconds <= 0) return;
      completedRef.current = false;
      const total = Math.round(seconds);
      startedAtRef.current = Date.now();
      endsAtRef.current = Date.now() + total * 1000;
      pausedRemainingRef.current = null;
      setTotalSeconds(total);
      setSecondsLeft(total);
      setActive(true);
      setRunning(true);
      ensureLoop();
    },
    [ensureLoop],
  );

  const pause = useCallback(() => {
    if (endsAtRef.current == null) return;
    const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000));
    pausedRemainingRef.current = left;
    endsAtRef.current = null;
    clearLoop();
    setSecondsLeft(left);
    setRunning(false);
  }, [clearLoop]);

  const resume = useCallback(() => {
    if (pausedRemainingRef.current == null) return;
    endsAtRef.current = Date.now() + pausedRemainingRef.current * 1000;
    pausedRemainingRef.current = null;
    setRunning(true);
    ensureLoop();
  }, [ensureLoop]);

  const elapsedSoFar = useCallback((): number => {
    const total = totalSeconds;
    if (pausedRemainingRef.current != null) return Math.max(0, total - pausedRemainingRef.current);
    if (endsAtRef.current != null) {
      const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000));
      return Math.max(0, total - left);
    }
    if (startedAtRef.current != null) return Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    return 0;
  }, [totalSeconds]);

  const skip = useCallback((): number => {
    const spent = elapsedSoFar();
    completedRef.current = true; // pular não dispara onComplete
    clearLoop();
    endsAtRef.current = null;
    pausedRemainingRef.current = null;
    setSecondsLeft(0);
    setRunning(false);
    setActive(false);
    return spent;
  }, [clearLoop, elapsedSoFar]);

  const add = useCallback((seconds: number) => {
    if (seconds === 0) return;
    if (endsAtRef.current != null) {
      endsAtRef.current += seconds * 1000;
      const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
    } else if (pausedRemainingRef.current != null) {
      pausedRemainingRef.current = Math.max(0, pausedRemainingRef.current + seconds);
      setSecondsLeft(pausedRemainingRef.current);
    }
    setTotalSeconds((t) => t + seconds);
  }, []);

  // Recalcula ao voltar à aba/app — corrige o congelamento do JS em background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") recompute();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", recompute);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", recompute);
    };
  }, [recompute]);

  useEffect(() => () => clearLoop(), [clearLoop]);

  return { secondsLeft, totalSeconds, active, running, start, pause, resume, skip, add };
}
