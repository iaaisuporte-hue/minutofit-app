import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search, Plus } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonStudentRow } from "../../components/feedback/Skeleton";
import { fetchPatients, type PatientSummary } from "../../services/nutriApi";
import { derivePatientAttention, sortByPriority, type AttentionLevel } from "./lib/patientAttention";
import { NutriInviteDrawer } from "./NutriInviteDrawer";

type FilterId = "all" | AttentionLevel;

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "attention", label: "Atenção" },
  { id: "drop", label: "Em queda" },
  { id: "calibrating", label: "Calibrando" },
  { id: "stable", label: "Estáveis" },
  { id: "no-plan", label: "Sem plano" },
];

type SortId = "priority" | "name" | "last-activity" | "adherence";

const SORT_OPTIONS: Array<{ id: SortId; label: string }> = [
  { id: "priority", label: "Prioridade" },
  { id: "name", label: "Nome" },
  { id: "last-activity", label: "Última atividade" },
  { id: "adherence", label: "Adesão" },
];

const LEVEL_BADGE_CLASS: Record<AttentionLevel, string> = {
  "consent-revoked": "badge badge-neutral",
  "no-plan": "badge badge-warn",
  attention: "badge badge-danger",
  drop: "badge badge-danger",
  calibrating: "badge badge-info",
  stable: "badge badge-success",
};

function matchesFilter(level: AttentionLevel, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "attention") return level === "attention" || level === "consent-revoked";
  return level === filter;
}

export default function NutritionPatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("priority");
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    fetchPatients()
      .then(setPatients)
      .catch(() => setError("Não foi possível carregar os pacientes."))
      .finally(() => setLoading(false));
  }, []);

  // SPEC 037 / P2.2: mesma escala do padrão já usado na carteira do Personal
  // (`StudentsListPage.tsx`) — fetch único, filtro/busca 100% client-side.
  // Carteira de um nutri não tem volume que justifique busca no servidor.
  const withAttention = useMemo(() => patients.map((p) => ({ ...p, attention: derivePatientAttention(p) })), [patients]);

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: withAttention.length, attention: 0, drop: 0, calibrating: 0, stable: 0, "no-plan": 0, "consent-revoked": 0 };
    for (const p of withAttention) {
      c[p.attention.level] = (c[p.attention.level] ?? 0) + 1;
      if (p.attention.level === "consent-revoked") c.attention += 1;
    }
    return c;
  }, [withAttention]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = withAttention.filter((p) => {
      if (!matchesFilter(p.attention.level, filter)) return false;
      if (!q) return true;
      return (p.name?.toLowerCase().includes(q) ?? false) || (p.email?.toLowerCase().includes(q) ?? false);
    });

    if (sort === "priority") {
      list = sortByPriority(list);
    } else if (sort === "name") {
      list = [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"));
    } else if (sort === "last-activity") {
      list = [...list].sort((a, b) => {
        if (!a.lastCheckinDate && !b.lastCheckinDate) return 0;
        if (!a.lastCheckinDate) return 1;
        if (!b.lastCheckinDate) return -1;
        return b.lastCheckinDate.localeCompare(a.lastCheckinDate);
      });
    } else if (sort === "adherence") {
      list = [...list].sort((a, b) => (b.mealAdherence7dPct ?? -1) - (a.mealAdherence7dPct ?? -1));
    }
    return list;
  }, [withAttention, query, filter, sort]);

  if (loading) {
    return (
      <div className="stack" style={{ padding: "var(--space-6) 0" }} aria-busy="true" aria-label="Carregando pacientes">
        <SkeletonStudentRow />
        <SkeletonStudentRow />
        <SkeletonStudentRow />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "var(--space-6) 0" }}>
        <div className="card cardPad alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6) 0" }}>
      <NutriInviteDrawer open={inviteOpen} onClose={() => setInviteOpen(false)} onInviteCreated={() => fetchPatients().then(setPatients).catch(() => {})} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Pacientes
          <span className="muted" style={{ fontWeight: 400, fontSize: "var(--text-lg)", marginLeft: "var(--space-2)" }}>
            ({patients.length} ativo{patients.length !== 1 ? "s" : ""})
          </span>
        </h1>
        {patients.length > 0 && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
            <Plus size={14} aria-hidden="true" /> Convidar paciente
          </button>
        )}
      </div>

      {patients.length === 0 ? (
        <EmptyState
          title="Nenhum paciente vinculado"
          description="Convide seu primeiro paciente para começar o acompanhamento nutricional."
          action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>Convidar paciente</button>}
        />
      ) : (
        <>
          {/* Busca + ordenação */}
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
            <div className="field" style={{ flex: "1 1 220px", gap: 0 }}>
              <div style={{ position: "relative" }}>
                <Search size={15} aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }} />
                <input
                  className="input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Buscar por nome ou e-mail..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar paciente"
                />
              </div>
            </div>
            <select
              className="input"
              style={{ width: "auto", flexShrink: 0 }}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              aria-label="Ordenar por"
            >
              {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>Ordenar: {o.label}</option>)}
            </select>
          </div>

          {/* Filtros */}
          <div role="toolbar" aria-label="Filtrar pacientes" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className="btn btn-sm"
                style={filter === f.id
                  ? { background: "var(--color-primary-soft)", borderColor: "var(--color-primary)", color: COLORS.primary }
                  : undefined}
              >
                {f.label} {counts[f.id] > 0 && <span className="muted" style={{ marginLeft: 4 }}>{counts[f.id]}</span>}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState variant="info" title="Nenhum paciente encontrado" description="Ajuste a busca ou o filtro selecionado." />
          ) : (
            <div className="stack" style={{ gap: "var(--space-2)" }}>
              {visible.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`${p.id}`, { state: { patientName: p.name } })}
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
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : (
                      (p.name?.charAt(0) ?? "?").toUpperCase()
                    )}
                  </span>

                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: p.attention.level === "consent-revoked" ? COLORS.muted : COLORS.text }}>
                        {p.attention.level === "consent-revoked" ? "Acesso revogado pelo paciente" : (p.name ?? `Paciente #${p.id}`)}
                      </span>
                      {p.attention.level !== "stable" && (
                        <span className={LEVEL_BADGE_CLASS[p.attention.level]}>{p.attention.label}</span>
                      )}
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
        </>
      )}
    </div>
  );
}
