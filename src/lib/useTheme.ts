import { useSyncExternalStore } from "react";

/**
 * Estado do tema claro/escuro da S2CORE. Grava em localStorage e seta
 * html[data-theme] (em sync com o script no-flash do index.html).
 *
 * Consumido pelo FAB desktop (ThemeToggle), pela linha "Aparência" do Perfil
 * (UserProfilePage e NetworkProfilePage) e por quem precisa do tema em
 * JavaScript — o Tracker, para escolher os tiles do mapa. Fonte única da
 * lógica de tema.
 *
 * ## Por que um store de módulo e não `useState`
 *
 * Até set/2026 cada chamada de `useTheme()` tinha o SEU `useState`, inicializado
 * do localStorage no mount. Trocar o tema num componente atualizava só a cópia
 * dele: as outras instâncias montadas nunca eram notificadas e continuavam
 * respondendo o valor antigo até remontarem.
 *
 * Isso passou despercebido porque quase todo o app se pinta por CSS, e o
 * `data-theme` no `<html>` faz a cascata de tokens reagir na hora, sem React.
 * Só quem lê o tema em JS — cor de traçado, URL de tile, canvas — via o valor
 * congelado. É exatamente o "theme capturado apenas no mount".
 *
 * `useSyncExternalStore` resolve com o modelo certo: um valor no módulo, todos
 * os assinantes notificados na mesma mudança. O `storage` listener estende isso
 * a outras abas/janelas, onde a troca acontece fora deste documento.
 */
export const THEME_KEY = "corefit_theme";
export type Theme = "light" | "dark";

function ler(): Theme {
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

function aplicar(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // No app instalado a barra de status usa esta meta; sem atualizá-la, trocar
  // para o tema escuro deixava uma faixa oliva no topo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

let atual: Theme = typeof document === "undefined" ? "light" : ler();
const inscritos = new Set<() => void>();

// O script no-flash do index.html só escreve `data-theme` quando JÁ existe uma
// escolha salva. Sem isto, uma sessão nova ficava sem o atributo: o app pinta
// claro do mesmo jeito (é o valor de `:root`), mas o DOM e este módulo diziam
// coisas diferentes, e qualquer seletor que venha a olhar `[data-theme]`
// herdaria o buraco.
if (typeof document !== "undefined" && !document.documentElement.getAttribute("data-theme")) {
  document.documentElement.setAttribute("data-theme", atual);
}

function notificar() {
  inscritos.forEach((f) => f());
}

function inscrever(f: () => void): () => void {
  inscritos.add(f);
  return () => {
    inscritos.delete(f);
  };
}

if (typeof window !== "undefined") {
  // Outra aba trocou o tema. O `storage` só dispara em OUTROS documentos, então
  // não há eco da própria escrita.
  window.addEventListener("storage", (e) => {
    if (e.key !== THEME_KEY) return;
    const proximo = e.newValue === "dark" || e.newValue === "light" ? e.newValue : "light";
    if (proximo === atual) return;
    atual = proximo;
    aplicar(atual);
    notificar();
  });
}

export function setTheme(next: Theme) {
  if (next === atual) return;
  atual = next;
  aplicar(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  notificar();
}

export function toggleTheme() {
  setTheme(atual === "dark" ? "light" : "dark");
}

/** Leitura pontual, para quem não é componente React. */
export function getTheme(): Theme {
  return atual;
}

export function useTheme() {
  const theme = useSyncExternalStore(
    inscrever,
    () => atual,
    () => "light" as Theme,
  );

  return { theme, isDark: theme === "dark", toggle: toggleTheme, setTheme };
}
