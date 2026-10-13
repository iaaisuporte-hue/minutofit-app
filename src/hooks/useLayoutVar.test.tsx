import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLayoutVar } from "./useLayoutVar";

function Probe({ height, active = true }: { height: number; active?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutVar(ref, "--probe-h", active);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el) el.getBoundingClientRect = () => ({ height }) as DOMRect;
      }}
    />
  );
}

const read = () => document.documentElement.style.getPropertyValue("--probe-h");

describe("useLayoutVar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("publica a altura medida (arredondada para cima) já na montagem", () => {
    render(<Probe height={87.2} />);
    expect(read()).toBe("88px");
  });

  it("acompanha mudança de altura no resize", () => {
    const { rerender } = render(<Probe height={50} />);
    expect(read()).toBe("50px");
    rerender(<Probe height={120} />);
    window.dispatchEvent(new Event("resize"));
    expect(read()).toBe("120px");
  });

  it("remove a variável ao desmontar (sem reserva residual)", () => {
    const { unmount } = render(<Probe height={64} />);
    expect(read()).toBe("64px");
    unmount();
    expect(read()).toBe("");
  });

  it("remove a variável quando inativo", () => {
    const { rerender } = render(<Probe height={64} />);
    rerender(<Probe height={64} active={false} />);
    expect(read()).toBe("");
  });
});
