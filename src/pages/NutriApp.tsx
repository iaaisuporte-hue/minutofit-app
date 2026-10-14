import { useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import S2CoreLogo from "../components/S2CoreLogo";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useDismissable } from "../lib/overlayStack";
import NutriTodayPage from "./nutri/NutriTodayPage";
import NutritionPatientsPage from "./nutri/NutritionPatientsPage";
import PatientDetailNutriPage from "./nutri/PatientDetailNutriPage";
import CreatePlanPage from "./nutri/CreatePlanPage";
import ConvitesPage from "./nutri/ConvitesPage";
import NetworkProfilePage from "./professional/NetworkProfilePage";

export default function NutriApp() {
  const auth = useAuth();
  const location = useLocation();
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const fecharMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };
  // O <details> nativo não fecha sozinho ao navegar: o painel ficava aberto por cima do conteúdo da nova tela (N1).
  useEffect(() => {
    fecharMenu();
  }, [location.pathname]);
  // Voltar do Android / Escape fecham o menu antes de qualquer navegação.
  useDismissable(fecharMenu, menuOpen);
  // <details> não tem "clicar fora para fechar": o painel ficava por cima do conteúdo até tocar num link.
  useEffect(() => {
    if (!menuOpen) return;
    const fora = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) fecharMenu();
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [menuOpen]);

  const navLinkStyle = ({ isActive }: { isActive: boolean }) =>
    `navLink${isActive ? " navLinkActive" : ""}`;

  return (
    <AppShell
      mobileHeader={
        <>
          <span style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <S2CoreLogo width={88} />
          </span>
          {/* SPEC 036 (P1B): Nutri é perfil profissional desktop-first —
              não ganha bottom nav (padrão do aluno). `<details>` nativo
              cobre a navegação secundária (Convites/Meu perfil/Sair) sem
              estado React nem overlay/click-outside para gerenciar. */}
          <details className="navDisclosure" ref={menuRef} onToggle={(e) => setMenuOpen(e.currentTarget.open)}>
            <summary className="navDisclosure__trigger" aria-label="Menu">
              <Menu size={20} aria-hidden="true" />
            </summary>
            {/* clique em qualquer link fecha o menu, mesmo quando a rota não muda (já está na tela) */}
            <div
              className="navDisclosure__panel"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) fecharMenu();
              }}
            >
              <NavLink to="/app/nutri" end className={navLinkStyle}>
                Hoje
              </NavLink>
              <NavLink to="/app/nutri/pacientes" className={navLinkStyle}>
                Pacientes
              </NavLink>
              <NavLink to="/app/nutri/convites" className={navLinkStyle}>
                Convites
              </NavLink>
              <NavLink to="/app/nutri/meu-perfil" className={navLinkStyle}>
                Meu perfil
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  fecharMenu();
                  setConfirmLogout(true);
                }}
                className="logoutButton"
                style={{ marginTop: "var(--space-2)" }}
              >
                Sair da conta
              </button>
            </div>
          </details>
        </>
      }
      sidebar={
        <>
          <div style={{ padding: "8px 12px 16px" }}>
            <S2CoreLogo width={112} />
            <div className="shellSubtitle" style={{ marginTop: 8 }}>Nutrição</div>
          </div>

          <div className="navStack">
            <NavLink to="/app/nutri" end className={navLinkStyle}>
              Hoje
            </NavLink>
            <NavLink to="/app/nutri/pacientes" className={navLinkStyle}>
              Pacientes
            </NavLink>
            <NavLink to="/app/nutri/convites" className={navLinkStyle}>
              Convites
            </NavLink>
            <NavLink to="/app/nutri/meu-perfil" className={navLinkStyle}>
              Meu perfil
            </NavLink>
          </div>

          <div style={{ flex: 1 }} />

          <div className="sidebar-footer">
            <button type="button" onClick={() => setConfirmLogout(true)} className="logoutButton">
              Sair da conta
            </button>
          </div>
        </>
      }
    >
      <ConfirmDialog
        open={confirmLogout}
        title="Sair da conta?"
        message="Você precisará entrar novamente para acessar seus pacientes."
        confirmLabel="Sair"
        danger
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          auth.logout();
        }}
      />
      <Routes>
        <Route index element={<NutriTodayPage />} />
        <Route path="pacientes" element={<NutritionPatientsPage />} />
        <Route path="pacientes/:patientId" element={<PatientDetailNutriPage />} />
        <Route path="pacientes/:patientId/plano/novo" element={<CreatePlanPage />} />
        <Route path="convites" element={<ConvitesPage />} />
        <Route path="meu-perfil" element={<NetworkProfilePage />} />
      </Routes>
    </AppShell>
  );
}
