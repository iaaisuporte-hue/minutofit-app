import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastType = "success" | "error" | "info" | "warn";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_STYLES: Record<ToastType, { background: string; border: string; color: string; icon: string }> = {
  success: {
    background: "var(--color-success-soft)",
    border: "var(--color-success-border)",
    color: "var(--color-success-text)",
    icon: "✓",
  },
  error: {
    background: "var(--color-danger-soft)",
    border: "var(--color-danger-border)",
    color: "var(--color-danger-text)",
    icon: "✕",
  },
  info: {
    background: "var(--color-accent-soft)",
    border: "var(--color-accent-border)",
    color: "var(--color-accent-hover)",
    icon: "i",
  },
  warn: {
    background: "var(--color-warn-soft)",
    border: "var(--color-warn-border)",
    color: "var(--color-warn-text)",
    icon: "!",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const ctx: ToastContextValue = {
    success: (msg) => add(msg, "success"),
    error: (msg) => add(msg, "error"),
    info: (msg) => add(msg, "info"),
    warn: (msg) => add(msg, "warn"),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: "var(--z-toast)" as unknown as number,
          display: "grid",
          gap: 10,
          maxWidth: 360,
          width: "calc(100vw - 40px)",
          pointerEvents: "none",
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const s = TYPE_STYLES[toast.type];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  background: s.background,
                  border: `1px solid ${s.border}`,
                  boxShadow: "var(--shadow-lg)",
                  pointerEvents: "auto",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: s.border,
                    color: s.color,
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {s.icon}
                </span>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", lineHeight: 1.5, fontWeight: 500 }}>
                  {toast.message}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
