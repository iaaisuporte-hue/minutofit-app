import { beforeEach, describe, expect, it, vi } from "vitest";
import { __limparOverlays, fecharTopo } from "./overlayStack";

import { act, render } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { useBodyScrollLock, useOverlay, __travasAtivas } from "./overlayStack";

function Camada({ onClose, label }: { onClose: () => void; label: string }) {
  useOverlay(onClose, true);
  return <button>{label}</button>;
}
function Lock() {
  useBodyScrollLock(true);
  return null;
}

describe("comportamento comum de overlay", () => {
  beforeEach(() => {
    __limparOverlays();
    document.body.style.overflow = "";
  });

  it("scroll lock é contado: fechar o de baixo não destrava enquanto o de cima está aberto", () => {
    const a = render(<Lock />);
    const b = render(<Lock />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(__travasAtivas()).toBe(2);
    a.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    b.unmount();
    expect(document.body.style.overflow).toBe("");
    expect(__travasAtivas()).toBe(0);
  });

  it("restaura o overflow original (não um valor intermediário)", () => {
    document.body.style.overflow = "scroll";
    const a = render(<Lock />);
    const b = render(<Lock />);
    b.unmount();
    a.unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("voltar e Escape fecham só a camada do topo; a de baixo só depois que o topo sai", () => {
    const base = vi.fn();
    const topo = vi.fn();
    render(<Camada onClose={base} label="base" />);
    const t = render(<Camada onClose={topo} label="topo" />);
    act(() => { fecharTopo(); });
    expect(topo).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(topo).toHaveBeenCalledTimes(2);
    expect(base).not.toHaveBeenCalled();
    t.unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("re-render com callback inline não leva a camada de baixo ao topo", () => {
    const base = vi.fn();
    const topo = vi.fn();
    const b = render(<Camada onClose={() => base()} label="base" />);
    render(<Camada onClose={topo} label="topo" />);
    b.rerender(<Camada onClose={() => base()} label="base" />);
    act(() => { fecharTopo(); });
    expect(topo).toHaveBeenCalledTimes(1);
    expect(base).not.toHaveBeenCalled();
  });

  it("devolve o foco ao gatilho ao fechar", () => {
    const gatilho = document.createElement("button");
    document.body.appendChild(gatilho);
    gatilho.focus();
    const r = render(<Camada onClose={() => {}} label="x" />);
    (r.getByText("x") as HTMLElement).focus();
    expect(document.activeElement).not.toBe(gatilho);
    r.unmount();
    expect(document.activeElement).toBe(gatilho);
    gatilho.remove();
  });
});
