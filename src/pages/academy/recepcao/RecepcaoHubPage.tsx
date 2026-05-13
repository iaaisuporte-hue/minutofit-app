import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../../components/EmptyState";
import {
  fetchReceptionDashboard,
  type ReceptionAccessEvent,
  type ReceptionDashboard,
  type ReceptionDashboardStudent,
} from "../../../services/academyApi";
import { statusBadge, statusLabel, timeLabel } from "./recepcaoUtils";

const PANEL_PAGE_SIZE = 10;

type PanelKey =
  | "occupancyNow"
  | "accessToday"
  | "overdueStudents"
  | "birthdaysToday"
  | "exceptionsToday"
  | "deniedToday"
  | "newStudents7d"
  | "observability";

interface PanelRow {
  id: string | number;
  title: string;
  subtitle: string;
  badge?: string;
  badgeClass?: string;
  userId?: number | null;
}

interface DetailPanel {
  title: string;
  description: string;
  total: number;
  rows: PanelRow[];
  emptyTitle: string;
}

function eventTitle(event: ReceptionAccessEvent) {
  if (event.visitor.name) return event.visitor.name;
  return event.student.name ?? event.student.email ?? "Registro operacional";
}

function eventLabel(event: ReceptionAccessEvent) {
  if (event.eventType === "checkin") return "Entrada liberada";
  if (event.eventType === "exception") return "Exceção";
  if (event.eventType === "denied") return "Bloqueio";
  return event.visitor.type === "external_personal" ? "Personal externo" : "Visitante";
}

function eventBadge(event: ReceptionAccessEvent) {
  if (event.eventType === "checkin") return "badge badge-success";
  if (event.eventType === "exception") return "badge badge-warn";
  if (event.eventType === "denied") return "badge badge-danger";
  return "badge badge-info";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Sem data";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function eventRow(event: ReceptionAccessEvent): PanelRow {
  return {
    id: `event-${event.id}`,
    title: eventTitle(event),
    subtitle: [
      event.reason,
      timeLabel(event.createdAt),
      event.actorName ?? "sistema",
    ].filter(Boolean).join(" · "),
    badge: eventLabel(event),
    badgeClass: eventBadge(event),
    userId: event.student.userId,
  };
}

function studentRow(student: ReceptionDashboardStudent, context: "pending" | "new" | "birthday"): PanelRow {
  const plan = student.activePlan ? student.activePlan.name : "Sem plano";
  const contextLabel = {
    pending: `Último acesso: ${timeLabel(student.lastAccessAt)}`,
    new: `Entrada na base: ${formatDate(student.joinedAt)}`,
    birthday: `Nascimento: ${formatDate(student.birthDate)}`,
  }[context];

  return {
    id: `student-${student.userId}`,
    title: student.name || student.email,
    subtitle: `${student.email} · ${student.phone ?? "sem telefone"} · ${plan} · ${contextLabel}`,
    badge: statusLabel(student.studentStatus),
    badgeClass: statusBadge(student.studentStatus),
    userId: student.userId,
  };
}

export default function RecepcaoHubPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ReceptionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [panelPage, setPanelPage] = useState(1);

  useEffect(() => {
    fetchReceptionDashboard()
      .then((data) => {
        setDashboard(data);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const kpis = dashboard?.kpis;
  const panel = dashboard && activePanel ? buildPanel(activePanel, dashboard) : null;
  const totalPages = panel ? Math.max(1, Math.ceil(panel.rows.length / PANEL_PAGE_SIZE)) : 1;
  const pagedRows = panel
    ? panel.rows.slice((panelPage - 1) * PANEL_PAGE_SIZE, panelPage * PANEL_PAGE_SIZE)
    : [];

  function openPanel(key: PanelKey) {
    setActivePanel(key);
    setPanelPage(1);
  }

  function buildPanel(key: PanelKey, data: ReceptionDashboard): DetailPanel {
    const related = data.related;

    if (key === "occupancyNow") {
      const rows = (related?.occupancyNow ?? data.recentEvents).map(eventRow);
      return {
        title: "Lotação agora",
        description: "Entradas liberadas nos últimos 90 minutos.",
        total: data.kpis.occupancyNow,
        rows,
        emptyTitle: "Nenhuma entrada recente.",
      };
    }

    if (key === "accessToday") {
      const rows = (related?.accessToday ?? data.recentEvents).map(eventRow);
      return {
        title: "Acessos hoje",
        description: "Registros operacionais de entrada do dia.",
        total: data.kpis.accessToday,
        rows,
        emptyTitle: "Nenhum acesso registrado hoje.",
      };
    }

    if (key === "overdueStudents") {
      const rows = (related?.overdueStudents ?? []).map((student) => studentRow(student, "pending"));
      return {
        title: "Pendências",
        description: "Alunos com situação financeira ou operacional pendente.",
        total: data.kpis.overdueStudents,
        rows,
        emptyTitle: "Nenhuma pendência encontrada.",
      };
    }

    if (key === "birthdaysToday") {
      const rows = (related?.birthdaysToday ?? []).map((student) => studentRow(student, "birthday"));
      return {
        title: "Aniversariantes",
        description: "Alunos da academia que fazem aniversário hoje.",
        total: data.kpis.birthdaysToday,
        rows,
        emptyTitle: "Nenhum aniversariante hoje.",
      };
    }

    if (key === "exceptionsToday") {
      const rows = (related?.exceptionsToday ?? data.exceptions).map(eventRow);
      return {
        title: "Exceções hoje",
        description: "Entradas liberadas com justificativa obrigatória.",
        total: data.kpis.exceptionsToday,
        rows,
        emptyTitle: "Nenhuma exceção registrada hoje.",
      };
    }

    if (key === "deniedToday") {
      const rows = (related?.deniedToday ?? data.exceptions.filter((event) => event.eventType === "denied")).map(eventRow);
      return {
        title: "Bloqueios hoje",
        description: "Tentativas de entrada negadas e auditadas.",
        total: data.kpis.deniedToday,
        rows,
        emptyTitle: "Nenhum bloqueio registrado hoje.",
      };
    }

    if (key === "newStudents7d") {
      const rows = (related?.newStudents7d ?? []).map((student) => studentRow(student, "new"));
      return {
        title: "Novos alunos 7d",
        description: "Alunos cadastrados na última semana.",
        total: data.kpis.newStudents7d,
        rows,
        emptyTitle: "Nenhum novo aluno nos últimos 7 dias.",
      };
    }

    return {
      title: "Observability da catraca",
      description: "Estado atual das integrações de entrada.",
      total: 3,
      rows: [
        { id: "catraca", title: "Catraca", subtitle: data.status.catraca === "manual_only" ? "Operação manual habilitada" : data.status.catraca, badge: "Manual", badgeClass: "badge badge-info" },
        { id: "facial", title: "Reconhecimento facial", subtitle: data.status.facial === "planned" ? "Integração planejada" : data.status.facial, badge: "Planejado", badgeClass: "badge" },
        { id: "partners", title: "Parceiros", subtitle: data.status.partners === "planned" ? "Webhooks de parceiros planejados" : data.status.partners, badge: "Planejado", badgeClass: "badge" },
      ],
      emptyTitle: "Nenhum status disponível.",
    };
  }

  return (
    <div className="page-container">
      <div className="dash-hero">
        <div>
          <div className="dash-hero-eyebrow">Recepção</div>
          <h1 className="dash-hero-title">Operação da entrada</h1>
          <p className="dash-hero-meta">
            Check-in físico, exceções, pendências e visitantes em uma visão rápida para horário de pico.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <button className="btn btn-primary" onClick={() => navigate("/app/academy/recepcao/checkin")}>
            Abrir check-in
          </button>
          <button className="btn btn-secondary" onClick={() => navigate("/app/academy/recepcao/novo-aluno")}>
            Novo aluno
          </button>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="dash-section">
          <div className="dash-skeleton">
            {[1, 2, 3].map((item) => (
              <div key={item} className="dash-skeleton-bar" style={{ height: 64 }} />
            ))}
          </div>
        </div>
      ) : kpis ? (
        <>
          <div className="dash-kpi-grid">
            {[
              { key: "occupancyNow" as const, label: "Lotação agora", value: kpis.occupancyNow, tone: "" },
              { key: "accessToday" as const, label: "Acessos hoje", value: kpis.accessToday, tone: "dash-kpi-item-value--ok" },
              { key: "overdueStudents" as const, label: "Pendências", value: kpis.overdueStudents, tone: "dash-kpi-item-value--warn" },
              { key: "birthdaysToday" as const, label: "Aniversariantes", value: kpis.birthdaysToday, tone: "" },
            ].map((item) => (
              <button key={item.label} className="dash-kpi-item dash-kpi-button" onClick={() => openPanel(item.key)}>
                <div className="dash-kpi-item-label">{item.label}</div>
                <div className={`dash-kpi-item-value ${item.tone}`}>{item.value}</div>
              </button>
            ))}
          </div>

          <div className="dash-metrics-row">
            <button className="dash-metric-card dash-kpi-button" onClick={() => openPanel("exceptionsToday")}>
              <div className="dash-metric-value">{kpis.exceptionsToday}</div>
              <div className="dash-metric-label">Exceções hoje</div>
            </button>
            <button className="dash-metric-card dash-kpi-button" onClick={() => openPanel("deniedToday")}>
              <div className="dash-metric-value">{kpis.deniedToday}</div>
              <div className="dash-metric-label">Bloqueios hoje</div>
            </button>
            <button className="dash-metric-card dash-kpi-button" onClick={() => openPanel("newStudents7d")}>
              <div className="dash-metric-value">{kpis.newStudents7d}</div>
              <div className="dash-metric-label">Novos alunos 7d</div>
            </button>
            <button className="dash-metric-card dash-kpi-button" onClick={() => openPanel("observability")}>
              <div className="dash-metric-value" style={{ fontSize: "var(--text-lg)" }}>Manual</div>
              <div className="dash-metric-label">Catraca V1 observability</div>
            </button>
          </div>

          <div className="detail-layout">
            <section className="section-card">
              <div className="section-card__header">
                <h2 className="section-card__title">Entrando agora</h2>
                <button className="btn btn-sm btn-ghost" onClick={() => navigate("/app/academy/recepcao/checkin")}>
                  Registrar
                </button>
              </div>
              {dashboard.recentEvents.length === 0 ? (
                <EmptyState
                  eyebrow="Entrada"
                  title="Sem acessos físicos ainda"
                  description="Os eventos de check-in manual, exceção, visitante ou webhook de catraca aparecerão aqui."
                />
              ) : (
                <div style={{ display: "grid", gap: "var(--space-3)" }}>
                  {dashboard.recentEvents.map((event) => (
                    <div key={event.id} className="identity-row" style={{ justifyContent: "space-between" }}>
                      <div>
                        <div className="identity-row__name">{eventTitle(event)}</div>
                        <div className="identity-row__sub">{timeLabel(event.createdAt)} · {event.actorName ?? "sistema"}</div>
                      </div>
                      <span className={eventBadge(event)}>{eventLabel(event)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="section-card">
              <div className="section-card__header">
                <h2 className="section-card__title">Exceções 24h</h2>
              </div>
              {dashboard.exceptions.length === 0 ? (
                <div className="banner-success">Nenhuma exceção crítica nas últimas 24h.</div>
              ) : (
                <div style={{ display: "grid", gap: "var(--space-3)" }}>
                  {dashboard.exceptions.map((event) => (
                    <div key={event.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                        <strong>{eventTitle(event)}</strong>
                        <span className={eventBadge(event)}>{eventLabel(event)}</span>
                      </div>
                      <p className="small muted" style={{ margin: "4px 0 0" }}>
                        {event.reason ?? "Sem motivo informado"} · {timeLabel(event.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}

      {panel && (
        <div className="drawer-overlay" onClick={(event) => { if (event.target === event.currentTarget) setActivePanel(null); }}>
          <div className="drawer-panel" style={{ maxWidth: 860 }}>
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div className="section-card__header" style={{ marginBottom: 0 }}>
                <div>
                  <div className="dash-eyebrow">Dados relacionados</div>
                  <h2 style={{ margin: "4px 0 0", fontSize: "var(--text-lg)" }}>{panel.title}</h2>
                  <p className="small muted" style={{ margin: "var(--space-2) 0 0" }}>
                    {panel.description} Total: {panel.total}.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setActivePanel(null)}>
                  Fechar
                </button>
              </div>

              {panel.rows.length === 0 ? (
                <div className="banner-success">{panel.emptyTitle}</div>
              ) : (
                <>
                  <div className="table-wrapper" style={{ boxShadow: "none" }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Registro</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <div className="identity-row__name">{row.title}</div>
                              <div className="identity-row__sub">{row.subtitle}</div>
                            </td>
                            <td>
                              {row.badge && <span className={row.badgeClass ?? "badge"}>{row.badge}</span>}
                            </td>
                            <td>
                              {row.userId && (
                                <button
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => navigate(`/app/academy/students/${row.userId}`)}
                                >
                                  Ver perfil
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <span className="small muted">
                      Exibindo {pagedRows.length} de {panel.rows.length} registros · máximo {PANEL_PAGE_SIZE} por página
                    </span>
                    {totalPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setPanelPage((page) => Math.max(1, page - 1))} disabled={panelPage === 1}>
                          Anterior
                        </button>
                        <span className="small muted">Página {panelPage} de {totalPages}</span>
                        <button className="btn btn-sm btn-ghost" onClick={() => setPanelPage((page) => Math.min(totalPages, page + 1))} disabled={panelPage === totalPages}>
                          Próxima
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
