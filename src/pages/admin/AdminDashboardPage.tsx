import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { adminNutris, adminPersonals, adminStudents } from "./adminData";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
  primarySoft: "rgba(29,185,84,.18)",
  redSoft: "rgba(255,110,110,.10)",
  redBorder: "rgba(255,110,110,.28)",
};

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
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
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

  const metrics = useMemo(() => {
    const activeStudents = adminStudents.filter((student) => student.status === "ativo").length;
    const blackPlans = adminStudents.filter((student) => student.plan === "black").length;
    const onboardingPending = adminStudents.filter((student) => student.onboarding === "pendente").length;
    const activeProfessionals = [...adminPersonals, ...adminNutris].filter((professional) => professional.status === "ativo").length;
    return [
      { title: "Alunos ativos", value: String(activeStudents), note: "base já engajada" },
      { title: "Planos Black", value: String(blackPlans), note: "potencial de ticket alto" },
      { title: "Onboarding pendente", value: String(onboardingPending), note: "pedem atenção de ativação" },
      { title: "Profissionais ativos", value: String(activeProfessionals), note: "personal + nutri" },
    ];
  }, []);

  const alerts = useMemo(
    () =>
      [
        "Fernanda Costa está com consistência baixa e onboarding ainda pendente.",
        "Lucas Martins entrou, mas ainda não concluiu o fluxo inicial.",
        "Dois espaços premium estão prontos para virar operação de verdade: academia e consultoria.",
      ],
    []
  );

  function handleResetDefault() {
    const result = auth.resetUserPassword(email, "123456");
    alert(result.message);
  }

  function handleCustomPassword() {
    const result = auth.resetUserPassword(email, newPass);
    alert(result.message);
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
              color: "#7CFF6B",
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Operação da plataforma
          </div>
          <div style={{ fontSize: 30, fontWeight: 1000 }}>Visão geral do MinutoFit</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 840 }}>
            Esta área agora funciona como cockpit operacional: leitura rápida do negócio, sinais de ativação e um espaço
            de suporte administrativo sem ficar restrito a uma única ação de reset.
          </div>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            Perfil de acesso atual: <b style={{ color: "#FFFFFF" }}>{auth.accessProfile ?? "sem perfil"}</b>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {metrics.map((item) => (
          <Card key={item.title}>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>{item.title}</div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 1000 }}>{item.value}</div>
            <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>{item.note}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1.35fr .95fr" }}>
        <Card>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Alertas que merecem atenção</div>
          <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>
            Itens que ajudam o admin a saber onde agir primeiro.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {alerts.map((alert) => (
              <div
                key={alert}
                style={{
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: `1px solid ${COLORS.redBorder}`,
                  background: COLORS.redSoft,
                  lineHeight: 1.5,
                }}
              >
                {alert}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Operações rápidas</div>
          <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
            Enquanto o backend administrativo não estiver completo, este bloco centraliza o suporte mais operacional.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 900, color: "rgba(255,255,255,.85)" }}>E-mail do usuário</span>
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
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                  color: "#082014",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                Resetar para 123456
              </button>
              <button
                type="button"
                onClick={handleCustomPassword}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panelSoft,
                  color: COLORS.text,
                  fontWeight: 1000,
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
