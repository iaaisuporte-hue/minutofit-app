import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMediaQuery } from "./useMediaQuery";
import { useIsMobile } from "./useIsMobile";

type Listener = () => void;

function mockMatchMedia(initial: Record<string, boolean>) {
  const state = { ...initial };
  const listeners = new Map<string, Set<Listener>>();
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return !!state[query];
    },
    media: query,
    addEventListener: (_: string, l: Listener) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(l);
    },
    removeEventListener: (_: string, l: Listener) => listeners.get(query)?.delete(l),
  })) as unknown as typeof window.matchMedia;
  return {
    set(query: string, value: boolean) {
      state[query] = value;
      listeners.get(query)?.forEach((l) => l());
    },
  };
}

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});

describe("useMediaQuery", () => {
  it("responde pelo matchMedia já na primeira renderização (sem flash desktop→mobile)", () => {
    mockMatchMedia({ "(max-width: 980px)": true });
    const { result } = renderHook(() => useMediaQuery("(max-width: 980px)"));
    expect(result.current).toBe(true);
  });

  it("acompanha mudanças da query (rotação / redimensionamento)", () => {
    const mm = mockMatchMedia({ "(max-width: 980px)": false });
    const { result } = renderHook(() => useMediaQuery("(max-width: 980px)"));
    expect(result.current).toBe(false);
    act(() => mm.set("(max-width: 980px)", true));
    expect(result.current).toBe(true);
  });

  it("sem matchMedia (jsdom), usa o fallback e reavalia no resize", () => {
    // @ts-expect-error simula ambiente sem matchMedia
    window.matchMedia = undefined;
    const { result } = renderHook(() => useIsMobile(720));
    const before = window.innerWidth;
    window.innerWidth = 600;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(result.current).toBe(true);
    window.innerWidth = 1200;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(result.current).toBe(false);
    window.innerWidth = before;
  });
});
