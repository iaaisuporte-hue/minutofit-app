import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Tabs, tabPanelProps } from "../../components/Tabs";
import ClinicalProfileTab from "./ClinicalProfileTab";
import { PlanTab } from "./tabs/PlanTab";
import { AdherenceTab } from "./tabs/AdherenceTab";
import { ContextTab } from "./tabs/ContextTab";
import { EvolucaoTab } from "./tabs/EvolucaoTab";
import { ObservationsTab } from "./tabs/ObservationsTab";
import { InsightsTab } from "./tabs/InsightsTab";
import { VozTab } from "./tabs/VozTab";

type TabName = "Plano" | "Perfil" | "Adesão" | "Contexto" | "Evolução" | "Observações" | "Insights" | "Voz";
const TABS: TabName[] = ["Plano", "Perfil", "Adesão", "Contexto", "Evolução", "Observações", "Insights", "Voz"];
const TAB_ITEMS = TABS.map((t) => ({ id: t, label: t }));
const TAB_ID_PREFIX = "nutri-patient";

export default function PatientDetailNutriPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<TabName>("Plano");

  const id = Number(patientId);
  if (!Number.isFinite(id)) return null;

  // Nome vem do state da navegação (lista de pacientes). Em deep-link/refresh o
  // state some → fallback para o identificador.
  const patientName =
    (location.state as { patientName?: string } | null)?.patientName ?? `Paciente #${id}`;

  return (
    <div style={{ padding: "var(--space-6) 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <button
          type="button"
          onClick={() => navigate("..", { relative: "path" })}
          className="btn btn-icon btn-ghost"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>{patientName}</h1>
      </div>

      <div style={{ marginBottom: "var(--space-5)" }}>
        <Tabs tabs={TAB_ITEMS} active={tab} onSelect={(t) => setTab(t as TabName)} idPrefix={TAB_ID_PREFIX} />
      </div>

      <div {...tabPanelProps(TAB_ID_PREFIX, tab)}>
        {tab === "Plano" && <PlanTab patientId={id} />}
        {tab === "Perfil" && <ClinicalProfileTab patientId={id} />}
        {tab === "Adesão" && <AdherenceTab patientId={id} />}
        {tab === "Contexto" && <ContextTab patientId={id} />}
        {tab === "Evolução" && <EvolucaoTab patientId={id} />}
        {tab === "Observações" && <ObservationsTab patientId={id} />}
        {tab === "Insights" && <InsightsTab patientId={id} />}
        {tab === "Voz" && <VozTab patientId={id} />}
      </div>
    </div>
  );
}
