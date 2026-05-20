import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { COLORS } from "../../styles/colors";
import { Skeleton } from "../../components/feedback/Skeleton";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import {
  fetchPersonalStudentActivities,
  fetchPersonalStudentSnapshot,
  type PersonalDashboardEngagementStatus,
  type PersonalDashboardPlan,
  type PersonalDashboardRisk,
  type PersonalStudentActivity,
  type PersonalStudentSnapshot,
} from "../../services/personalDashboardApi";
import type { CockpitTabId } from "./lib/cockpitActions";
import { CockpitTabToday } from "./cockpit/CockpitTabToday";
import { CockpitTabWeek } from "./cockpit/CockpitTabWeek";
import { CockpitTabHistory } from "./cockpit/CockpitTabHistory";
import { CockpitTabTechnical } from "./cockpit/CockpitTabTechnical";
import { CockpitTabRelationship } from "./cockpit/CockpitTabRelationship";
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
  const [tab, setTab] = useState<TabId>("today");
  const [data, setData] = useState<PersonalStudentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<PersonalStudentActivity[]>([]);

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

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const rows = await fetchPersonalStudentActivities(studentId, 10);
        if (!active) return;
        setActivities(rows ?? []);
      } catch {
        if (active) setActivities([]);
      }
    })();
    return () => { active = false; };
  }, [studentId]);

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
        <div className="pp-tabs">
          <button type="button" className="pp-tab" aria-selected={tab === "today"} onClick={() => setTab("today")}>
            Hoje
          </button>
          <button type="button" className="pp-tab" aria-selected={tab === "week"} onClick={() => setTab("week")}>
            Semana
          </button>
          <button type="button" className="pp-tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
            Histórico
          </button>
          <button type="button" className="pp-tab" aria-selected={tab === "technical"} onClick={() => setTab("technical")}>
            Técnica
          </button>
          <button type="button" className="pp-tab" aria-selected={tab === "relationship"} onClick={() => setTab("relationship")}>
            Relacionamento
          </button>
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
        <CockpitTabToday data={data} activities={activities} onTabChange={setTab} />
      ) : null}

      {!loading && !error && data && tab === "week" ? (
        <CockpitTabWeek data={data} />
      ) : null}

      {!loading && !error && data && tab === "history" ? (
        <CockpitTabHistory data={data} />
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
