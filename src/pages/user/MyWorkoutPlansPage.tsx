import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchMyWorkoutPlans, type UserWorkoutPlan } from "../../services/userWorkoutPlansApi";
import { getExercisesBatch, type Exercise } from "../../services/exercisesApi";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PlanExerciseList({ plan }: { plan: UserWorkoutPlan }) {
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [mediaLoading, setMediaLoading] = useState(false);

  const uuids = useMemo(
    () =>
      (plan.payload_json ?? [])
        .map((item) => item.exerciseId)
        .filter((id) => id && UUID_RE.test(id)),
    [plan.payload_json]
  );

  useEffect(() => {
    if (!uuids.length) return;
    let cancelled = false;
    setMediaLoading(true);
    (async () => {
      try {
        const list = await getExercisesBatch(uuids);
        if (cancelled) return;
        const map: Record<string, Exercise> = {};
        for (const ex of list) map[ex.id] = ex;
        setExercises(map);
      } catch {
        // silent: show exercises without media
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uuids]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {mediaLoading ? (
        <div style={{ color: COLORS.muted, fontSize: 12 }}>Carregando detalhes...</div>
      ) : null}
      {(plan.payload_json ?? []).map((item, idx) => {
        const ex = item.exerciseId ? exercises[item.exerciseId] : null;
        const primaryMedia = ex?.media?.find((m) => m.isPrimary) ?? ex?.media?.[0];

        return (
          <div
            key={`${plan.id}-${item.exerciseId}-${idx}`}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: "10px 12px",
              color: COLORS.text,
              fontSize: 13,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {idx + 1}. {item.name}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>
              {item.sets} séries × {item.reps} reps • Descanso: {item.rest}
              {item.rpe ? ` • RPE ${item.rpe}` : ""}
            </div>
            {ex && (
              <div style={{ fontSize: 11, color: COLORS.muted }}>
                {ex.targetMuscle}
                {ex.equipment ? ` • ${ex.equipment}` : ""}
              </div>
            )}
            {primaryMedia?.mediaType === "youtube" && (
              <a
                href={primaryMedia.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: COLORS.primary, fontSize: 12, textDecoration: "none" }}
              >
                Ver demonstração
              </a>
            )}
            {item.notes && (
              <div
                style={{
                  background: COLORS.primarySoft,
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 11,
                  color: COLORS.text,
                }}
              >
                Personal: {item.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyWorkoutPlansPage() {
  const [plans, setPlans] = useState<UserWorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPlanId, setOpenPlanId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchMyWorkoutPlans(20);
        if (!cancelled) {
          setPlans(rows);
          if (rows.length > 0) setOpenPlanId(rows[0].id);
        }
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

  const togglePlan = useCallback((id: number) => {
    setOpenPlanId((prev) => (prev === id ? null : id));
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
          Fichas enviadas pelo seu personal. A primeira da lista é a mais recente.
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

      {latestPlan && (
        <div
          style={{
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 14,
            background: COLORS.primarySoft,
            padding: 14,
            color: COLORS.text,
          }}
        >
          Ficha ativa: <b>{latestPlan.title}</b> • Atualizada em{" "}
          <b>{formatDate(latestPlan.updated_at)}</b>
        </div>
      )}

      {plans.map((plan) => (
        <div
          key={plan.id}
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 14,
            background: COLORS.panel,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => togglePlan(plan.id)}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: COLORS.text,
              fontWeight: 600,
              fontSize: 14,
              textAlign: "left",
            }}
          >
            <span>
              {plan.title}
              <span style={{ fontWeight: 400, color: COLORS.muted, marginLeft: 8 }}>
                {plan.payload_json?.length || 0} exercício(s)
              </span>
            </span>
            <span style={{ color: COLORS.muted, fontSize: 18 }}>
              {openPlanId === plan.id ? "−" : "+"}
            </span>
          </button>

          {openPlanId === plan.id && (
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
                Preset: <b style={{ color: COLORS.text }}>{plan.week_preset}</b> • Grupo:{" "}
                <b style={{ color: COLORS.text }}>{plan.selected_group || "Não informado"}</b> •{" "}
                Atualizado em {formatDate(plan.updated_at)}
              </div>
              <PlanExerciseList plan={plan} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
