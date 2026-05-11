import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAcademyDashboard, type AcademyDashboard } from "../../services/academyApi";


export default function AcademyDashboardPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState<AcademyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetchAcademyDashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="dash-section">
          <div className="dash-skeleton">
            <div className="dash-skeleton-bar" style={{ height: 22, width: "30%" }} />
            <div className="dash-skeleton-bar" style={{ height: 14, width: "55%" }} />
          </div>
        </div>
        <div className="dash-metrics-row">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="dash-metric-card">
              <div className="dash-skeleton-bar" style={{ height: 32, width: "50%" }} />
              <div className="dash-skeleton-bar" style={{ height: 12, width: "70%", marginTop: 6 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="banner-error" role="alert">{error}</div>
      </div>
    );
  }

  const academy     = data?.academy;
  const branding    = data?.branding;
  const members     = data?.membersByRole ?? {};
  const total       = data?.totalMembers ?? 0;
  const academyName = branding?.display_name ?? academy?.display_name ?? "Academia";
  const logoColor   = branding?.primary_color ?? "var(--color-primary)";
  const initial     = academyName.slice(0, 2).toUpperCase();

  const students   = members["academy_student"] ?? 0;
  const staff      = total - students;

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="dash-hero">
        <div>
          <div className="dash-hero-eyebrow">Visão geral</div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginTop: "var(--space-2)" }}>
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={academyName}
                style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <span
                className="avatar-initials avatar-initials--md"
                style={{ background: logoColor, color: "#fff", width: 44, height: 44 }}
              >
                {initial}
              </span>
            )}
            <div>
              <h1 className="dash-hero-title">{academyName}</h1>
              {academy?.status && (
                <span className={academy.status === "active" ? "badge badge-success" : "badge badge-warn"}>
                  {academy.status === "active" ? "Ativa" : academy.status}
                </span>
              )}
            </div>
          </div>
          <p className="dash-hero-meta">
            {students > 0
              ? `${students} aluno${students !== 1 ? "s" : ""} matriculado${students !== 1 ? "s" : ""} · ${staff} membro${staff !== 1 ? "s" : ""} de equipe`
              : "Sua academia está pronta para começar a receber alunos."}
          </p>
          <div className="dash-hero-links">
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/app/academy/students")}>
              Ver alunos
            </button>
            <button className="btn btn-sm" onClick={() => navigate("/app/academy/team")}>
              Gerenciar equipe
            </button>
            <button className="btn btn-sm" onClick={() => navigate("/app/academy/branding")}>
              Identidade visual
            </button>
          </div>
        </div>

        <div className="dash-hero-right">
          <div className="dash-pulse-label">Membros totais</div>
          <div className="dash-pulse-value">{total}</div>
        </div>
      </div>

      {/* KPI grid */}
      {total > 0 ? (
        <div className="dash-kpi-grid">
          {[
            { label: "Alunos",     value: students,                          note: "na academia" },
            { label: "Equipe",     value: staff,                             note: "recepção, gestão, staff" },
            { label: "Personais",  value: members["academy_personal"] ?? 0,  note: "vinculados" },
            { label: "Financeiro", value: members["academy_finance"]  ?? 0,  note: "acesso financeiro" },
          ].map(({ label, value, note }) => (
            <div key={label} className="dash-kpi-item">
              <div className="dash-kpi-item-label">{label}</div>
              <div className="dash-kpi-item-value">{value}</div>
              <div className="dash-kpi-item-note">{note}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dash-section">
          <div className="empty-state">
            <p className="empty-state__title">A academia está configurada</p>
            <p className="empty-state__body">
              Adicione alunos e membros de equipe para os indicadores aparecerem aqui.
            </p>
            <button className="btn btn-primary" onClick={() => navigate("/app/academy/students")}>
              Adicionar primeiro aluno
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
