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

const FinanceIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
    <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

/**
 * Cinco destinos. Só isso.
 *
 * O Financeiro é o 5º destino de primeira classe (quebra consciente do padrão
 * "4 destinos + 1 ícone" da área do personal, decidida em ago/2026): cobrar e
 * conferir recebimento é rotina diária, não uma aba escondida dentro de Alunos.
 * O `--compact` reduz fonte e respiro do rótulo sem mexer no alvo de toque.
 *
 * O botão "Sair" que ocupava um SEXTO slot saiu daqui (SPEC mobile §6): logout
 * num alvo de 53px, encostado em "Programas", é um toque torto de distância da
 * sessão derrubada — e derrubava sem perguntar. Mudou para "Meu perfil › Sair
 * da conta", com confirmação, igual ao aluno; a porta de entrada em retrato é o
 * ícone de conta no cabeçalho (`PersonalApp`).
 */
export default function PersonalMobileBottomNav() {
  const items: NavItem[] = [
    { to: "/app/personal/dashboard", label: "Hoje", icon: <HojeIcon /> },
    { to: "/app/personal/students", label: "Alunos", icon: <StudentsIcon /> },
    { to: "/app/personal/review", label: "Revisões", icon: <TreinosIcon /> },
    { to: "/app/personal/finance", label: "Financeiro", icon: <FinanceIcon /> },
    { to: "/app/personal/library", label: "Programas", icon: <ProtocolLibraryIcon /> },
  ];

  return (
    <nav
      className="mobileBottomNav mobileBottomNav--compact"
      aria-label="Navegação principal do personal"
    >
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
    </nav>
  );
}
