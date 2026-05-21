import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchMyWorkoutPlans, type UserWorkoutPlan, type UserWorkoutPlanDay, type UserWorkoutPlanItem } from "../../services/userWorkoutPlansApi";
import { getExercisesBatch, type Exercise } from "../../services/exercisesApi";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";
import { TechniqueCard } from "../../features/training/techniques/TechniqueCard";

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function frame1FromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("/0.jpg")) return url.replace("/0.jpg", "/1.jpg");
  return null;
}

function useThumbTick() {
  const [tick, setTick] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => !v), 700);
    return () => clearInterval(id);
  }, []);
  return tick;
}


type ExerciseModalProps = {
  exercise: Exercise;
  onClose: () => void;
};

function ExerciseGifModal({ exercise, onClose }: ExerciseModalProps) {
  const primary = exercise.media?.find((m) => m.isPrimary) ?? exercise.media?.[0];
  const gifMedia = exercise.media?.find((m) => m.mediaType === "gif" || m.mediaType === "image") ?? primary;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.panel,
          borderRadius: 16,
          padding: 20,
          maxWidth: 420,
          width: "100%",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>{exercise.name}</div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: COLORS.muted,
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {gifMedia && (gifMedia.mediaType === "gif" || gifMedia.mediaType === "image") ? (
          <img
            src={gifMedia.url}
            alt={exercise.name}
            style={{
              width: "100%",
              borderRadius: 10,
              objectFit: "contain",
              maxHeight: 300,
            }}
          />
        ) : null}
        <div style={{ fontSize: 12, color: COLORS.muted }}>
          {exercise.targetMuscle}
          {exercise.equipment ? ` · ${exercise.equipment}` : ""}
        </div>
        {exercise.instructions?.length ? (
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6 }}>
            {exercise.instructions.slice(0, 3).map((ins, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                {i + 1}. {ins}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type PlanDayExerciseListProps = {
  day: UserWorkoutPlanDay;
  planId: number;
};

function PlanDayExerciseList({ day, planId }: PlanDayExerciseListProps) {
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [mediaLoading, setMediaLoading] = useState(false);
  const [viewingExercise, setViewingExercise] = useState<Exercise | null>(null);
  const thumbTick = useThumbTick();

  const uuids = useMemo(
    () =>
      (day.items ?? [])
        .map((item) => item.exerciseId)
        .filter((id) => id && UUID_RE.test(id)),
    [day.items]
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
    <>
      {viewingExercise ? (
        <ExerciseGifModal exercise={viewingExercise} onClose={() => setViewingExercise(null)} />
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        {mediaLoading ? (
          <div style={{ color: COLORS.muted, fontSize: 12 }}>Carregando detalhes...</div>
        ) : null}
        {(day.items ?? []).map((item: UserWorkoutPlanItem, idx) => {
          const ex = item.exerciseId ? exercises[item.exerciseId] : null;
          let biSetPartnerName: string | null = null;
          if (item.technique?.type === "bi_set" && item.technique.biSetGroupId) {
            const groupId = item.technique.biSetGroupId;
            const partner = (day.items ?? []).find(
              (other) =>
                other.exerciseId !== item.exerciseId &&
                other.technique?.type === "bi_set" &&
                other.technique?.biSetGroupId === groupId
            );
            biSetPartnerName = partner?.name ?? null;
          }
          const primaryMedia = ex?.media?.find((m) => m.isPrimary) ?? ex?.media?.[0];
          const gifMedia = ex?.media?.find((m) => m.mediaType === "gif" || m.mediaType === "image") ?? primaryMedia;
          const hasGif = gifMedia && (gifMedia.mediaType === "gif" || gifMedia.mediaType === "image");
          const f1 = hasGif ? frame1FromUrl(gifMedia.url) : null;

          return (
            <div
              key={`${planId}-${item.exerciseId}-${idx}`}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: "10px 12px",
                color: COLORS.text,
                fontSize: 13,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              {/* GIF thumbnail */}
              {hasGif ? (
                <button
                  type="button"
                  onClick={() => ex && setViewingExercise(ex)}
                  title="Ver demonstração"
                  style={{
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: `1px solid ${COLORS.border}`,
                    position: "relative",
                    background: COLORS.panelDeep,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <img
                    src={gifMedia.url}
                    alt={ex?.name ?? item.name}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: f1 ? "opacity 0.3s ease" : undefined,
                      opacity: f1 ? (thumbTick ? 0 : 1) : 1,
                    }}
                  />
                  {f1 ? (
                    <img
                      src={f1}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "opacity 0.3s ease",
                        opacity: thumbTick ? 1 : 0,
                      }}
                    />
                  ) : null}
                </button>
              ) : (
                <div
                  style={{
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelDeep,
                    display: "grid",
                    placeItems: "center",
                    color: COLORS.muted,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 4v16M18 4v16M1 9h5M18 9h5M1 15h5M18 15h5" />
                  </svg>
                </div>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {idx + 1}. {item.name}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 12 }}>
                  {item.sets} séries × {item.reps} reps · Descanso: {item.rest}
                  {item.rpe ? ` · RPE ${item.rpe}` : ""}
                  {item.cadence ? ` · Cadência: ${item.cadence}` : ""}
                  {!item.technique && item.restPause ? " · Rest-pause" : ""}
                </div>
                {item.technique && item.technique.type !== "none" ? (
                  <TechniqueCard technique={item.technique} pairedWithName={biSetPartnerName} />
                ) : null}
                {ex ? (
                  <div style={{ fontSize: 11, color: COLORS.muted }}>
                    {ex.targetMuscle}
                    {ex.equipment ? ` · ${ex.equipment}` : ""}
                  </div>
                ) : null}
                {primaryMedia?.mediaType === "youtube" && (
                  <a
                    href={primaryMedia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: COLORS.primary, fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
                    </svg>
                    Ver no YouTube
                  </a>
                )}
                {item.notes ? (
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
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

type PlanCardProps = {
  plan: UserWorkoutPlan;
  isOpen: boolean;
  onToggle: () => void;
};

function PlanCard({ plan, isOpen, onToggle }: PlanCardProps) {
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const days = useMemo(() => {
    if (Array.isArray(plan.days) && plan.days.length > 0) return plan.days;
    // Legado: sintetiza dia único
    const legacyItems = Array.isArray(plan.payload_json) ? plan.payload_json : [];
    return [{ index: 1, name: "Único", focus: plan.selected_group ?? null, items: legacyItems }];
  }, [plan]);

  const isMultiDay = days.length > 1;
  const totalExercises = days.reduce((s, d) => s + (d.items?.length ?? 0), 0);

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 13px",
    border: "none",
    borderBottom: `2px solid ${active ? COLORS.primary : "transparent"}`,
    background: "none",
    color: active ? COLORS.text : COLORS.muted,
    fontWeight: active ? 700 : 500,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        background: COLORS.panel,
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
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
            {isMultiDay ? `${days.length} dias · ${totalExercises} exercício(s)` : `${totalExercises} exercício(s)`}
          </span>
        </span>
        <span style={{ color: COLORS.muted, fontSize: 18 }}>
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen ? (
        <div style={{ padding: "0 14px 14px" }}>
          {/* Plan meta */}
          <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
            Frequência: <b style={{ color: COLORS.text }}>{plan.week_preset}</b>
            {plan.selected_group ? (
              <> · Grupo: <b style={{ color: COLORS.text }}>{plan.selected_group}</b></>
            ) : null}
            {" · "}Atualizado em {formatDate(plan.updated_at)}
          </div>

          {/* Day tabs */}
          {isMultiDay ? (
            <div
              style={{
                display: "flex",
                overflowX: "auto",
                borderBottom: `1px solid ${COLORS.border}`,
                marginBottom: 12,
                gap: 0,
              }}
            >
              {days.map((day, idx) => (
                <button
                  key={day.name}
                  type="button"
                  style={tabBtn(activeDayIdx === idx)}
                  onClick={() => setActiveDayIdx(idx)}
                  title={day.focus ?? undefined}
                >
                  {day.name}
                  {day.focus ? (
                    <span style={{ display: "block", fontSize: 10, fontWeight: 400, opacity: 0.75 }}>
                      {day.focus}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <PlanDayExerciseList
            key={`${plan.id}-day-${activeDayIdx}`}
            day={days[activeDayIdx] ?? days[0]}
            planId={plan.id}
          />
        </div>
      ) : null}
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
      {error ? <div style={{ color: COLORS.danger }}>{error}</div> : null}

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
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 260px" }}>
            Ficha ativa: <b>{latestPlan.title}</b> · Atualizada em{" "}
            <b>{formatDate(latestPlan.updated_at)}</b>
          </div>
          <Link
            to="/app/user/today"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              background: "var(--gradient-primary)",
              color: "var(--color-white)",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Registrar treino no painel do dia →
          </Link>
        </div>
      ) : null}

      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isOpen={openPlanId === plan.id}
          onToggle={() => togglePlan(plan.id)}
        />
      ))}
    </div>
  );
}
