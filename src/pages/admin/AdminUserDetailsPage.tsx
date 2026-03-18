import { Link, useParams } from "react-router-dom";
import { getAdminStudentById } from "./adminData";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
};

export default function AdminUserDetailsPage() {
  const { userId } = useParams();
  const student = getAdminStudentById(userId);

  if (!student) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 24, fontWeight: 1000 }}>Aluno não encontrado</div>
        <Link to="/app/admin/users" style={{ color: "#7CFF6B" }}>
          Voltar para alunos
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <Link to="/app/admin/users" style={{ color: "#7CFF6B", textDecoration: "none", fontWeight: 900, width: "fit-content" }}>
          ← Voltar para alunos
        </Link>
        <div style={{ fontSize: 30, fontWeight: 1000 }}>{student.name}</div>
        <div style={{ color: COLORS.muted }}>{student.email}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {[
          { label: "Plano", value: student.plan },
          { label: "Status", value: student.status },
          { label: "Objetivo", value: student.goal },
          { label: "Personal", value: student.personal ?? "Sem vínculo" },
          { label: "Onboarding", value: student.onboarding },
          { label: "Último check-in", value: student.lastCheckin },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 18,
              background: COLORS.panel,
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 1000 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 14 }}>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
            padding: 18,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Leitura administrativa</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
            Esta área deve virar o ponto de decisão do admin sobre retenção, risco de churn, necessidade de abordagem humana e
            qualidade do onboarding.
          </div>
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              padding: 14,
              lineHeight: 1.6,
            }}
          >
            {student.status === "em risco"
              ? "Sinal amarelo: a consistência caiu e o onboarding ainda não foi concluído. Vale acionar o aluno ou revisar fricções da jornada."
              : student.status === "pendente"
                ? "Aluno recém-chegado ou ainda não ativado. O maior foco aqui é converter cadastro em rotina real."
                : "Aluno ativo. O próximo passo administrativo é garantir continuidade, plano adequado e boa experiência com o profissional vinculado."}
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
            padding: 18,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Próximas ações</div>
          {[
            "Revisar plano e etapa atual do aluno.",
            "Confirmar se o fluxo inicial foi concluído sem fricção.",
            "Verificar se existe vínculo com personal ou nutri.",
            "Usar esta tela futuramente para pagamentos, suporte e histórico.",
          ].map((action) => (
            <div
              key={action}
              style={{
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                padding: 12,
                lineHeight: 1.5,
              }}
            >
              {action}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
