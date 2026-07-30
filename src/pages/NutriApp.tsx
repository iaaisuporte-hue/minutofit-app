import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import S2CoreLogo from "../components/S2CoreLogo";
import { IncomingRequestsPanel, NetworkVisibilityBanner } from "../features/team";
import NutritionPatientsPage from "./nutri/NutritionPatientsPage";
import PatientDetailNutriPage from "./nutri/PatientDetailNutriPage";
import CreatePlanPage from "./nutri/CreatePlanPage";
import NetworkProfilePage from "./professional/NetworkProfilePage";

function ConvitesPage() {
  return (
    <div style={{ padding: "24px 0" }}>
      <NetworkVisibilityBanner role="nutri" />
      <IncomingRequestsPanel role="nutri" />
    </div>
  );
}

export default function NutriApp() {
  const auth = useAuth();

  const navLinkStyle = ({ isActive }: { isActive: boolean }) =>
    `navLink${isActive ? " navLinkActive" : ""}`;

  return (
    <AppShell
      sidebar={
        <>
          <div style={{ padding: "8px 12px 16px" }}>
            <S2CoreLogo width={112} />
            <div className="shellSubtitle" style={{ marginTop: 8 }}>Nutrição</div>
          </div>

          <div className="navStack">
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
            <button type="button" onClick={auth.logout} className="logoutButton">
              Sair da conta
            </button>
          </div>
        </>
      }
    >
      <Routes>
        <Route index element={<Navigate to="pacientes" replace />} />
        <Route path="pacientes" element={<NutritionPatientsPage />} />
        <Route path="pacientes/:patientId" element={<PatientDetailNutriPage />} />
        <Route path="pacientes/:patientId/plano/novo" element={<CreatePlanPage />} />
        <Route path="convites" element={<ConvitesPage />} />
        <Route path="meu-perfil" element={<NetworkProfilePage />} />
      </Routes>
    </AppShell>
  );
}
