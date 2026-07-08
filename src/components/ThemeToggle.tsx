import { useEffect, useState } from "react";

/**
 * Alterna tema claro/escuro da S2CORE.
 * Grava em localStorage("corefit_theme") e seta html[data-theme].
 * Mantido em sync com o script inline de no-flash em index.html.
 */
export const THEME_KEY = "corefit_theme";
type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  // Beta: default claro (opt-in). Não seguimos o SO ainda para não
  // surpreender usuários de SO escuro com telas em polish.
  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = readInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema escuro (toque para claro)" : "Tema claro (toque para escuro)"}
      style={{
        position: "fixed",
        right: 16,
        bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
        zIndex: 150,
        width: 44,
        height: 44,
        borderRadius: 999,
        border: "1px solid var(--color-border-strong)",
        background: "var(--color-surface)",
        color: "var(--color-primary)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        boxShadow: "var(--shadow-md)",
        transition: "border-color 150ms ease, transform 150ms ease",
      }}
    >
      {isDark ? (
        // sol — está escuro, toque para clarear
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // lua — está claro, toque para escurecer
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
