import { useCallback } from "react";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Tabs, tabPanelProps } from "../../components/Tabs";
import { ResumoTab } from "./tabs/ResumoTab";
import { PlanTab } from "./tabs/PlanTab";
import { AcompanhamentoTab } from "./tabs/AcompanhamentoTab";
import { HistoricoTab } from "./tabs/HistoricoTab";

type TabId = "resumo" | "plano" | "acompanhamento" | "historico";
const TAB_IDS: TabId[] = ["resumo", "plano", "acompanhamento", "historico"];
const TAB_ITEMS = [
  { id: "resumo", label: "Resumo" },
  { id: "plano", label: "Plano" },
  { id: "acompanhamento", label: "Acompanhamento" },
  { id: "historico", label: "Histórico" },
];
const TAB_ID_PREFIX = "nutri-patient";

export default function PatientDetailNutriPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // SPEC 037 / P2.5+P2.4: aba vive na URL (`?tab=`), não em estado local —
  // F5, voltar do builder e link direto precisam abrir a MESMA aba. Nutri
  // não tem outro nível de navegação já usando `?tab=` (diferente do caso
  // do Personal, que precisou de `ctab` para não colidir), então o nome
  // direto é seguro aqui.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabId = (TAB_IDS as string[]).includes(rawTab ?? "") ? (rawTab as TabId) : "resumo";

  const setTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("tab", next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

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
        <Tabs tabs={TAB_ITEMS} active={tab} onSelect={setTab} idPrefix={TAB_ID_PREFIX} />
      </div>

      <div {...tabPanelProps(TAB_ID_PREFIX, tab)}>
        {tab === "resumo" && <ResumoTab patientId={id} onNavigateTab={setTab} />}
        {tab === "plano" && <PlanTab patientId={id} />}
        {tab === "acompanhamento" && <AcompanhamentoTab patientId={id} />}
        {tab === "historico" && <HistoricoTab patientId={id} />}
      </div>
    </div>
  );
}
