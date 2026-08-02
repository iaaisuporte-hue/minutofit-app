import { useTheme } from "../lib/useTheme";

/**
 * FAB de tema claro/escuro (desktop). No mobile (≤720px) ele é ocultado via CSS
 * (`.theme-toggle-fab`, em `components.css`) porque brigava com o bottom nav —
 * no app do aluno a troca de tema mora em Perfil › Aparência. A lógica vive em
 * `useTheme`.
 *
 * Os estilos ficam na CLASSE, não inline: inline eles venciam por
 * especificidade e a ocultação no mobile nunca chegava a valer (QA 02/ago/2026).
 */
export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle-fab"
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema escuro (toque para claro)" : "Tema claro (toque para escuro)"}
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
