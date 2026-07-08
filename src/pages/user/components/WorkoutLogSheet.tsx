import { useState, type CSSProperties } from "react";
import type { UserWorkoutPlanItem } from "../../../services/userWorkoutPlansApi";

// Folha de registro pós-treino (Spec 010, V1.1). Carga opcional por exercício,
// toggle feito/pulei (status derivado) e, no rodapé, esforço da sessão (RPE) +
// desconforto — sinais leves que alimentam recovery/readiness. Poucos toques:
// por padrão tudo "feito", basta confirmar.

export type SessionStatus = "completed" | "partial" | "abandoned";

export interface LoggedSet {
  exerciseId?: string | null;
  name: string;
  orderIndex: number;
  setIndex: number;
  plannedReps?: string;
  loadDoneKg?: number | null;
  plannedRestS?: number | null;
  rpe?: number | null;
  discomfort?: string | null;
  status: "done" | "skipped";
}

export interface LogResult {
  sets: LoggedSet[];
  status: SessionStatus;
  sessionRpe: number | null;
}

const RPE_OPTIONS: { label: string; rpe: number }[] = [
  { label: "Leve", rpe: 3 },
  { label: "Moderado", rpe: 6 },
  { label: "Intenso", rpe: 8 },
  { label: "Máximo", rpe: 10 },
];

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
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
  padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-border, #E5E7EB)",
};
const inputStyle: CSSProperties = {
  width: 60, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border-strong, #D1D5DB)",
  fontSize: 14, textAlign: "right",
};
const primaryBtn: CSSProperties = {
  flex: 1, padding: "12px 16px", borderRadius: 12, border: "none",
  background: "var(--action-primary, #5E7412)", color: "var(--color-cta-text, #fff)",
  fontWeight: 700, fontSize: 15, cursor: "pointer", minHeight: 44,
};
const ghostBtn: CSSProperties = {
  padding: "12px 16px", borderRadius: 12, border: "1px solid var(--color-border, #E5E7EB)",
  background: "transparent", color: "var(--color-text, #0A130D)", fontWeight: 600, cursor: "pointer", minHeight: 44,
};
const pill = (active: boolean): CSSProperties => ({
  flex: 1, padding: "7px 6px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  border: `1px solid ${active ? "var(--color-primary, #5E7412)" : "var(--color-border, #E5E7EB)"}`,
  background: active ? "var(--color-primary-soft, rgba(123,153,25,.12))" : "transparent",
  color: active ? "var(--color-text, #0A130D)" : "var(--color-text-muted, #6B7280)",
});

interface Props {
  items: UserWorkoutPlanItem[];
  onConfirm: (result: LogResult) => void;
  onClose: () => void;
}

export function WorkoutLogSheet({ items, onConfirm, onClose }: Props) {
  const [loads, setLoads] = useState<Record<number, string>>({});
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [discomfort, setDiscomfort] = useState(false);

  // Sem detalhe (nenhuma carga, nada pulado) → o CTA vira "Fiz todos os
  // exercícios" (1 toque). Só pede "Registrar treino" quando há ajuste manual.
  const customized =
    Object.values(loads).some((v) => v != null && v !== "") ||
    Object.values(skipped).some(Boolean);

  function build(): LogResult {
    const out: LoggedSet[] = [];
    let doneCount = 0;
    items.forEach((it, i) => {
      const isSkipped = !!skipped[i];
      if (!isSkipped) doneCount += 1;
      const raw = loads[i];
      const parsed = raw != null && raw !== "" ? Number(String(raw).replace(",", ".")) : null;
      const load = !isSkipped && parsed != null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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
          rpe: isSkipped ? null : sessionRpe,
          discomfort: !isSkipped && discomfort ? "dor/desconforto relatado" : null,
          status: isSkipped ? "skipped" : "done",
        });
      }
    });
    const status: SessionStatus = doneCount === 0 ? "abandoned" : doneCount === items.length ? "completed" : "partial";
    return { sets: out, status, sessionRpe };
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Registrar treino" style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--color-text, #0A130D)" }}>Como foi o treino?</div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted, #6B7280)" }}>
            Carga é opcional. Marque "pulei" se não fez algum exercício.
          </div>
        </div>

        <div style={{ display: "grid", gap: 8, maxHeight: "42vh", overflowY: "auto" }}>
          {items.map((it, i) => {
            const isSkipped = !!skipped[i];
            return (
              <div key={`${it.exerciseId}-${i}`} style={{ ...rowStyle, opacity: isSkipped ? 0.55 : 1 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text, #0A130D)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted, #6B7280)" }}>{it.sets} × {it.reps}</div>
                </div>
                {!isSkipped && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <input
                      type="number" inputMode="decimal" min={0} placeholder="—"
                      value={loads[i] ?? ""}
                      onChange={(e) => setLoads((p) => ({ ...p, [i]: e.target.value }))}
                      style={inputStyle}
                      aria-label={`Carga em kg para ${it.name}`}
                    />
                    <span style={{ fontSize: 12, color: "var(--color-text-muted, #6B7280)" }}>kg</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSkipped((p) => ({ ...p, [i]: !p[i] }))}
                  style={{
                    flexShrink: 0, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: `1px solid var(--color-border, #E5E7EB)`,
                    background: isSkipped ? "var(--color-warn, #D97706)" : "transparent",
                    color: isSkipped ? "#fff" : "var(--color-text-muted, #6B7280)",
                  }}
                >
                  {isSkipped ? "Pulei" : "Feito"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Esforço da sessão (RPE) — opcional */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted, #6B7280)" }}>Como foi o esforço? (opcional)</div>
          <div style={{ display: "flex", gap: 6 }}>
            {RPE_OPTIONS.map((o) => (
              <button key={o.rpe} type="button" onClick={() => setSessionRpe(sessionRpe === o.rpe ? null : o.rpe)} style={pill(sessionRpe === o.rpe)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desconforto — opcional */}
        <button
          type="button"
          onClick={() => setDiscomfort((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10,
            border: `1px solid ${discomfort ? "var(--color-warn, #D97706)" : "var(--color-border, #E5E7EB)"}`,
            background: discomfort ? "rgba(245,158,11,.10)" : "transparent", cursor: "pointer", textAlign: "left",
            color: "var(--color-text, #0A130D)", fontSize: 13, fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 16 }}>{discomfort ? "⚠️" : "＋"}</span>
          Senti dor ou desconforto durante o treino
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => onConfirm(build())} style={primaryBtn}>
            {customized ? "Registrar treino" : "Fiz todos os exercícios"}
          </button>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
