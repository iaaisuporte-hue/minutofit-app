import { useEffect, useState } from "react";

/**
 * Estado do tema claro/escuro da S2CORE. Grava em localStorage e seta
 * html[data-theme] (em sync com o script no-flash do index.html).
 *
 * Consumido pelo FAB desktop (ThemeToggle) e pela linha "Aparência" do Perfil
 * (mobile, UserProfilePage e NetworkProfilePage) — fonte única da lógica de
 * tema.
 */
export const THEME_KEY = "corefit_theme";
export type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  // Beta: default claro (opt-in); ainda não seguimos o SO.
  return "light";
}

/** Cor da barra de status do sistema (Android/iOS) por tema. */
const THEME_COLOR: Record<Theme, string> = { light: "#7B9919", dark: "#121212" };

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // No app instalado a barra de status usa esta meta; sem atualizá-la, trocar
  // para o tema escuro deixava uma faixa oliva no topo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export function useTheme() {
  // Init síncrono (sem setState em effect); o script no-flash do index.html já
  // pinta o data-theme no load, o effect abaixo só reconcilia em mudanças.
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, isDark: theme === "dark", toggle, setTheme };
}
