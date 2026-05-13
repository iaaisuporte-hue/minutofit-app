import { useCallback, useEffect, useRef } from "react";

export type AdaptivePollingIntervals = {
  activeIntervalMs: number;
  idleIntervalMs: number;
  hiddenIntervalMs: number;
  idleAfterMs: number;
};

export const DEFAULT_ADAPTIVE_POLLING: AdaptivePollingIntervals = {
  activeIntervalMs: 5000,
  idleIntervalMs: 15000,
  hiddenIntervalMs: 60000,
  idleAfterMs: 60000,
};

/**
 * Polling whose interval depends on tab visibility and time since last interaction.
 * Call `bumpInteraction()` on meaningful user actions so "active" stays 5s.
 */
export function useAdaptivePolling(
  callback: () => void,
  options: Partial<AdaptivePollingIntervals> = {}
) {
  const cfg = { ...DEFAULT_ADAPTIVE_POLLING, ...options };
  const lastIx = useRef(0);

  useEffect(() => {
    lastIx.current = Date.now();
  }, []);
  const bumpInteraction = useCallback(() => {
    lastIx.current = Date.now();
  }, []);

  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let to: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const delay = () => {
      const vis = document.visibilityState === "visible";
      const idle = Date.now() - lastIx.current;
      return !vis ? cfg.hiddenIntervalMs : idle < cfg.idleAfterMs ? cfg.activeIntervalMs : cfg.idleIntervalMs;
    };

    const loop = () => {
      if (cancelled) return;
      cbRef.current();
      to = setTimeout(loop, delay());
    };

    const bumpSchedule = () => {
      clearTimeout(to);
      to = setTimeout(loop, delay());
    };

    to = setTimeout(loop, delay());
    document.addEventListener("visibilitychange", bumpSchedule);
    return () => {
      cancelled = true;
      clearTimeout(to);
      document.removeEventListener("visibilitychange", bumpSchedule);
    };
  }, [cfg.activeIntervalMs, cfg.hiddenIntervalMs, cfg.idleAfterMs, cfg.idleIntervalMs]);

  return { bumpInteraction };
}
