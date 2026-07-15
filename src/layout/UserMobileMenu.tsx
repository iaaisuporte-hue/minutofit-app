import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Menu de estouro ("⋯") do topo mobile do aluno. Existe porque o bottom nav só
 * tem 5 abas fixas e a sidebar (que abriga os destinos secundários) fica oculta
 * em retrato. Aqui ficam Atividades, Treino do dia, Minha equipe, Glossário,
 * Configurações e Sair — acessíveis de qualquer tela.
 */
export interface MobileMenuItem {
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}

const MoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
  </svg>
);

export function UserMobileMenu({ items }: { items: MobileMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        aria-label="Mais opções"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          padding: 8,
          borderRadius: 8,
          border: "none",
          background: "none",
          color: "var(--color-text-muted)",
          cursor: "pointer",
        }}
      >
        <MoreIcon />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000 }}
        >
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 52,
              right: 10,
              minWidth: 208,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-md)",
              overflow: "hidden",
              padding: "4px 0",
            }}
          >
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (it.onClick) it.onClick();
                  else if (it.to) navigate(it.to);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 16px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--font-semibold)",
                  color: it.danger ? "var(--color-danger)" : "var(--color-text)",
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
