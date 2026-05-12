import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAcademyDashboard, type AcademyDashboard, type AcademyDashboardAtRiskStudent } from "../../services/academyApi";
import { EmptyState } from "../../components/EmptyState";

function dayLabel(n: number) {
  return n === 1 ? "1 dia" : `${n} dias`;
}

function AdherenceBar({ pct }: { pct: number | null }) {
  const value = pct ?? 0;
  const color =
    value >= 70
      ? "var(--color-success, #22c55e)"
      : value >= 40
      ? "var(--color-warning, #f59e0b)"
      : "var(--color-danger, #ef4444)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--color-surface-2, rgba(0,0,0,.06))",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(value, 100)}%`,
            height: "100%",
            background: color,
            borderRadius: 99,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--color-text-2)", minWidth: 36, textAlign: "right" }}>
        {pct != null ? `${value}%` : "—"}
      </span>
    </div>
  );
}

function AtRiskCard({ students }: { students: AcademyDashboardAtRiskStudent[] }) {
  const navigate = useNavigate();

  if (students.length === 0) return null;

  return (
    <div className="dash-section" style={{ marginTop: "var(--space-6)" }}>
      <div className="dash-section-header">
        <div className="dash-section-title">Sinais da semana</div>
        <div className="dash-section-subtitle">Alunos sem atividade há mais de 14 dias</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
        {students.map((s) => (
          <div
            key={s.id}
            className="dash-alert-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              background: "var(--color-surface-1, var(--color-surface))",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
            }}
            onClick={() => navigate(`/app/academy/students/${s.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/app/academy/students/${s.id}`)}
          >
            <span
              className="avatar-initials avatar-initials--sm"
              style={{
                background: "var(--color-primary-soft, rgba(0,0,0,.08))",
                color: "var(--color-primary)",
                flexShrink: 0,
                width: 32,
                height: 32,
                fontSize: "0.75rem",
              }}
            >
              {s.name.slice(0, 2).toUpperCase()}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-2)", marginTop: 1 }}>
                Sem atividade há {dayLabel(s.daysInactive)}
              </div>
            </div>

            <span
              className="badge"
              style={{
                background: "var(--color-danger-soft, rgba(239,68,68,.08))",
                color: "var(--color-danger, #ef4444)",
                border: "1px solid rgba(239,68,68,.2)",
                flexShrink: 0,
              }}
            >
              Em risco
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "var(--space-3)", textAlign: "right" }}>
        <button
          className="btn btn-sm"
          onClick={() => navigate("/app/academy/students?filter=at_risk")}
        >
          Ver todos em risco
        </button>
      </div>
    </div>
  );
}

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

  const academy        = data?.academy;
  const branding       = data?.branding;
  const members        = data?.membersByRole ?? {};
  const total          = data?.totalMembers ?? 0;
  const retention      = data?.retention;
  const atRiskStudents = data?.atRiskStudents ?? [];
  const academyName    = branding?.display_name ?? academy?.display_name ?? "Academia";
  const logoColor      = branding?.primary_color ?? "var(--color-primary)";
  const initial        = academyName.slice(0, 2).toUpperCase();

  const students          = retention?.totalStudents ?? (members["academy_student"] ?? 0);
  const studentsActive    = retention?.studentsActive ?? 0;
  const studentsAtRisk    = retention?.studentsAtRisk ?? 0;
  const professionalsActive = data?.professionalsActive ?? (members["academy_personal"] ?? 0);
  const adherence7d       = retention?.adherence7dPct ?? null;
  const staff             = total - students;

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
          {students === 0 && staff <= 1 && (
            <p className="dash-hero-hint">
              Configure a identidade visual da academia e adicione o primeiro aluno para começar.
            </p>
          )}
        </div>

        <div className="dash-hero-right">
          <div className="dash-pulse-label">Membros totais</div>
          <div className="dash-pulse-value">{total}</div>
        </div>
      </div>

      {/* KPI signal grid */}
      {students > 0 ? (
        <div className="dash-kpi-grid" style={{ marginTop: "var(--space-6)" }}>
          <div className="dash-kpi-item">
            <div className="dash-kpi-item-label">Alunos ativos</div>
            <div className="dash-kpi-item-value">{studentsActive}</div>
            <div className="dash-kpi-item-note">últimos 7 dias</div>
          </div>

          <div className="dash-kpi-item">
            <div className="dash-kpi-item-label">Em risco</div>
            <div
              className="dash-kpi-item-value"
              style={studentsAtRisk > 0 ? { color: "var(--color-danger, #ef4444)" } : undefined}
            >
              {studentsAtRisk}
            </div>
            <div className="dash-kpi-item-note">sem check-in em 14d</div>
          </div>

          <div className="dash-kpi-item">
            <div className="dash-kpi-item-label">Personais</div>
            <div className="dash-kpi-item-value">{professionalsActive}</div>
            <div className="dash-kpi-item-note">ativos</div>
          </div>

          <div className="dash-kpi-item">
            <div className="dash-kpi-item-label">Aderência 7d</div>
            <AdherenceBar pct={adherence7d} />
            <div className="dash-kpi-item-note" style={{ marginTop: "var(--space-1)" }}>
              {adherence7d != null ? "da base ativa" : "aguardando dados"}
            </div>
          </div>
        </div>
      ) : (
        <div className="dash-section" style={{ marginTop: "var(--space-6)" }}>
          <EmptyState
            eyebrow="Inteligência da academia"
            title="Sinais metabólicos em formação"
            description="Os indicadores de retenção, aderência e risco aparecem após as primeiras matrículas e check-ins. Adicione alunos para iniciar a leitura da base."
            action={
              <button className="btn btn-primary" onClick={() => navigate("/app/academy/students")}>
                Adicionar primeiro aluno
              </button>
            }
          />
        </div>
      )}

      {/* At-risk students card */}
      <AtRiskCard students={atRiskStudents} />
    </div>
  );
}
