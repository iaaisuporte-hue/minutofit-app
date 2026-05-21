import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const HojeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

const StudentsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TreinosIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const ProtocolLibraryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h8" />
    <path d="M8 9h3" />
  </svg>
);

const MessagesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

interface Props {
  /**
   * Quando fornecido, renderiza um botão "Sair" no rodapé do nav (último slot).
   * Necessário no mobile portrait, onde a sidebar — que tradicionalmente
   * abriga o logout — fica escondida.
   */
  onLogout?: () => void;
}

export default function PersonalMobileBottomNav({ onLogout }: Props) {
  const items: NavItem[] = [
    { to: "/app/personal/dashboard", label: "Hoje", icon: <HojeIcon /> },
    { to: "/app/personal/students", label: "Alunos", icon: <StudentsIcon /> },
    { to: "/app/personal/review", label: "Revisões", icon: <TreinosIcon /> },
    { to: "/app/personal/library", label: "Protocolos", icon: <ProtocolLibraryIcon /> },
    { to: "/app/personal/messages", label: "Mensagens", icon: <MessagesIcon /> },
  ];

  return (
    <nav className="mobileBottomNav" aria-label="Navegação principal do personal">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `mobileBottomNav__item${isActive ? " is-active" : ""}`}
        >
          {item.icon}
          <span className="mobileBottomNav__label">{item.label}</span>
        </NavLink>
      ))}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="mobileBottomNav__item mobileBottomNav__item--logout"
          aria-label="Sair da conta"
        >
          <LogoutIcon />
          <span className="mobileBottomNav__label">Sair</span>
        </button>
      )}
    </nav>
  );
}
