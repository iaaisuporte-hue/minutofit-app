import { useEffect, useState } from "react";
import {
  searchReceptionStudents,
  type ReceptionStudent,
} from "../../../services/academyApi";
import { initials, statusBadge, statusLabel, timeLabel } from "./recepcaoUtils";

interface QuickStudentSearchProps {
  autoFocus?: boolean;
  placeholder?: string;
  onSelect: (student: ReceptionStudent) => void;
}

export function QuickStudentSearch({
  autoFocus,
  placeholder = "Buscar por nome, CPF, e-mail ou telefone...",
  onSelect,
}: QuickStudentSearchProps) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<ReceptionStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setStudents([]);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchReceptionStudents(trimmed)
        .then((rows) => {
          if (!cancelled) {
            setStudents(rows);
            setError("");
          }
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <div className="field" style={{ margin: 0 }}>
        <input
          autoFocus={autoFocus}
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          style={{ height: 52, fontSize: "var(--text-base)" }}
        />
        <span className="field-hint">
          Use CPF, nome, e-mail, telefone ou leitura de QR. A busca respeita o tenant ativo.
        </span>
      </div>

      {loading && <p className="small muted">Buscando aluno...</p>}
      {error && <p className="field-error">{error}</p>}

      {students.length > 0 && (
        <div className="section-card" style={{ padding: "var(--space-2)" }}>
          {students.map((student) => (
            <button
              key={student.userId}
              type="button"
              className="btn btn-ghost"
              onClick={() => onSelect(student)}
              style={{
                width: "100%",
                justifyContent: "space-between",
                padding: "var(--space-3)",
                textAlign: "left",
              }}
            >
              <span className="identity-row">
                {student.avatarUrl ? (
                  <img
                    src={student.avatarUrl}
                    alt={student.name}
                    style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <span className="avatar-initials avatar-initials--md">
                    {initials(student.name || student.email)}
                  </span>
                )}
                <span>
                  <span className="identity-row__name">{student.name || student.email}</span>
                  <span className="identity-row__sub">
                    {student.email} · último acesso: {timeLabel(student.lastAccessAt)}
                  </span>
                </span>
              </span>
              <span className={statusBadge(student.studentStatus)}>
                {statusLabel(student.studentStatus)}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !loading && students.length === 0 && !error && (
        <p className="small muted">Nenhum aluno encontrado neste tenant.</p>
      )}
    </div>
  );
}
