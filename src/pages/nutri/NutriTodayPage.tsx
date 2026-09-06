import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonStudentRow } from "../../components/feedback/Skeleton";
import { fetchPatients, type PatientSummary } from "../../services/nutriApi";
import { sortByPriority, type AttentionLevel } from "./lib/patientAttention";
import { NutriInviteDrawer } from "./NutriInviteDrawer";

const LEVEL_BADGE_CLASS: Record<AttentionLevel, string> = {
  "consent-revoked": "badge badge-neutral",
  "no-plan": "badge badge-warn",
  attention: "badge badge-danger",
  drop: "badge badge-danger",
  calibrating: "badge badge-info",
  stable: "badge badge-success",
};

/**
 * SPEC 037 / P2.1: home operacional. Responde em segundos "quem precisa da
 * minha atenção" consumindo só `fetchPatients()` — a MESMA Truth Layer da
 * carteira, via `patientAttention.ts`. Nenhum endpoint novo, nenhum score
 * paralelo.
 */
export default function NutriTodayPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    fetchPatients()
      .then(setPatients)
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="stack" style={{ padding: "var(--space-6) 0" }} aria-busy="true" aria-label="Carregando">
        <SkeletonStudentRow />
        <SkeletonStudentRow />
        <SkeletonStudentRow />
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div style={{ padding: "var(--space-6) 0" }}>
        <NutriInviteDrawer open={inviteOpen} onClose={() => setInviteOpen(false)} />
        <EmptyState
          title="Sua carteira está vazia"
          description="Convide seu primeiro paciente para começar o acompanhamento."
          action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>Convidar paciente</button>}
        />
      </div>
    );
  }

  const ranked = sortByPriority(patients);
  const needingAttention = ranked.filter((p) => p.attention.needsAttention);
  const calibrating = ranked.filter((p) => p.attention.level === "calibrating");
  const stable = ranked.filter((p) => p.attention.level === "stable");

  return (
    <div style={{ padding: "var(--space-6) 0" }}>
      <h1 className="page-title" style={{ margin: "0 0 var(--space-1)" }}>Hoje</h1>
      <p className="muted" style={{ margin: "0 0 var(--space-5)", fontSize: "var(--text-sm)" }}>
        {patients.length} paciente{patients.length !== 1 ? "s" : ""} ativo{patients.length !== 1 ? "s" : ""}
      </p>

      {/* Contadores — cada um é um filtro, não decoração (SPEC 037 §9). */}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
        <CounterCard label="Precisam de atenção" count={needingAttention.length} tone="danger" />
        <CounterCard label="Calibrando" count={calibrating.length} tone="info" />
        <CounterCard label="Estáveis" count={stable.length} tone="success" />
      </div>

      {needingAttention.length === 0 ? (
        <EmptyState
          variant="ok"
          title="Nenhum paciente precisa de atenção agora"
          description="Todos os pacientes ativos estão estáveis ou em calibração."
        />
      ) : (
        <div className="stack" style={{ gap: "var(--space-2)" }}>
          {needingAttention.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/app/nutri/pacientes/${p.id}`, { state: { patientName: p.name } })}
              style={{
                all: "unset",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--color-border)",
                cursor: "pointer",
                width: "100%",
                boxSizing: "border-box",
                minHeight: 44,
              }}
            >
              <span className="avatar-initials avatar-initials--md" aria-hidden="true">
                {(p.name?.charAt(0) ?? "?").toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: COLORS.text }}>
                    {p.name ?? `Paciente #${p.id}`}
                  </span>
                  <span className={LEVEL_BADGE_CLASS[p.attention.level]}>{p.attention.label}</span>
                </span>
                <span className="muted" style={{ display: "block", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
                  {p.attention.detail}
                </span>
              </span>
              <ChevronRight size={18} color={COLORS.muted} aria-hidden="true" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CounterCard({ label, count, tone }: { label: string; count: number; tone: "danger" | "info" | "success" }) {
  const color = tone === "danger" ? COLORS.dangerText : tone === "info" ? COLORS.infoText : COLORS.successText;
  return (
    <div className="card cardPad" style={{ flex: "1 1 160px", minWidth: 140 }}>
      <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{label}</div>
    </div>
  );
}
