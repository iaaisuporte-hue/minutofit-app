import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchPersonalWorkoutPlans, reactivateWorkoutPlan, type PersonalWorkoutPlanRow } from "../../services/personalWorkoutApi";
import StudentProfileModal from "./StudentProfileModal";
import { Toast } from "../../features/team/Toast";
import { EmptyState } from "../../components/EmptyState";
import { ApplyFromLibraryDrawer } from "../../features/personalRetention/ApplyFromLibraryDrawer";
import { DuplicatePlanMenu } from "../../features/personalRetention/DuplicatePlanMenu";
import { StudentFightIntelCard } from "../../features/sport/components/StudentFightIntelCard";
import "./personalPremium.css";

type TabKey = "overview" | "workouts";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function StudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabKey>(searchParams.get("tab") === "workouts" ? "workouts" : "overview");
  const [plans, setPlans] = useState<PersonalWorkoutPlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [reactivatingPlanId, setReactivatingPlanId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [applyDrawerOpen, setApplyDrawerOpen] = useState(false);

  async function reloadPlans() {
    if (!studentId) return;
    setPlansLoading(true);
    try {
      const rows = await fetchPersonalWorkoutPlans(studentId, 50);
      setPlans(rows);
      setPlansError(null);
    } catch (e) {
      setPlans([]);
      setPlansError(e instanceof Error ? e.message : "Nao foi possivel carregar as fichas.");
    } finally {
      setPlansLoading(false);
    }
  }

  async function handleReactivate(plan: PersonalWorkoutPlanRow) {
    if (!studentId) return;
    setReactivatingPlanId(plan.id);
    try {
      await reactivateWorkoutPlan(studentId, plan.id);
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, abandoned_at: null } : p))
      );
      setToast({ message: `Ficha "${plan.title}" reativada.`, kind: "success" });
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Não foi possível reativar.",
        kind: "error",
      });
    } finally {
      setReactivatingPlanId(null);
    }
  }

  useEffect(() => {
    if (!studentId || tab !== "workouts") return;
    let cancelled = false;
    setPlansLoading(true);
    setPlansError(null);
    void (async () => {
      try {
        const rows = await fetchPersonalWorkoutPlans(studentId, 50);
        if (!cancelled) setPlans(rows);
      } catch (e) {
        if (!cancelled) {
          setPlans([]);
          setPlansError(e instanceof Error ? e.message : "Nao foi possivel carregar as fichas.");
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, tab]);

  if (!studentId) return null;

  return (
    <div className="pp-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button type="button" className="pp-btn pp-btn--ghost pp-btn--sm" onClick={() => navigate("/app/personal/students")}>
          Voltar
        </button>
        <span className="pp-kicker">Perfil do aluno</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" className={`pp-btn pp-btn--sm ${tab === "overview" ? "pp-btn--primary" : "pp-btn--ghost"}`} onClick={() => { setTab("overview"); setSearchParams({}); }}>
          Acompanhamento
        </button>
        <button type="button" className={`pp-btn pp-btn--sm ${tab === "workouts" ? "pp-btn--primary" : "pp-btn--ghost"}`} onClick={() => { setTab("workouts"); setSearchParams({ tab: "workouts" }); }}>
          Fichas
        </button>
      </div>

      {tab === "overview" ? (
        <>
          <StudentProfileModal
            studentId={studentId}
            studentName="Aluno"
            variant="inline"
            onClose={() => navigate(-1)}
          />
          <StudentFightIntelCard studentId={parseInt(studentId, 10)} />
        </>
      ) : (
        <section className="pp-panel">
          <div className="pp-panel__header">
            <div>
              <div className="pp-panel__title">Fichas atribuídas</div>
              <div className="pp-panel__subtitle">Veja o que o aluno enxerga e acompanhe a origem de cada ficha.</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="pp-btn pp-btn--primary" onClick={() => setApplyDrawerOpen(true)}>
                Aplicar da biblioteca
              </button>
              <button type="button" className="pp-btn pp-btn--ghost" onClick={() => navigate(`/app/personal/students/${studentId}/workouts/builder`)}>
                Criar do zero
              </button>
            </div>
          </div>
          <div className="pp-panel__body" style={{ display: "grid", gap: 12 }}>
            {plansLoading ? <div className="muted">Carregando fichas...</div> : null}
            {plansError ? <div className="muted">{plansError}</div> : null}
            {!plansLoading && !plansError && plans.length === 0 ? (
              <EmptyState
                eyebrow="Sem fichas atribuídas"
                title="Comece pelo caminho mais rápido"
                description="Aplique um protocolo pronto da sua biblioteca em 2 cliques ou monte uma ficha do zero no builder."
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <button type="button" className="pp-btn pp-btn--primary pp-btn--sm" onClick={() => setApplyDrawerOpen(true)}>
                      Aplicar da biblioteca
                    </button>
                    <button type="button" className="pp-btn pp-btn--ghost pp-btn--sm" onClick={() => navigate(`/app/personal/students/${studentId}/workouts/builder`)}>
                      Criar do zero
                    </button>
                  </div>
                }
                variant="info"
              />
            ) : null}
            {plans.map((plan) => {
              const abandoned = !!plan.abandoned_at;
              return (
                <div
                  className="card card-pad"
                  key={plan.id}
                  style={{
                    display: "grid",
                    gap: 10,
                    opacity: abandoned ? 0.85 : 1,
                    borderColor: abandoned ? "var(--color-warn-border)" : undefined,
                    background: abandoned ? "var(--color-warn-soft)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong>{plan.title}</strong>
                        {abandoned && (
                          <span className="pp-pill pp-pill--attention">Abandonada pelo aluno</span>
                        )}
                      </div>
                      <div className="small">
                        Frequência {plan.week_preset} · Atualizado em {formatDate(plan.updated_at)}
                        {abandoned && plan.abandoned_at ? ` · Abandono em ${formatDate(plan.abandoned_at)}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {abandoned && (
                        <button
                          type="button"
                          className="pp-btn pp-btn--sm"
                          disabled={reactivatingPlanId === plan.id}
                          onClick={() => void handleReactivate(plan)}
                        >
                          {reactivatingPlanId === plan.id ? "Reativando..." : "Reativar"}
                        </button>
                      )}
                      <button type="button" className="pp-btn pp-btn--sm" onClick={() => navigate(`/app/personal/students/${studentId}/workouts/builder?planId=${plan.id}${plan.source_protocol_id ? `&protocol=${plan.source_protocol_id}` : ""}`)}>
                        Editar no builder
                      </button>
                      {plan.source_protocol_id ? (
                        <button type="button" className="pp-btn pp-btn--ghost pp-btn--sm" onClick={() => navigate(`/app/personal/library?protocol=${plan.source_protocol_id}`)}>
                          Ver protocolo de origem
                        </button>
                      ) : null}
                      <DuplicatePlanMenu
                        plan={plan}
                        currentStudentId={studentId}
                        onSuccess={(message) => {
                          setToast({ message, kind: "success" });
                          void reloadPlans();
                        }}
                        onError={(message) => setToast({ message, kind: "error" })}
                      />
                    </div>
                  </div>
                  <div className="small">{plan.days.length} dia(s) estruturado(s)</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {toast && <Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />}
      {applyDrawerOpen && (
        <ApplyFromLibraryDrawer
          studentId={studentId}
          studentName="o aluno"
          onClose={() => setApplyDrawerOpen(false)}
          onApplied={(title) => {
            setToast({ message: `Ficha "${title}" aplicada.`, kind: "success" });
            void reloadPlans();
          }}
          onError={(message) => setToast({ message, kind: "error" })}
        />
      )}
    </div>
  );
}
