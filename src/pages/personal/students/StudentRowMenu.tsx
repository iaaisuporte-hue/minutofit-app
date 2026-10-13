import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { useDismissable } from "../../../lib/overlayStack";

export type RowMenuItem =
  | { kind: "link"; label: string; to: string }
  | { kind: "button"; label: string; onSelect: () => void; danger?: boolean };

type Props = {
  /** Nome acessível do gatilho (ex.: "Mais ações para Maria"). */
  label: string;
  items: RowMenuItem[];
};

type Pos = { right: number; top?: number; bottom?: number };

/**
 * Menu contextual das ações secundárias de uma linha da lista.
 *
 * Por que portal + posição fixa: o painel da lista tem `overflow: hidden`, então um popover comum seria CORTADO na
 * última linha (a ação ficaria escondida de novo). Teclado: Enter/Espaço abre, setas/Home/End navegam, Escape
 * fecha e devolve o foco ao gatilho. O `useDismissable` registra o menu na pilha do botão voltar do Android.
 */
export function StudentRowMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useDismissable(() => close(true), open);

  // Ancora no gatilho; abre para cima quando embaixo não cabe.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - t.bottom;
    const openUp = spaceBelow < menuHeight + 8 && t.top > menuHeight + 8;
    setPos({
      right: Math.max(8, window.innerWidth - t.right),
      top: openUp ? undefined : t.bottom + 4,
      bottom: openUp ? window.innerHeight - t.top + 4 : undefined,
    });
  }, [open]);

  // Foco no primeiro item assim que o menu está posicionado.
  useEffect(() => {
    if (open && pos) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, pos]);

  // Clique fora, rolagem e resize fecham (posição fixa ficaria desalinhada).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const n = e.target as Node;
      if (menuRef.current?.contains(n) || triggerRef.current?.contains(n)) return;
      close(false);
    };
    const onMove = () => close(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, close]);

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") els[(i + 1) % els.length]?.focus();
    else if (e.key === "ArrowUp") els[(i - 1 + els.length) % els.length]?.focus();
    else if (e.key === "Home") els[0]?.focus();
    else if (e.key === "End") els[els.length - 1]?.focus();
    else if (e.key === "Tab") {
      // foco volta ao gatilho e o Tab segue dali (próximo elemento da página), em vez de cair no <body>
      close(true);
      return;
    } else return;
    e.preventDefault();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="pp-btn pp-btn--quiet pp-btn--sm pp-row-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
        <span>Mais</span>
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              className="pp-row-menu"
              style={pos ?? { visibility: "hidden", top: 0, right: 0 }}
              onKeyDown={onMenuKeyDown}
            >
              {items.map((item, idx) => {
                const danger = item.kind === "button" && item.danger;
                return (
                  <div key={item.label} role="none">
                    {danger && idx > 0 ? <div role="separator" className="pp-row-menu__sep" /> : null}
                    {item.kind === "link" ? (
                      <Link role="menuitem" to={item.to} className="pp-row-menu__item" onClick={() => close(false)}>
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        role="menuitem"
                        type="button"
                        className={`pp-row-menu__item${danger ? " pp-row-menu__item--danger" : ""}`}
                        onClick={() => {
                          close(false);
                          item.onSelect();
                        }}
                      >
                        {item.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
