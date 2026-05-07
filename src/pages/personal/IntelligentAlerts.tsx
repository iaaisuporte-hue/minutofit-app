import { COLORS } from "../../styles/colors";
import type { PersonalDashboardAlert } from "../../services/personalDashboardApi";

function toneFor(type: PersonalDashboardAlert["type"]) {
  switch (type) {
    case "full_adherence":
      return { border: COLORS.successBorder, background: COLORS.successBg, label: "Reconhecimento" };
    case "overtraining":
      return { border: COLORS.warnBorder, background: COLORS.warnBg, label: "Sobrecarga" };
    case "silent_disappear":
      return { border: COLORS.dangerBorder, background: COLORS.dangerBg, label: "Risco" };
    default:
      return { border: COLORS.borderStrong, background: COLORS.primarySoft, label: "Atenção" };
  }
}

export default function IntelligentAlerts({
  alerts,
  onOpenStudent,
  onOpenStudents,
}: {
  alerts: PersonalDashboardAlert[];
  onOpenStudent: (studentId: string) => void;
  onOpenStudents: () => void;
}) {
  if (!alerts.length) {
    return <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>Nenhum alerta inteligente disparado agora. A carteira está sob controle.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {alerts.map((alert) => {
        const tone = toneFor(alert.type);
        const cta = alert.studentId ? () => onOpenStudent(alert.studentId!) : onOpenStudents;

        return (
          <div
            key={`${alert.type}-${alert.studentId ?? "all"}`}
            style={{
              border: `1px solid ${tone.border}`,
              borderRadius: 18,
              background: tone.background,
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ display: "grid", gap: 6, minWidth: "min(280px, 100%)", flex: "1 1 280px" }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  borderRadius: 999,
                  border: `1px solid ${tone.border}`,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: COLORS.text,
                }}
              >
                {tone.label}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{alert.title}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45 }}>{alert.description}</div>
            </div>

            <button
              type="button"
              onClick={cta}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${tone.border}`,
                background: "#FFFFFF",
                color: COLORS.text,
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              {alert.studentId ? "Ver aluno" : "Ver alunos"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
