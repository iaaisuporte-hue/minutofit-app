import type { ReceptionStudent } from "../../../services/academyApi";
import { initials, statusBadge, statusLabel, timeLabel } from "./recepcaoUtils";

interface StudentAccessCardProps {
  student: ReceptionStudent;
  loading?: boolean;
  onClear?: () => void;
  onCheckin: () => void;
  onException: () => void;
  onDeny: () => void;
}

export function StudentAccessCard({
  student,
  loading,
  onClear,
  onCheckin,
  onException,
  onDeny,
}: StudentAccessCardProps) {
  const isBlocked =
    student.studentStatus === "overdue" ||
    student.studentStatus === "paused" ||
    student.studentStatus === "cancelled";

  return (
    <div className="section-card" style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", alignItems: "flex-start" }}>
        <div className="identity-row">
          {student.avatarUrl ? (
            <img
              src={student.avatarUrl}
              alt={student.name}
              style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <span className="avatar-initials avatar-initials--lg">
              {initials(student.name || student.email)}
            </span>
          )}
          <div>
            <div className="dash-eyebrow">Aluno localizado</div>
            <h2 style={{ margin: 0, fontSize: "var(--text-xl)" }}>{student.name || student.email}</h2>
            <p className="small muted" style={{ margin: "4px 0 0" }}>
              {student.email} · {student.phone ?? "sem telefone"}
            </p>
          </div>
        </div>
        <span className={statusBadge(student.studentStatus)}>
          {statusLabel(student.studentStatus)}
        </span>
      </div>

      <div className="dash-metrics-row">
        <div className="dash-metric-card">
          <div className="dash-metric-value" style={{ fontSize: "var(--text-lg)" }}>
            {student.activePlan?.name ?? "Sem plano"}
          </div>
          <div className="dash-metric-label">Plano ativo</div>
        </div>
        <div className="dash-metric-card">
          <div className="dash-metric-value" style={{ fontSize: "var(--text-lg)" }}>
            {timeLabel(student.lastAccessAt)}
          </div>
          <div className="dash-metric-label">Último acesso físico</div>
        </div>
      </div>

      {isBlocked ? (
        <div className="banner-error">
          Atenção: status do aluno exige revisão antes da entrada. Liberação só com exceção e motivo.
        </div>
      ) : (
        <div className="banner-success">
          Acesso operacional liberado para check-in manual.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <button className="btn btn-primary" onClick={onCheckin} disabled={loading || isBlocked}>
          Liberar entrada
        </button>
        <button className="btn btn-secondary" onClick={onException} disabled={loading}>
          Liberar com exceção
        </button>
        <button className="btn btn-ghost" onClick={onDeny} disabled={loading}>
          Registrar bloqueio
        </button>
        {onClear && (
          <button className="btn btn-ghost" onClick={onClear} disabled={loading}>
            Trocar aluno
          </button>
        )}
      </div>
    </div>
  );
}
