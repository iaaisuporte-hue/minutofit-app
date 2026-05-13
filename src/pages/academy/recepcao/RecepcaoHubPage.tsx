import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../../components/EmptyState";
import {
  fetchReceptionDashboard,
  type ReceptionAccessEvent,
  type ReceptionDashboard,
} from "../../../services/academyApi";
import { timeLabel } from "./recepcaoUtils";

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

export default function RecepcaoHubPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ReceptionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
              { label: "Lotação agora", value: kpis.occupancyNow, tone: "" },
              { label: "Acessos hoje", value: kpis.accessToday, tone: "dash-kpi-item-value--ok" },
              { label: "Pendências", value: kpis.overdueStudents, tone: "dash-kpi-item-value--warn" },
              { label: "Aniversariantes", value: kpis.birthdaysToday, tone: "" },
            ].map((item) => (
              <div key={item.label} className="dash-kpi-item">
                <div className="dash-kpi-item-label">{item.label}</div>
                <div className={`dash-kpi-item-value ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="dash-metrics-row">
            <div className="dash-metric-card">
              <div className="dash-metric-value">{kpis.exceptionsToday}</div>
              <div className="dash-metric-label">Exceções hoje</div>
            </div>
            <div className="dash-metric-card">
              <div className="dash-metric-value">{kpis.deniedToday}</div>
              <div className="dash-metric-label">Bloqueios hoje</div>
            </div>
            <div className="dash-metric-card">
              <div className="dash-metric-value">{kpis.newStudents7d}</div>
              <div className="dash-metric-label">Novos alunos 7d</div>
            </div>
            <div className="dash-metric-card">
              <div className="dash-metric-value" style={{ fontSize: "var(--text-lg)" }}>Manual</div>
              <div className="dash-metric-label">Catraca V1 observability</div>
            </div>
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
    </div>
  );
}
