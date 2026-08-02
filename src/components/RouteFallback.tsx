import { LoadingSkeleton } from "./LoadingSkeleton";

/**
 * Fallback do `Suspense` que envolve as áreas autenticadas (code splitting por
 * rota em `App.tsx`). Aparece só na primeira entrada de cada área, enquanto o
 * chunk baixa — depois disso o módulo fica em cache e a troca é instantânea.
 *
 * Reusa o skeleton do design system em vez de um spinner novo: o usuário já
 * conhece esse padrão de carregamento no resto do app.
 */
export default function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6, 24px)",
      }}
    >
      <div style={{ width: "min(560px, 100%)" }}>
        <LoadingSkeleton variant="card" />
      </div>
    </div>
  );
}
