import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { COLORS } from "../../styles/colors";

/**
 * Lista de navegação secundária do Perfil (o "hub"). Substitui o antigo menu
 * "⋯": os destinos que só existiam na sidebar desktop (Atividades, Treino do
 * dia, Minha equipe, Glossário, Aparência) ganham casa aqui, acessível no
 * celular. Componente puro (recebe `sections`) — testável isolado.
 */
export interface ProfileNavItem {
  label: string;
  icon?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  /** Substitui o chevron à direita (ex.: estado do tema). */
  right?: React.ReactNode;
  danger?: boolean;
}

export interface ProfileNavSection {
  title?: string;
  items: ProfileNavItem[];
}

export function ProfileNavList({ sections }: { sections: ProfileNavSection[] }) {
  const navigate = useNavigate();

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      {sections.map((section, si) => (
        <div key={section.title ?? si} style={{ display: "grid", gap: 6 }}>
          {section.title && (
            <div
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: COLORS.mutedSoft,
                padding: "0 2px",
              }}
            >
              {section.title}
            </div>
          )}
          <div
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: "var(--radius-lg)",
              background: COLORS.panel,
              overflow: "hidden",
            }}
          >
            {section.items.map((it, idx) => (
              <button
                key={it.label}
                type="button"
                onClick={() => (it.onClick ? it.onClick() : it.to ? navigate(it.to) : undefined)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  border: "none",
                  borderTop: idx === 0 ? "none" : `1px solid ${COLORS.border}`,
                  background: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: it.danger ? COLORS.danger : COLORS.text,
                }}
              >
                {it.icon && (
                  <span style={{ display: "flex", color: it.danger ? COLORS.danger : COLORS.muted, flexShrink: 0 }}>
                    {it.icon}
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)" }}>
                  {it.label}
                </span>
                {it.right ?? <ChevronRight size={18} color={COLORS.mutedSoft} aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
