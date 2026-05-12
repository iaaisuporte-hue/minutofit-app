import { useEffect, useMemo, useState } from "react";
import { fetchMyWorkoutPlans, type UserWorkoutPlan } from "../../services/userWorkoutPlansApi";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

export default function MyWorkoutPlansPage() {
  const [plans, setPlans] = useState<UserWorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchMyWorkoutPlans(20);
        if (!cancelled) setPlans(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar fichas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestPlan = useMemo(() => plans[0] ?? null, [plans]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 18,
          background: COLORS.panel,
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text }}>Minha ficha de treino</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.5 }}>
          Aqui você acompanha as fichas enviadas pelo seu personal. A primeira da lista e a mais recente.
        </div>
      </div>

      {loading ? <div style={{ color: COLORS.muted }}>Carregando fichas...</div> : null}
      {error ? <div style={{ color: "#fca5a5" }}>{error}</div> : null}

      {!loading && !error && !plans.length ? (
        <EmptyState
          eyebrow="Sua ficha"
          title="Plano de treino em construção"
          description="Seu personal ainda não salvou uma ficha para você. Assim que o plano for criado, ele aparece aqui com todos os exercícios, séries e cargas."
        />
      ) : null}

      {latestPlan ? (
        <div
          style={{
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 14,
            background: COLORS.primarySoft,
            padding: 14,
            color: COLORS.text,
          }}
        >
          Ficha ativa: <b>{latestPlan.title}</b> • Atualizada em <b>{formatDate(latestPlan.updated_at)}</b>
        </div>
      ) : null}

      {plans.map((plan) => (
        <details
          key={plan.id}
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 14,
            background: COLORS.panel,
            padding: 12,
          }}
        >
          <summary style={{ cursor: "pointer", color: COLORS.text, fontWeight: 600 }}>
            {plan.title} • {plan.payload_json?.length || 0} exercicio(s)
          </summary>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>
              Preset semanal: <b style={{ color: COLORS.text }}>{plan.week_preset}</b> • Grupo:{" "}
              <b style={{ color: COLORS.text }}>{plan.selected_group || "Nao informado"}</b>
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>
              Criado em {formatDate(plan.created_at)} • Atualizado em {formatDate(plan.updated_at)}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {(plan.payload_json || []).map((item, idx) => (
                <div
                  key={`${plan.id}-${item.exerciseId}-${idx}`}
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    padding: "8px 10px",
                    color: COLORS.text,
                    fontSize: 13,
                  }}
                >
                  {idx + 1}. {item.name} — Series: {item.sets} • Reps: {item.reps} • Descanso: {item.rest}
                </div>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
