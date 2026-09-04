import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { COLORS } from "../../styles/colors";
import { Skeleton } from "../../components/feedback/Skeleton";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import {
  fetchPersonalStudentSnapshot,
  type PersonalDashboardEngagementStatus,
  type PersonalDashboardPlan,
  type PersonalDashboardRisk,
  type PersonalStudentSnapshot,
} from "../../services/personalDashboardApi";
import type { CockpitTabId } from "./lib/cockpitActions";

/**
 * As abas, em ordem de exibição.
 *
 * Declarativa desde a P5: antes eram sete botões escritos à mão no JSX e um
 * `switch` de painéis em outro ponto do arquivo, e acrescentar uma aba pedia
 * editar os dois — o tipo de duplicação que só aparece quando alguém edita um
 * lugar e esquece o outro.
 */
export const COCKPIT_TABS = [
  { id: "today", label: "Hoje" },
  { id: "technical", label: "Técnica" },
  { id: "relationship", label: "Relacionamento" },
  { id: "week", label: "Semana" },
  { id: "evolucao", label: "Evolução" },
  { id: "performance", label: "Performance" },
  { id: "ia_summary", label: "IA" },
] as const;
import { CockpitTabToday } from "./cockpit/CockpitTabToday";
import { CockpitTabWeek } from "./cockpit/CockpitTabWeek";
import { CockpitTabTechnical } from "./cockpit/CockpitTabTechnical";
import { CockpitTabRelationship } from "./cockpit/CockpitTabRelationship";
import { CockpitTabEvolucao } from "./cockpit/CockpitTabEvolucao";
import { CockpitTabAiSummary } from "./cockpit/CockpitTabAiSummary";
import { CockpitTabPerformance } from "./cockpit/CockpitTabPerformance";
import "./personalPremium.css";

type TabId = CockpitTabId;

const PLAN_LABEL: Record<PersonalDashboardPlan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

function initialFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

function riskLabel(risk: PersonalDashboardRisk) {
  if (risk === "critico") return "Em risco";
  if (risk === "alerta") return "Atenção";
  return "No ritmo";
}

function engagementLabel(status: PersonalDashboardEngagementStatus) {
  if (status === "evolving") return "Evoluindo";
  if (status === "on_track") return "No ritmo";
  if (status === "fading") return "Sumindo";
  if (status === "at_risk") return "Em risco";
  return "Atenção";
}

function snapshotErrorMessage(message: string) {
  if (/route not found/i.test(message)) {
    return "A visão detalhada deste aluno ainda não está disponível nesta versão da API.";
  }
  return message;
}

function Surface({ children }: { children: React.ReactNode }) {
  return <div className="pp-surface">{children}</div>;
}

export default function StudentProfileModal({
  studentId,
  studentName,
  onClose,
  variant = "overlay",
}: {
  studentId: string;
  studentName: string;
  onClose: () => void;
  variant?: "overlay" | "inline";
}) {
  /**
   * A aba vive na URL (`?ctab=`), não em estado local.
   *
   * Antes da Onda P5 ela era `useState`: abrir o aluno, ir para uma aba e
   * recarregar devolvia o personal para "Hoje", e não havia como mandar a
   * alguém o link de uma aba específica. Num app que também roda como PWA, o
   * recarregamento não é hipótese rara — o Android mata a aba e restaura.
   *
   * `ctab` e não `tab`: a página do aluno já usa `?tab=` para outro nível de
   * navegação (visão geral × fichas), e reaproveitar o nome faria os dois se
   * atropelarem.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("ctab");
  const tab: TabId = COCKPIT_TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "today";

  const setTab = useCallback(
    (next: TabId) => {
      const params = new URLSearchParams(searchParams);
      params.set("ctab", next);
      // `replace` para que voltar não percorra cada aba visitada.
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const [data, setData] = useState<PersonalStudentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const snapshot = await fetchPersonalStudentSnapshot(studentId);
      setData(snapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível carregar o perfil do aluno.";
      setError(snapshotErrorMessage(message));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (variant === "overlay") {
      function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape") onClose();
      }
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
    return undefined;
  }, [onClose, variant]);


  const drawerInner = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="pp-avatar">{initialFromName(data?.name || studentName)}</div>
          <div style={{ display: "grid", gap: 5 }}>
            <div className="pp-drawer-title">{data?.name || studentName}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pp-badge">{PLAN_LABEL[data?.plan || "basic"]}</span>
              {data ? (
                <span
                  className={`pp-badge ${
                    data.risk === "critico"
                      ? "pp-badge--danger"
                      : data.risk === "alerta"
                        ? "pp-badge--warn"
                        : "pp-badge--success"
                  }`}
                >
                  {riskLabel(data.risk)}
                </span>
              ) : (
                <span className="pp-badge">Carregando</span>
              )}
              {data ? (
                <span className="pp-badge pp-badge--soft">
                  {engagementLabel(data.engagementStatus)}
                </span>
              ) : null}
            </div>
            {variant === "overlay" ? (
              <div style={{ marginTop: 6 }}>
                <Link
                  to={`/app/personal/students/${studentId}`}
                  className="pp-btn pp-btn--ghost pp-btn--sm"
                  style={{ paddingLeft: 0 }}
                >
                  Ver perfil completo
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Link to={`/app/personal/students/${studentId}/workouts/builder`} className="pp-btn pp-btn--primary pp-btn--sm">
                  Ajustar plano
                </Link>
                <Link
                  to="/app/personal/messages"
                  state={{ studentId }}
                  className="pp-btn pp-btn--ghost pp-btn--sm"
                >
                  Mensagens
                </Link>
              </div>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} className="pp-icon-btn" aria-label="Fechar">
          ×
        </button>
      </div>

      {!error ? (
        <div className="pp-tabs-wrap">
          <div className="pp-tabs" role="tablist">
            {COCKPIT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className="pp-tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <Surface>
          <div style={{ display: "grid", gap: 10 }}>
            <Skeleton variant="text-lg" width="60%" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="75%" />
            <Skeleton variant="text-sm" width="40%" />
          </div>
        </Surface>
      ) : null}

      {!loading && error ? (
        <div className="pp-error-state">
          <div style={{ color: COLORS.text, fontWeight: 650 }}>Perfil detalhado indisponível</div>
          <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
            {error} O painel principal continua disponível para acompanhamento rápido.
          </div>
        </div>
      ) : null}

      {!loading && !error && data && tab === "today" ? (
        <CockpitTabToday data={data} onTabChange={setTab} />
      ) : null}

      {!loading && !error && data && tab === "week" ? (
        <CockpitTabWeek data={data} />
      ) : null}

      {!loading && !error && data && tab === "technical" ? (
        <CockpitTabTechnical
          studentId={studentId}
          highlights={data.technical?.highlights ?? []}
          onSaved={() => void loadSnapshot()}
        />
      ) : null}

      {!loading && tab === "relationship" ? (
        <CockpitTabRelationship
          studentId={studentId}
          studentName={data?.name ?? studentName}
        />
      ) : null}

      {!loading && !error && tab === "evolucao" ? (
        <CockpitTabEvolucao studentId={studentId} />
      ) : null}

      {!loading && !error && tab === "performance" ? (
        <CockpitTabPerformance studentId={studentId} />
      ) : null}

      {tab === "ia_summary" ? (
        <CockpitTabAiSummary studentId={studentId} />
      ) : null}
    </>
  );

  if (variant === "inline") {
    return (
      <div className="pp-inline-profile">
        <aside className="pp-drawer pp-drawer--inline" role="region" aria-label={`Perfil de ${data?.name || studentName}`}>
          {drawerInner}
        </aside>
      </div>
    );
  }

  return (
    <DrawerShell open onClose={onClose} ariaLabel={`Perfil de ${data?.name || studentName}`}>
      {drawerInner}
    </DrawerShell>
  );
}
