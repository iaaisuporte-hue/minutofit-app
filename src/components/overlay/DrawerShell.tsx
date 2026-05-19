import { useEffect, useRef, type ReactNode } from "react";
import "../../pages/personal/personalPremium.css";

type DrawerShellProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  /** Quando true (default), o backdrop fecha o drawer ao clique. */
  closeOnBackdrop?: boolean;
  /** Quando true (default), tecla Escape fecha o drawer. */
  closeOnEscape?: boolean;
  /** ClassName extra para o `<aside>` (ex.: "pp-drawer--inline"). */
  className?: string;
};

/**
 * Shell reutilizável para drawers (slide-from-right em desktop, bottom-sheet
 * em mobile <540px via CSS). Encapsula 4 garantias:
 *
 * 1. Escape fecha (ARIA dialog padrão).
 * 2. Backdrop click-outside fecha — usa guarda target===currentTarget em
 *    onClick (não onMouseDown), para que arrasto/scroll-by-drag não dispare
 *    close por acidente. Esse foi exatamente o bug que motivou o hotfix do
 *    ProtocolUsageDrawer (commit 5cfd8d2).
 * 3. role="dialog" + aria-modal="true" + aria-label automático.
 * 4. Scroll lock no body enquanto o drawer está aberto.
 *
 * Não tenta substituir <dialog> nativo — o objetivo é unificar os 4
 * padrões de overlay legados em /pages/personal/ sem reescrita.
 */
export function DrawerShell({
  open,
  onClose,
  ariaLabel,
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
}: DrawerShellProps) {
  const asideRef = useRef<HTMLElement | null>(null);

  // Escape para fechar.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  // Scroll lock no body enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  };

  const asideClass = ["pp-drawer", className].filter(Boolean).join(" ");

  return (
    <div className="pp-drawer-backdrop" role="presentation" onClick={handleBackdropClick}>
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={asideClass}
      >
        {children}
      </aside>
    </div>
  );
}
