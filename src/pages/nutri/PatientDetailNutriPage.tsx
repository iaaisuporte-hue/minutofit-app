import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { COLORS } from "../../styles/colors";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  fetchPatientPlans,
  fetchAdherence,
  fetchPatientContext,
  fetchObservations,
  createObservation,
  endNutritionPlan,
  updateNutritionPlan,
  OBJECTIVE_LABELS,
  type NutriObjective,
  type NutritionPlan,
  type NutritionObservation,
  type Adherence,
} from "../../services/nutriApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("pt-BR");
}

function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: string[];
  active: string;
  onSelect: (t: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1.5px solid var(--color-border)",
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onSelect(t)}
          style={{
            background: "none",
            border: "none",
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: active === t ? 700 : 500,
            color: active === t ? COLORS.primary : COLORS.muted,
            cursor: "pointer",
            borderBottom: active === t ? `2px solid ${COLORS.primary}` : "2px solid transparent",
            marginBottom: -1.5,
            transition: "color 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Plano
// ---------------------------------------------------------------------------

type EditDraft = {
  title: string;
  objective: NutriObjective;
  general_notes: string;
  meals: Array<{ name: string; orientation: string; order_index: number }>;
};

function PlanTab({ patientId }: { patientId: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<{ active: NutritionPlan | null; history: NutritionPlan[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    fetchPatientPlans(patientId)
      .then((d) => setData(d as { active: NutritionPlan | null; history: NutritionPlan[] }))
      .finally(() => setLoading(false));
  }, [patientId]);

  function openEdit(plan: NutritionPlan) {
    setDraft({
      title: plan.title,
      objective: plan.objective,
      general_notes: plan.general_notes ?? "",
      meals: plan.meals?.map((m) => ({ name: m.name, orientation: m.orientation, order_index: m.order_index })) ?? [],
    });
    setEditing(true);
  }

  function updateMeal(idx: number, field: "name" | "orientation", value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const meals = prev.meals.map((m, i) => i === idx ? { ...m, [field]: value } : m);
      return { ...prev, meals };
    });
  }

  function addMeal() {
    setDraft((prev) => {
      if (!prev || prev.meals.length >= 6) return prev;
      return { ...prev, meals: [...prev.meals, { name: "", orientation: "", order_index: prev.meals.length }] };
    });
  }

  function removeMeal(idx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, meals: prev.meals.filter((_, i) => i !== idx).map((m, i) => ({ ...m, order_index: i })) };
    });
  }

  async function handleSaveEdit() {
    if (!draft || !data?.active) return;
    if (!draft.title.trim()) return;
    if (draft.meals.length === 0 || draft.meals.some((m) => !m.name.trim() || !m.orientation.trim())) return;
    setSaving(true);
    try {
      await updateNutritionPlan(patientId, data.active.id, draft);
      const refreshed = await fetchPatientPlans(patientId);
      setData(refreshed as { active: NutritionPlan | null; history: NutritionPlan[] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleEndPlan() {
    if (!data?.active) return;
    setEnding(true);
    try {
      await endNutritionPlan(patientId, data.active.id);
      const refreshed = await fetchPatientPlans(patientId);
      setData(refreshed as { active: NutritionPlan | null; history: NutritionPlan[] });
    } finally {
      setEnding(false);
      setConfirmEnd(false);
    }
  }

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>;

  const { active, history } = data ?? { active: null, history: [] };

  // ── Edit mode ──────────────────────────────────────────────────
  if (editing && draft && active) {
    const objectives: NutriObjective[] = ["weight_loss", "muscle_gain", "metabolic_health", "performance", "maintenance"];
    const canSave = draft.title.trim() && draft.meals.length > 0 && draft.meals.every((m) => m.name.trim() && m.orientation.trim());
    return (
      <div>
        <div className="card cardPad" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted, marginBottom: 12 }}>Editar plano</div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="edit-title">Título</label>
            <input id="edit-title" className="input" value={draft.title} onChange={(e) => setDraft((p) => p ? { ...p, title: e.target.value } : p)} />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="edit-objective">Objetivo</label>
            <select id="edit-objective" className="input" value={draft.objective} onChange={(e) => setDraft((p) => p ? { ...p, objective: e.target.value as NutriObjective } : p)}>
              {objectives.map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="edit-notes">Orientações gerais</label>
            <textarea id="edit-notes" className="input" rows={3} style={{ resize: "vertical" }} value={draft.general_notes} onChange={(e) => setDraft((p) => p ? { ...p, general_notes: e.target.value } : p)} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 10 }}>Refeições</div>
          {draft.meals.map((m, i) => (
            <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="Nome da refeição" value={m.name} onChange={(e) => updateMeal(i, "name", e.target.value)} style={{ flex: 1 }} />
                {draft.meals.length > 1 && (
                  <button type="button" onClick={() => removeMeal(i)} style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1 }}>×</button>
                )}
              </div>
              <textarea className="input" rows={2} placeholder="Orientações" value={m.orientation} onChange={(e) => updateMeal(i, "orientation", e.target.value)} style={{ resize: "vertical" }} />
            </div>
          ))}
          {draft.meals.length < 6 && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={addMeal}>+ Refeição</button>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={!canSave || saving} onClick={() => void handleSaveEdit()}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ConfirmDialog
        open={confirmEnd}
        title="Encerrar plano alimentar?"
        message="O aluno perderá acesso ao plano ativo imediatamente. Esta ação não pode ser desfeita."
        confirmLabel={ending ? "Encerrando..." : "Encerrar plano"}
        danger
        onConfirm={() => void handleEndPlan()}
        onCancel={() => setConfirmEnd(false)}
      />
      {active ? (
        <div>
          <div className="card cardPad" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Plano ativo
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{active.title}</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
              {OBJECTIVE_LABELS[active.objective]} · Desde {formatDate(active.started_at)}
            </div>

            {active.general_notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 4 }}>Orientações gerais</div>
                <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.55 }}>{active.general_notes}</div>
              </div>
            )}

            {active.meals?.map((m) => (
              <div key={m.id} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.55 }}>{m.orientation}</div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(active)}>Editar plano</button>
              <button
                type="button"
                onClick={() => navigate(`../plano/novo`, { relative: "path" })}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: `1.5px solid ${COLORS.primary}`,
                  background: "none",
                  color: COLORS.primary,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Criar plano
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: `1.5px solid ${COLORS.danger}`,
                  background: "none",
                  color: COLORS.danger,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Encerrar plano
              </button>
            </div>
          </div>

          {history.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted, marginBottom: 10 }}>
                Planos anteriores ({history.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="card cardPad"
                    style={{ padding: "10px 14px", fontSize: 13, color: COLORS.muted }}
                  >
                    <span style={{ color: COLORS.text, fontWeight: 600 }}>{h.title}</span>{" "}
                    ({formatDate(h.started_at)} – {h.ended_at ? formatDate(h.ended_at) : "em andamento"})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 15, color: COLORS.muted, marginBottom: 16 }}>Nenhum plano alimentar ativo.</div>
          <button
            type="button"
            onClick={() => navigate(`../plano/novo`, { relative: "path" })}
            style={{
              padding: "11px 24px",
              borderRadius: 10,
              border: "none",
              background: COLORS.primary,
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Criar plano alimentar
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Adesão
// ---------------------------------------------------------------------------

const ADHERENCE_ICON: Record<string, string> = { full: "✓", partial: "─", skipped: "○" };
const ADHERENCE_COLOR: Record<string, string> = {
  full: "var(--color-primary)",
  partial: "var(--color-warn)",
  skipped: "var(--color-danger)",
};

function AdherenceTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<{
    plan: { id: number; title: string } | null;
    checkins: Array<{ check_date: string; adherence: Adherence; note: string | null }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdherence(patientId, 7)
      .then(setData)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>;
  if (!data?.plan) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Sem plano ativo — nenhum dado de adesão.</div>;

  const fullCount = data.checkins.filter((c) => c.adherence === "full").length;
  const partialCount = data.checkins.filter((c) => c.adherence === "partial").length;
  const adherePct = Math.round(((fullCount + partialCount * 0.5) / 7) * 100);

  return (
    <div>
      <div className="card cardPad" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>
          Esta semana: {adherePct}% de adesão ({data.checkins.length}/7 dias)
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: "var(--color-surface-raised)",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${adherePct}%`,
              background: adherePct >= 70 ? COLORS.primary : adherePct >= 40 ? "var(--color-warn)" : COLORS.danger,
              borderRadius: 4,
              transition: "width 0.4s",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {data.checkins.map((c) => (
            <div key={c.check_date} style={{ textAlign: "center", minWidth: 44 }}>
              <div
                style={{
                  fontSize: 18,
                  color: ADHERENCE_COLOR[c.adherence] ?? COLORS.muted,
                  lineHeight: 1.3,
                }}
              >
                {ADHERENCE_ICON[c.adherence] ?? "○"}
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>
                {new Date(c.check_date).toLocaleDateString("pt-BR", { weekday: "short" })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 12 }}>
          Legenda: ✓ Seguiu · ─ Parcial · ○ Não seguiu / sem registro
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Contexto
// ---------------------------------------------------------------------------

function ContextTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<{
    hasMetabolicConsent: boolean;
    hasDailyConsent: boolean;
    metabolism?: { score?: number; trend?: string; updatedAt?: string } | null;
    dailyCheckins?: Array<{ check_date: string; energy_level?: number; sleep_quality?: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatientContext(patientId)
      .then((d) => setData(d as typeof data))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 14 }}>Carregando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Metabolic */}
      <div className="card cardPad">
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Metabolismo</div>
        {data?.hasMetabolicConsent && data.metabolism ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Score: {(data.metabolism as { score?: number }).score ?? "N/D"} ·{" "}
            Tendência: {(data.metabolism as { trend?: string }).trend ?? "N/D"}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            {data?.hasMetabolicConsent
              ? "Dados metabólicos indisponíveis."
              : "Painel metabólico indisponível — paciente ainda não concedeu acesso ao estado metabólico."}
          </div>
        )}
      </div>

      {/* Daily checkins */}
      <div className="card cardPad">
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Check-ins de bem-estar</div>
        {data?.hasDailyConsent && data.dailyCheckins ? (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            {data.dailyCheckins.length} registro(s) nos últimos 7 dias.
          </div>
        ) : (
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            O paciente ainda não concedeu acesso aos check-ins diários.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Observações
// ---------------------------------------------------------------------------

function ObservationsTab({ patientId }: { patientId: number }) {
  const [obs, setObs] = useState<NutritionObservation[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const LIMIT = 5;

  useEffect(() => {
    fetchObservations(patientId, LIMIT, offset).then(({ rows, total: t }) => {
      setObs((prev) => offset === 0 ? rows : [...prev, ...rows]);
      setTotal(t);
    });
  }, [patientId, offset]);

  async function handleSave() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createObservation(patientId, draft.trim());
      setDraft("");
      setOffset(0);
      const refreshed = await fetchObservations(patientId, LIMIT, 0);
      setObs(refreshed.rows);
      setTotal(refreshed.total);
    } catch {
      setSaveError("Não foi possível salvar a observação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Input */}
      <div className="card cardPad" style={{ marginBottom: 20 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Adicionar observação clínica..."
          rows={3}
          style={{
            width: "100%",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
            color: COLORS.text,
            background: "var(--color-surface)",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        {saveError && (
          <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{saveError}</div>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !draft.trim()}
          style={{
            marginTop: 10,
            padding: "9px 20px",
            borderRadius: 8,
            border: "none",
            background: COLORS.primary,
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: saving || !draft.trim() ? "not-allowed" : "pointer",
            opacity: saving || !draft.trim() ? 0.6 : 1,
          }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {obs.map((o) => (
          <div key={o.id} className="card cardPad" style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
              {new Date(o.created_at).toLocaleString("pt-BR")}
            </div>
            <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {o.body}
            </div>
          </div>
        ))}
      </div>

      {obs.length < total && (
        <button
          type="button"
          onClick={() => setOffset((prev) => prev + LIMIT)}
          style={{
            marginTop: 14,
            background: "none",
            border: "none",
            color: COLORS.primary,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Ver mais {total - obs.length} observações
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type TabName = "Plano" | "Adesão" | "Contexto" | "Observações";
const TABS: TabName[] = ["Plano", "Adesão", "Contexto", "Observações"];

export default function PatientDetailNutriPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabName>("Plano");

  const id = Number(patientId);
  if (!Number.isFinite(id)) return null;

  return (
    <div style={{ padding: "24px 0", maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => navigate("..", { relative: "path" })}
          style={{
            background: "none",
            border: "none",
            color: COLORS.muted,
            cursor: "pointer",
            fontSize: 20,
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Voltar"
        >
          ‹
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: 0 }}>
          Paciente #{id}
        </h1>
      </div>

      <TabBar tabs={TABS} active={tab} onSelect={(t) => setTab(t as TabName)} />

      {tab === "Plano" && <PlanTab patientId={id} />}
      {tab === "Adesão" && <AdherenceTab patientId={id} />}
      {tab === "Contexto" && <ContextTab patientId={id} />}
      {tab === "Observações" && <ObservationsTab patientId={id} />}
    </div>
  );
}
