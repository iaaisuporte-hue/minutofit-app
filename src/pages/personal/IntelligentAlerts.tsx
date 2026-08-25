import { COLORS } from "../../styles/colors";
import type { PersonalDashboardAlert } from "../../services/personalDashboardApi";
import "./personalPremium.css";

function toneFor(type: PersonalDashboardAlert["type"]) {
  switch (type) {
    case "full_adherence":
      return { className: "pp-alert--success", label: "Reconhecimento" };
    case "overtraining":
      return { className: "pp-alert--warn", label: "Sobrecarga" };
    case "recovery_gap":
      return { className: "pp-alert--warn", label: "Recuperação" };
    case "cluster_low_sleep":
      return { className: "pp-alert--warn", label: "Recuperação" };
    case "silent_disappear":
      return { className: "pp-alert--danger", label: "Risco" };
    case "metabolic_decline":
      return { className: "pp-alert--danger", label: "Metabolismo" };
    case "payment_overdue":
      return { className: "pp-alert--warn", label: "Financeiro" };
    default:
      return { className: "pp-alert--neutral", label: "Atenção" };
  }
}

export default function IntelligentAlerts({
  alerts,
  onOpenStudent,
  onOpenStudents,
  onOpenRoute,
}: {
  alerts: PersonalDashboardAlert[];
  onOpenStudent: (studentId: string) => void;
  onOpenStudents: () => void;
  /** Destino do alerta que não se resolve na ficha do aluno (ex.: Financeiro). */
  onOpenRoute?: (href: string) => void;
}) {
  if (!alerts.length) {
    return (
      <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
        Os indicadores da carteira estão dentro do esperado — nenhum sinal de risco, abandono ou sobrecarga detectado agora.
      </div>
    );
  }

  return (
    <div style={{ display: "grid" }}>
      {alerts.map((alert) => {
        const tone = toneFor(alert.type);
        // `actionHref` tem prioridade: um vencido se resolve no Financeiro, não
        // na ficha de treino do aluno — mesmo quando o alerta nomeia um aluno.
        // Só rota interna do app: o destino vem do payload da API, e navegar
        // para o que vier de lá é conceder a ele o roteador inteiro.
        const href =
          alert.actionHref && onOpenRoute && alert.actionHref.startsWith("/app/")
            ? alert.actionHref
            : null;
        const cta = href
          ? () => onOpenRoute!(href)
          : alert.studentId
            ? () => onOpenStudent(alert.studentId!)
            : onOpenStudents;
        const ctaLabel = href
          ? alert.type === "payment_overdue"
            ? "Abrir Financeiro"
            : "Abrir"
          : alert.studentId
            ? "Ver aluno"
            : "Ver alunos";

        return (
          <div
            key={`${alert.type}-${alert.studentId ?? "all"}`}
            className={`pp-alert ${tone.className}`}
          >
            <div className="pp-alert__rail" />
            <div style={{ display: "grid", gap: 6, minWidth: "min(280px, 100%)", flex: "1 1 280px" }}>
              <div className="pp-kicker">{tone.label}</div>
              <div style={{ fontWeight: 650, fontSize: 15, color: COLORS.text }}>{alert.title}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45 }}>{alert.description}</div>
            </div>

            <button
              type="button"
              onClick={cta}
              className="pp-btn pp-btn--quiet"
            >
              {ctaLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}
