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

const WorkoutsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 4v16M18 4v16M1 9h5M18 9h5M1 15h5M18 15h5" />
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

interface Props {
  baseUrl: string;
  showMessages?: boolean;
  showWorkouts?: boolean;
}

export default function MobileBottomNav({ baseUrl, showMessages = false, showWorkouts = true }: Props) {
  const items: NavItem[] = [
    { to: `${baseUrl}/today`, label: "Hoje", icon: <HomeIcon /> },
    ...(showWorkouts ? [{ to: `${baseUrl}/treinos`, label: "Treinos", icon: <WorkoutsIcon /> }] : []),
    { to: `${baseUrl}/activities`, label: "Tracker", icon: <TrackerIcon /> },
    { to: `${baseUrl}/movement-lab`, label: "Lab", icon: <LabIcon /> },
    ...(showMessages ? [{ to: `${baseUrl}/messages`, label: "Chat", icon: <MessagesIcon /> }] : []),
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
