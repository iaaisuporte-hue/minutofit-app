import { Link, useParams } from "react-router-dom";
import { adminStudents, getAdminPersonalById } from "./adminData";
import { COLORS } from "../../styles/colors";

export default function AdminPersonalDetailsPage() {
  const { personalId } = useParams();
  const personal = getAdminPersonalById(personalId);

  if (!personal) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Personal não encontrado</div>
        <Link to="/app/admin/personals" style={{ color: "#22C55E" }}>
          Voltar para personals
        </Link>
      </div>
    );
  }

  const linkedStudents = adminStudents.filter((student) => student.personal === personal.name);

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <Link to="/app/admin/personals" style={{ color: "#22C55E", textDecoration: "none", fontWeight: 600, width: "fit-content" }}>
          ← Voltar para personals
        </Link>
        <div style={{ fontSize: 30, fontWeight: 700 }}>{personal.name}</div>
        <div style={{ color: COLORS.muted }}>{personal.email}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Status", value: personal.status },
          { label: "Especialidade", value: personal.specialty },
          { label: "Clientes ativos", value: String(personal.activeClients) },
          { label: "Papel", value: personal.role },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 18,
              background: COLORS.panel,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          background: COLORS.panel,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>Alunos vinculados</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
          Aqui o admin consegue enxergar rapidamente quem está sob acompanhamento e como anda a carteira operacional desse personal.
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {linkedStudents.map((student) => (
            <div
              key={student.id}
              style={{
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                padding: 14,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 600 }}>{student.name}</div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  {student.goal} • {student.plan} • {student.weeklyConsistency}
                </div>
              </div>
              <Link to={`/app/admin/users/${student.id}`} style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none" }}>
                Ver aluno
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
