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

const TreinoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 4v16M18 4v16M1 9h5M18 9h5M1 15h5M18 15h5" />
  </svg>
);

const AlimentacaoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2M5 2v20M16 2c-1.7 0-3 2.2-3 5s1.3 5 3 5v10" />
  </svg>
);

const EvolucaoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

interface Props {
  baseUrl: string;
}

/**
 * Navegação principal do aluno — 5 abas FIXAS (Hoje · Treino · Alimentação ·
 * Evolução · Perfil), padrão Whoop/Strava. As abas nunca são ocultadas por
 * vínculo/plano: o conteúdo de cada destino é que se adapta (estados abertos
 * e educativos). Mensagens vive como ícone no topo (AppShell.mobileHeader),
 * não como aba; logout vive dentro do Perfil.
 */
export default function MobileBottomNav({ baseUrl }: Props) {
  const items: NavItem[] = [
    { to: `${baseUrl}/today`, label: "Hoje", icon: <HomeIcon /> },
    { to: `${baseUrl}/plano`, label: "Treino", icon: <TreinoIcon /> },
    { to: `${baseUrl}/plano-alimentar`, label: "Alimentação", icon: <AlimentacaoIcon /> },
    { to: `${baseUrl}/estado-metabolico`, label: "Evolução", icon: <EvolucaoIcon /> },
    { to: `${baseUrl}/profile`, label: "Perfil", icon: <ProfileIcon /> },
  ];

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
    </nav>
  );
}
