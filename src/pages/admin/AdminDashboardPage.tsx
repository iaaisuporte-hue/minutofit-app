import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { adminStudents } from "./adminData";
import { fetchAdminDashboardMetrics, type AdminDashboardMetrics } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function AdminDashboardPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "neutral" | "warning"; text: string } | null>(null);
  const [metricsData, setMetricsData] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<"all" | "critical" | "attention">("all");

  async function loadMetrics() {
    setLoading(true);
    setError(null);
    try {
      const metrics = await fetchAdminDashboardMetrics();
      setMetricsData(metrics);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetrics();
  }, []);

  const metrics = useMemo(() => {
    const onboardingPending = adminStudents.filter((student) => student.onboarding === "pendente").length;
    const tierMap = new Map((metricsData?.tierBreakdown || []).map((item) => [item.name?.toLowerCase(), Number(item.count || 0)]));
    const freeCount = tierMap.get("free") || 0;
    const proCount = tierMap.get("pro") || 0;
    const premiumCount = tierMap.get("premium") || 0;

    if (!metricsData) {
      return [
        { title: "Alunos ativos", value: "--", note: "aguardando dados" },
        { title: "Assinaturas ativas", value: "--", note: "aguardando dados" },
        { title: "Onboarding pendente", value: String(onboardingPending), note: "pedem atenção de ativação" },
        { title: "Mix de planos", value: "--", note: "aguardando dados" },
      ];
    }

    return [
      { title: "Usuários totais", value: String(metricsData.totalUsers), note: "base cadastrada" },
      { title: "Assinaturas ativas", value: String(metricsData.activeSubscriptions), note: "base recorrente atual" },
      { title: "Onboarding pendente", value: String(onboardingPending), note: "pedem atenção de ativação" },
      { title: "Mix de planos", value: `${freeCount}/${proCount}/${premiumCount}`, note: "Free / Pro / Premium" },
    ];
  }, [metricsData]);

  const alerts = useMemo(() => {
    const criticalStudents = adminStudents
      .filter((student) => student.status === "em risco" || student.weeklyConsistency === "0/7" || student.weeklyConsistency === "1/7")
      .map((student) => ({
        severity: "critical" as const,
        text: `${student.name} com risco de churn (${student.weeklyConsistency}) e onboarding ${student.onboarding}.`,
      }));

    const pendingOnboarding = adminStudents
      .filter((student) => student.onboarding === "pendente")
      .map((student) => ({
        severity: "attention" as const,
        text: `${student.name} ainda não concluiu onboarding.`,
      }));

    const billingAttention =
      metricsData && metricsData.activeSubscriptions < metricsData.totalUsers
        ? [
            {
              severity: "attention" as const,
              text: `${metricsData.totalUsers - metricsData.activeSubscriptions} usuários sem assinatura ativa no momento.`,
            },
          ]
        : [];

    const allAlerts = [...criticalStudents, ...pendingOnboarding, ...billingAttention];
    if (alertFilter === "critical") return allAlerts.filter((item) => item.severity === "critical");
    if (alertFilter === "attention") return allAlerts.filter((item) => item.severity === "attention");
    return allAlerts;
  }, [alertFilter, metricsData]);

  function handleResetDefault() {
    const result = auth.resetUserPassword(email, "123456");
    setFeedback({
      tone: result.ok ? "neutral" : "warning",
      text: result.message,
    });
  }

  function handleCustomPassword() {
    const result = auth.resetUserPassword(email, newPass);
    setFeedback({
      tone: result.ok ? "neutral" : "warning",
      text: result.message,
    });
  }

  const currentMetrics = metricsData ?? { totalUsers: 0, activeSubscriptions: 0, mrr: 0, totalRevenue: 0, tierBreakdown: [] };
  const hasReadyData = Boolean(metricsData) && !loading && !error;
  const hasEmptyState = hasReadyData && currentMetrics.totalUsers === 0;

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  }

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <Card style={{ background: COLORS.panelDeep, border: `1px solid ${COLORS.borderStrong}` }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              background: COLORS.primarySoft,
              color: "#22C55E",
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Operação da plataforma
          </div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>Visão geral do MinutoFit</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 840 }}>Cockpit operacional com leitura rápida do negócio, sinais prioritários e atalhos de ação.</div>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            Perfil de acesso atual: <b style={{ color: "#1F2937" }}>{auth.accessProfile ?? "sem perfil"}</b>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/app/admin/users" style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none" }}>
              Ver alunos pendentes
            </Link>
            <Link to="/app/admin/finance" style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none" }}>
              Abrir financeiro
            </Link>
            <Link to="/app/admin/personals" style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none" }}>
              Revisar profissionais
            </Link>
          </div>
        </div>
      </Card>

      {loading && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Carregando visão do negócio...</div>
          <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>Buscando métricas em tempo real do backend administrativo.</div>
        </Card>
      )}

      {error && (
        <Card style={{ border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Não foi possível carregar o dashboard</div>
          <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>{error}</div>
          <button
            type="button"
            onClick={() => void loadMetrics()}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${COLORS.redBorder}`,
              background: "#F9FAFB",
              color: COLORS.text,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </Card>
      )}

      {hasEmptyState && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Ainda não há dados para exibir</div>
          <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>Quando usuários e assinaturas forem criados, as métricas aparecerão aqui automaticamente.</div>
        </Card>
      )}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {metrics.map((item) => (
          <Card key={item.title}>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>{item.title}</div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700 }}>{item.value}</div>
            <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>{item.note}</div>
          </Card>
        ))}
      </div>

      {hasReadyData && (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          <Card>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>MRR atual</div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700 }}>{formatCurrency(currentMetrics.mrr)}</div>
            <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>receita recorrente mensal</div>
          </Card>
          <Card>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Receita acumulada</div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700 }}>{formatCurrency(currentMetrics.totalRevenue)}</div>
            <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>pagamentos aprovados</div>
          </Card>
        </div>
      )}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1.35fr .95fr" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Alertas que merecem atenção</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "all", label: "Todos" },
                { key: "critical", label: "Críticos" },
                { key: "attention", label: "Atenção" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setAlertFilter(item.key as "all" | "critical" | "attention")}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 999,
                    border: `1px solid ${alertFilter === item.key ? COLORS.borderStrong : COLORS.border}`,
                    background: alertFilter === item.key ? COLORS.primarySoft : COLORS.panelSoft,
                    color: COLORS.text,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>
            Itens priorizados para ação rápida da operação.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {alerts.length === 0 && (
              <div style={{ padding: "14px 16px", borderRadius: 16, border: `1px solid ${COLORS.border}`, background: COLORS.panelSoft }}>
                Nenhum alerta para o filtro selecionado.
              </div>
            )}
            {alerts.map((alert, index) => (
              <div
                key={`${alert.text}-${index}`}
                style={{
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: `1px solid ${alert.severity === "critical" ? COLORS.redBorder : COLORS.border}`,
                  background: alert.severity === "critical" ? COLORS.redSoft : COLORS.panelSoft,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: alert.severity === "critical" ? "#FF9C9C" : "#FFD36C" }}>
                  {alert.severity === "critical" ? "CRÍTICO" : "ATENÇÃO"}
                </div>
                {alert.text}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Operações rápidas</div>
          <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
            Ações de suporte com feedback inline e sem interrupções de contexto.
          </div>
          {feedback && (
            <div
              style={{
                marginTop: 12,
                borderRadius: 14,
                border: `1px solid ${feedback.tone === "warning" ? COLORS.redBorder : COLORS.borderStrong}`,
                background: feedback.tone === "warning" ? COLORS.redSoft : COLORS.primarySoft,
                padding: "12px 14px",
                lineHeight: 1.5,
              }}
            >
              {feedback.text}
            </div>
          )}

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,.85)" }}>E-mail do usuário</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teste1@treinai.com"
                style={{
                  padding: "12px 12px",
                  borderRadius: 16,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(8,14,11,.78)",
                  color: COLORS.text,
                  outline: "none",
                }}
              />
            </label>

            <input
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Nova senha opcional"
              style={{
                padding: "12px 12px",
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(8,14,11,.78)",
                color: COLORS.text,
                outline: "none",
              }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleResetDefault}
                disabled={!email.trim()}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: "#22C55E",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Resetar para 123456
              </button>
              <button
                type="button"
                onClick={handleCustomPassword}
                disabled={!email.trim() || !newPass.trim()}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panelSoft,
                  color: COLORS.text,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Definir senha
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
