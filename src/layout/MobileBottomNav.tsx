import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);


const FichaIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const TrackerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const LabIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
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
  baseUrl: string;
  showMessages?: boolean;
  showLab?: boolean;
  showTracker?: boolean;
  /** Mostra "Minha ficha" — destino primário do aluno do personal autônomo */
  showFicha?: boolean;
  showProfile?: boolean;
  /**
   * Quando fornecido, renderiza um botão "Sair" no rodapé do nav (último slot).
   * Necessário no mobile portrait, onde a sidebar — que tradicionalmente
   * abriga o logout — fica escondida.
   */
  onLogout?: () => void;
}

export default function MobileBottomNav({
  baseUrl,
  showMessages = false,
  showLab = false,
  showTracker: _showTracker = true,
  showFicha = false,
  showProfile = false,
  onLogout,
}: Props) {
  // Prioridade dos slots de navegação. Quando onLogout existe, reservamos
  // um slot para o botão "Sair" — sobram 5 para nav (mesmo limite de antes
  // do recurso, mantém legibilidade dos labels).
  const navSlots = onLogout ? 5 : 5;
  const items: NavItem[] = [
    { to: `${baseUrl}/today`, label: "Hoje", icon: <HomeIcon /> },
    ...(showFicha ? [{ to: `${baseUrl}/ficha`, label: "Meu plano", icon: <FichaIcon /> }] : []),
    ...(_showTracker ? [{ to: `${baseUrl}/activities`, label: "Atividades", icon: <TrackerIcon /> }] : []),
    ...(showLab ? [{ to: `${baseUrl}/movement-lab`, label: "Espelho", icon: <LabIcon /> }] : []),
    ...(showMessages ? [{ to: `${baseUrl}/messages`, label: "Mensagens", icon: <MessagesIcon /> }] : []),
    ...(showProfile ? [{ to: `${baseUrl}/profile`, label: "Perfil", icon: <ProfileIcon /> }] : []),
  ].slice(0, navSlots);

  return (
    <nav className="mobileBottomNav" aria-label="Navegação principal">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `mobileBottomNav__item${isActive ? " is-active" : ""}`
          }
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
