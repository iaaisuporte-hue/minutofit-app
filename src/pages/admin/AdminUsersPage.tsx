import { Link } from "react-router-dom";
import { adminStudents } from "./adminData";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
};

function pillColor(status: string) {
  if (status === "ativo") return { background: "rgba(29,185,84,.14)", border: "rgba(29,185,84,.28)", color: "#7CFF6B" };
  if (status === "em risco") return { background: "rgba(255,200,80,.14)", border: "rgba(255,200,80,.28)", color: "#FFD36C" };
  return { background: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.14)", color: "rgba(255,255,255,.78)" };
}

export default function AdminUsersPage() {
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
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Alunos</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 780 }}>
          Lista operacional do que o admin mais precisa enxergar: plano, ativação, consistência e necessidade de atenção.
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {adminStudents.map((student) => {
          const statusVisual = pillColor(student.status);
          return (
            <div
              key={student.id}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 20,
                background: COLORS.panel,
                boxShadow: "0 18px 44px rgba(0,0,0,.45)",
                padding: 18,
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 20, fontWeight: 1000 }}>{student.name}</div>
                  <div style={{ color: COLORS.muted }}>{student.email}</div>
                </div>
                <div
                  style={{
                    borderRadius: 999,
                    padding: "8px 12px",
                    border: `1px solid ${statusVisual.border}`,
                    background: statusVisual.background,
                    color: statusVisual.color,
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  {student.status}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 10,
                }}
              >
                {[
                  { label: "Plano", value: student.plan },
                  { label: "Objetivo", value: student.goal },
                  { label: "Onboarding", value: student.onboarding },
                  { label: "Último check-in", value: student.lastCheckin },
                  { label: "Consistência", value: student.weeklyConsistency },
                  { label: "Personal", value: student.personal ?? "Sem vínculo" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      borderRadius: 16,
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.panelSoft,
                      padding: 12,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
                    <div style={{ fontWeight: 900 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link
                  to={`/app/admin/users/${student.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.borderStrong}`,
                    background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                    color: "#082014",
                    fontWeight: 1000,
                    textDecoration: "none",
                    width: "fit-content",
                  }}
                >
                  Ver detalhe do aluno
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
