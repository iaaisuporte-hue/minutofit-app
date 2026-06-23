import { useState, type CSSProperties } from "react";
import type { UserWorkoutPlanItem } from "../../../services/userWorkoutPlansApi";

// Folha de registro pós-treino (Spec 010, V1.1). Carga é OPCIONAL — o aluno
// registra em poucos toques (pode confirmar sem digitar nada). O que ele
// informar vira histórico de carga → progressão por exercício.

export interface LoggedSet {
  exerciseId?: string | null;
  name: string;
  orderIndex: number;
  setIndex: number;
  plannedReps?: string;
  loadDoneKg?: number | null;
  plannedRestS?: number | null;
  status: "done";
}

function setCount(s?: string): number {
  if (!s) return 1;
  const t = String(s).trim();
  if (t.includes(",")) return Math.min(12, Math.max(1, t.split(",").length));
  const n = parseInt(t, 10);
  return Math.min(12, Math.max(1, Number.isFinite(n) ? n : 1));
}
function leadingInt(s?: string): number | null {
  if (!s) return null;
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(10,19,13,.45)", zIndex: 1000,
  display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12,
};
const sheet: CSSProperties = {
  width: "min(560px, 100%)", background: "var(--color-surface, #fff)", borderRadius: 18,
  border: "1px solid var(--color-border, #E5E7EB)", boxShadow: "var(--shadow-lg)",
  padding: 18, display: "grid", gap: 12,
};
const rowStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-border, #E5E7EB)",
};
const inputStyle: CSSProperties = {
  width: 72, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border-strong, #D1D5DB)",
  fontSize: 14, textAlign: "right",
};
const primaryBtn: CSSProperties = {
  flex: 1, padding: "12px 16px", borderRadius: 12, border: "none",
  background: "var(--color-primary, #16A34A)", color: "var(--color-cta-text, #fff)",
  fontWeight: 700, fontSize: 15, cursor: "pointer", minHeight: 44,
};
const ghostBtn: CSSProperties = {
  padding: "12px 16px", borderRadius: 12, border: "1px solid var(--color-border, #E5E7EB)",
  background: "transparent", color: "var(--color-text, #0A130D)", fontWeight: 600, cursor: "pointer", minHeight: 44,
};

interface Props {
  items: UserWorkoutPlanItem[];
  onConfirm: (sets: LoggedSet[]) => void;
  onClose: () => void;
}

export function WorkoutLogSheet({ items, onConfirm, onClose }: Props) {
  const [loads, setLoads] = useState<Record<number, string>>({});

  function build(): LoggedSet[] {
    const out: LoggedSet[] = [];
    items.forEach((it, i) => {
      const raw = loads[i];
      const parsed = raw != null && raw !== "" ? Number(String(raw).replace(",", ".")) : null;
      const load = parsed != null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      const n = setCount(it.sets);
      for (let s = 1; s <= n; s++) {
        out.push({
          exerciseId: it.exerciseId ?? null,
          name: it.name,
          orderIndex: i,
          setIndex: s,
          plannedReps: it.reps,
          loadDoneKg: load,
          plannedRestS: leadingInt(it.rest),
          status: "done",
        });
      }
    });
    return out;
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Registrar treino" style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--color-text, #0A130D)" }}>Como foi o treino?</div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted, #6B7280)" }}>
            Carga é opcional — registre só o que quiser acompanhar a evolução.
          </div>
        </div>

        <div style={{ display: "grid", gap: 8, maxHeight: "50vh", overflowY: "auto" }}>
          {items.map((it, i) => (
            <div key={`${it.exerciseId}-${i}`} style={rowStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text, #0A130D)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted, #6B7280)" }}>
                  {it.sets} × {it.reps}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="—"
                  value={loads[i] ?? ""}
                  onChange={(e) => setLoads((p) => ({ ...p, [i]: e.target.value }))}
                  style={inputStyle}
                  aria-label={`Carga em kg para ${it.name}`}
                />
                <span style={{ fontSize: 12, color: "var(--color-text-muted, #6B7280)" }}>kg</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => onConfirm(build())} style={primaryBtn}>Registrar treino</button>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
