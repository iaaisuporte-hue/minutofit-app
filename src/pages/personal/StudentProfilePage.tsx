import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchPersonalWorkoutPlans, type PersonalWorkoutPlanRow } from "../../services/personalWorkoutApi";
import StudentProfileModal from "./StudentProfileModal";
import "./personalPremium.css";

type TabKey = "overview" | "workouts";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function StudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("overview");
  const [plans, setPlans] = useState<PersonalWorkoutPlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

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
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate("/app/personal/students")}>
          Voltar
        </button>
        <span className="pp-kicker">Perfil do aluno</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" className={`btn btn-sm ${tab === "overview" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("overview")}>
          Acompanhamento
        </button>
        <button type="button" className={`btn btn-sm ${tab === "workouts" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("workouts")}>
          Fichas
        </button>
      </div>

      {tab === "overview" ? (
        <StudentProfileModal
          studentId={studentId}
          studentName="Aluno"
          variant="inline"
          onClose={() => navigate(-1)}
        />
      ) : (
        <section className="pp-panel">
          <div className="pp-panel__header">
            <div>
              <div className="pp-panel__title">Fichas atribuídas</div>
              <div className="pp-panel__subtitle">Veja o que o aluno enxerga e acompanhe a origem de cada ficha.</div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/app/personal/students/${studentId}/workouts/builder`)}>
              Atribuir nova ficha
            </button>
          </div>
          <div className="pp-panel__body" style={{ display: "grid", gap: 12 }}>
            {plansLoading ? <div className="muted">Carregando fichas...</div> : null}
            {plansError ? <div className="muted">{plansError}</div> : null}
            {!plansLoading && !plansError && plans.length === 0 ? (
              <div className="muted">As fichas atribuídas aparecerão aqui depois do primeiro plano salvo para este aluno.</div>
            ) : null}
            {plans.map((plan) => (
              <div className="card card-pad" key={plan.id} style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{plan.title}</strong>
                    <div className="small">Frequência {plan.week_preset} · Atualizado em {formatDate(plan.updated_at)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-sm" onClick={() => navigate(`/app/personal/students/${studentId}/workouts/builder${plan.source_protocol_id ? `?protocol=${plan.source_protocol_id}` : ""}`)}>
                      Editar no builder
                    </button>
                    {plan.source_protocol_id ? (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate(`/app/personal/library?protocol=${plan.source_protocol_id}`)}>
                        Ver protocolo de origem
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="small">{plan.days.length} dia(s) estruturado(s)</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
