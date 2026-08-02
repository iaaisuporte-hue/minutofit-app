import { useMemo, useRef, useState } from "react";
import type { PersonalDashboardStudent } from "../../services/personalDashboardApi";

type Props = {
  students: PersonalDashboardStudent[];
  onSelect: (studentId: string, studentName: string) => void;
  placeholder?: string;
};

export default function PersonalQuickSearch({ students, onSelect, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return students.slice(0, 8);
    return students
      .filter((s) => s.name.toLowerCase().includes(needle) || s.id.includes(needle))
      .slice(0, 8);
  }, [q, students]);

  function handleBlur() {
    blurTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  function handleFocus() {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    setOpen(true);
  }

  return (
    <div className="pp-search-wrap">
      <div className="pp-search-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="11" cy="11" r="7" strokeWidth="2" />
          <path d="M20 20l-3-3" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          className="pp-search-input"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || "Buscar aluno por nome…"}
          autoComplete="off"
        />
      </div>
      {open && results.length > 0 ? (
        <div className="pp-search-results" role="listbox">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              className="pp-search-result"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(s.id, s.name);
                setQ("");
                setOpen(false);
              }}
            >
              <span className="pp-search-result__name">{s.name}</span>
              <span className="pp-search-result__meta">
                Frequência {s.adherencePct}% · {s.workouts7d} treinos/7d
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
