import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRestTimer } from "./useRestTimer";

// Feature madura: cronômetro de descanso (docs/MATURE_FEATURES.md). Blindagem
// de regressão dos comportamentos que importam — em especial a propriedade
// que justifica a existência do hook: contagem por INSTANTE ABSOLUTO, que
// sobrevive ao congelamento do JS em background (tela apagada / app em 2º plano).
//
// vi.useFakeTimers() mocka Date E setInterval juntos, então advanceTimersByTime
// avança o relógio que o recompute lê — coerente com o próprio hook.

describe("useRestTimer (feature madura: cronômetro de descanso)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("start(seconds) ativa o descanso com o total informado", () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(60));
    expect(result.current.active).toBe(true);
    expect(result.current.running).toBe(true);
    expect(result.current.secondsLeft).toBe(60);
    expect(result.current.totalSeconds).toBe(60);
  });

  it("start com 0 ou negativo é no-op (não inicia)", () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(0));
    expect(result.current.active).toBe(false);
    act(() => result.current.start(-5));
    expect(result.current.active).toBe(false);
  });

  it("conta regressivamente e dispara onComplete ao zerar", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer({ onComplete }));
    act(() => result.current.start(10));
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.secondsLeft).toBeLessThanOrEqual(6);
    expect(result.current.secondsLeft).toBeGreaterThanOrEqual(5);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(6500));
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.active).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("pause congela o restante; resume retoma de onde parou", () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(30));
    act(() => vi.advanceTimersByTime(10_000));
    const beforePause = result.current.secondsLeft; // ~20

    act(() => result.current.pause());
    expect(result.current.running).toBe(false);
    act(() => vi.advanceTimersByTime(10_000)); // tempo passa, mas está pausado
    expect(result.current.secondsLeft).toBe(beforePause);

    act(() => result.current.resume());
    expect(result.current.running).toBe(true);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.secondsLeft).toBeLessThan(beforePause);
  });

  it("add estende o restante e o total", () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(30));
    act(() => result.current.add(15));
    expect(result.current.secondsLeft).toBe(45);
    expect(result.current.totalSeconds).toBe(45);
  });

  it("skip devolve os segundos gastos e encerra sem disparar onComplete", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer({ onComplete }));
    act(() => result.current.start(30));
    act(() => vi.advanceTimersByTime(12_000));
    let spent = 0;
    act(() => {
      spent = result.current.skip();
    });
    expect(spent).toBeGreaterThanOrEqual(11);
    expect(spent).toBeLessThanOrEqual(13);
    expect(result.current.active).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("sobrevive ao background: recomputa por instante absoluto ao reganhar foco", () => {
    // Propriedade-assinatura. Simula o JS congelado em 2º plano: o relógio
    // salta além do fim SEM os ticks do setInterval terem rodado; ao voltar o
    // foco, o hook recalcula de endsAt - now e encerra corretamente.
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer({ onComplete }));
    act(() => result.current.start(30));

    const jumpedTo = Date.now() + 45_000; // 45s depois — além dos 30s
    act(() => {
      vi.setSystemTime(jumpedTo); // move o relógio sem avançar os timers
      window.dispatchEvent(new Event("focus"));
    });

    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.active).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
