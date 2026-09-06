import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, NotebookPen } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import { SkeletonPanelCard } from "../../../components/feedback/Skeleton";
import {
  fetchClinicalProfile,
  fetchMealHeatmap,
  fetchPatientPlans,
  fetchPatientInsights,
  createObservation,
  OBJECTIVE_LABELS,
  DIETARY_KIND_LABELS,
  type ProfileItem,
  type NutritionPlan,
  type CanonicalAdherence,
  type NutriInsight,
  NutriApiError,
} from "../../../services/nutriApi";
import { ConsentRevokedNotice, formatDate } from "./shared";

type ResumoData = {
  plan: NutritionPlan | null;
  adherence: CanonicalAdherence | null;
  criticalItems: ProfileItem[];
  topInsight: NutriInsight | null;
};

const TREND_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus } as const;

// SPEC 037 / §21: itens "críticos" são restrições HARD de segurança —
// alergia, intolerância, restrição, condição clínica, medicamento. Preferência
// (like/avoid) é soft e fica só no CRUD completo (Acompanhamento).
const CRITICAL_KINDS = new Set(["allergy", "intolerance", "restriction", "clinical_condition", "medication"]);

/**
 * SPEC 037 / P2.4: consolida no ABRIR do paciente o que antes exigia visitar
 * Plano + Perfil + Adesão + Insights em sequência. Nenhum dado novo — os
 * MESMOS 4 fetches que essas abas já faziam, só que em paralelo. Zero
 * cálculo de risco/IA novo: adesão/tendência vêm do bloco canônico da P1A,
 * o "próximo insight" é o primeiro item que a rota `/insights` já devolvia.
 */
export function ResumoTab({ patientId, onNavigateTab }: { patientId: number; onNavigateTab: (tab: "plano" | "acompanhamento" | "historico") => void }) {
  const [data, setData] = useState<ResumoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentRevoked, setConsentRevoked] = useState(false);

  // SPEC 037 / P2.9: ação rápida — reusa o MESMO `createObservation` da aba
  // Observações (agora em Histórico). Nenhum segundo sistema de notas.
  const [obsOpen, setObsOpen] = useState(false);
  const [obsText, setObsText] = useState("");
  const [obsSaving, setObsSaving] = useState(false);
  const [obsSaved, setObsSaved] = useState(false);

  useEffect(() => {
    setConsentRevoked(false);
    Promise.all([
      fetchPatientPlans(patientId).then((r) => r.active).catch((err) => {
        if (err instanceof NutriApiError && err.consentRevoked) setConsentRevoked(true);
        return null;
      }),
      fetchMealHeatmap(patientId, 14).then((r) => r.adherence).catch(() => null),
      fetchClinicalProfile(patientId).then((r) => r.items.filter((i) => i.status === "active" && CRITICAL_KINDS.has(i.kind))).catch(() => []),
      fetchPatientInsights(patientId).then((r) => r[0] ?? null).catch(() => null),
    ]).then(([plan, adherence, criticalItems, topInsight]) => {
      setData({ plan, adherence, criticalItems, topInsight });
    }).finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <SkeletonPanelCard />;
  if (consentRevoked) return <ConsentRevokedNotice />;
  if (!data) return null;

  const { plan, adherence, criticalItems, topInsight } = data;
  const TrendIcon = adherence?.trend ? TREND_ICON[adherence.trend] : null;

  async function handleSaveObservation() {
    if (!obsText.trim() || obsSaving) return;
    setObsSaving(true);
    try {
      await createObservation(patientId, obsText.trim());
      setObsText("");
      setObsOpen(false);
      setObsSaved(true);
      setTimeout(() => setObsSaved(false), 3000);
    } finally {
      setObsSaving(false);
    }
  }

  return (
    <div className="stack">
      {/* Ação rápida */}
      <div className="card cardPad">
        {!obsOpen ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setObsOpen(true)}>
            <NotebookPen size={14} aria-hidden="true" /> Adicionar observação
          </button>
        ) : (
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <textarea
              className="input"
              rows={2}
              autoFocus
              placeholder="Observação rápida sobre este paciente..."
              value={obsText}
              onChange={(e) => setObsText(e.target.value)}
              style={{ resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button type="button" className="btn btn-primary btn-sm" disabled={!obsText.trim() || obsSaving} onClick={() => void handleSaveObservation()}>
                {obsSaving ? "Salvando..." : "Salvar"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setObsOpen(false); setObsText(""); }}>Cancelar</button>
            </div>
          </div>
        )}
        {obsSaved && <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-2)", color: COLORS.successText }}>Observação salva.</div>}
      </div>

      {/* Estado atual */}
      <div className="card cardPad">
        <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
          Estado atual
        </div>
        {adherence ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: COLORS.text, lineHeight: 1 }}>
                {adherence.adherenceState === "calibrating" ? "—" : `${adherence.adherencePct}%`}
              </div>
              <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>Adesão (14d)</div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{adherence.streakDays}</div>
              <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>Sequência (dias)</div>
            </div>
            {TrendIcon && adherence.trend && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: adherence.trend === "down" ? COLORS.dangerText : adherence.trend === "up" ? COLORS.successText : COLORS.muted }}>
                <TrendIcon size={16} aria-hidden="true" />
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                  {adherence.trend === "up" ? "Melhorando" : adherence.trend === "down" ? "Em queda" : "Estável"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Sem plano ativo — nenhum dado de adesão.</div>
        )}
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: "var(--space-3)" }} onClick={() => onNavigateTab("acompanhamento")}>
          Ver acompanhamento completo
        </button>
      </div>

      {/* Perfil clínico crítico */}
      {criticalItems.length > 0 && (
        <div className="card cardPad">
          <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
            Perfil clínico
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {criticalItems.map((item) => (
              <span key={item.id} className="badge badge-danger" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <AlertTriangle size={11} aria-hidden="true" />
                {DIETARY_KIND_LABELS[item.kind]}: {item.customLabel ?? item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Plano */}
      <div className="card cardPad">
        <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
          Plano
        </div>
        {plan ? (
          <>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text }}>{plan.title}</div>
            <div className="muted" style={{ fontSize: "var(--text-sm)", marginTop: 2 }}>
              {OBJECTIVE_LABELS[plan.objective]} · {plan.meals.length} refeições · desde {formatDate(plan.started_at)}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: "var(--space-3)" }} onClick={() => onNavigateTab("plano")}>
              Abrir plano
            </button>
          </>
        ) : (
          <>
            <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Nenhum plano ativo.</div>
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: "var(--space-3)" }} onClick={() => onNavigateTab("plano")}>
              Criar plano
            </button>
          </>
        )}
      </div>

      {/* Próxima atenção */}
      {topInsight && (
        <div className="card cardPad" style={{ borderLeft: "3px solid var(--color-warn)" }}>
          <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-2)" }}>
            Próxima atenção
          </div>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text }}>{topInsight.label}</div>
          <div className="muted" style={{ fontSize: "var(--text-sm)", marginTop: 2 }}>{topInsight.detail}</div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: "var(--space-3)" }} onClick={() => onNavigateTab("acompanhamento")}>
            Ver todos os insights
          </button>
        </div>
      )}
    </div>
  );
}
