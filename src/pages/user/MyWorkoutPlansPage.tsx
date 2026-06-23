import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchMyWorkoutPlans, abandonMyWorkoutPlan, type UserWorkoutPlan, type UserWorkoutPlanDay, type UserWorkoutPlanItem } from "../../services/userWorkoutPlansApi";
import { getExercisesBatch, type Exercise } from "../../services/exercisesApi";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";
import { TechniqueCard } from "../../features/training/techniques/TechniqueCard";
import { InfoHint } from "../../components/InfoHint";
import { ConfirmModal } from "../../features/team/ConfirmModal";
import { Toast } from "../../features/team/Toast";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import { addWorkoutHistoryEntry, type MuscleGroup } from "../user/workoutHistory";
import { canShareWorkoutImage } from "./lib/shareWorkoutImage";
import { ShareWorkoutModal } from "./components/ShareWorkoutModal";
import { useAdaptiveTraining } from "../../features/training/adaptive/useAdaptiveTraining";
import type { AdaptiveTodayResponse } from "../../services/trainingAdaptiveApi";
import { ReadinessPill } from "../../features/training/adaptive/ReadinessPill";
import { AdaptationBanner } from "../../features/training/adaptive/AdaptationBanner";

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

function isVisualExerciseMedia(media: Exercise["media"][number] | undefined | null) {
  return !!media && (media.mediaType === "gif" || media.mediaType === "image");
}

function getPreferredVisualMedia(exercise: Exercise | null | undefined) {
  const primary = exercise?.media?.find((m) => m.isPrimary) ?? exercise?.media?.[0];
  const gif = exercise?.media?.find((m) => m.mediaType === "gif" || m.url.toLowerCase().includes(".gif"));
  const image = exercise?.media?.find((m) => m.mediaType === "image");
  const preferred = gif ?? image ?? primary;
  return isVisualExerciseMedia(preferred) ? preferred : null;
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
  const gifMedia = getPreferredVisualMedia(exercise);
  const frame1 = frame1FromUrl(gifMedia?.url);
  const showFrame1 = useThumbTick();

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
        {gifMedia ? (
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1 / 1",
              maxHeight: 300,
              borderRadius: 10,
              overflow: "hidden",
              background: COLORS.panelDeep,
            }}
          >
            <img
              key={gifMedia.url}
              src={gifMedia.url}
              alt={exercise.name}
              decoding="async"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transition: frame1 ? "opacity 0.3s ease" : undefined,
                opacity: frame1 ? (showFrame1 ? 0 : 1) : 1,
              }}
            />
            {frame1 ? (
              <img
                src={frame1}
                alt=""
                aria-hidden="true"
                decoding="async"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transition: "opacity 0.3s ease",
                  opacity: showFrame1 ? 1 : 0,
                }}
              />
            ) : null}
          </div>
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

const MUSCLE_KEYWORD_MAP: Array<[RegExp, MuscleGroup]> = [
  [/peito|chest|peitoral/i, 'chest'],
  [/cost[as]|back|dorsal|lat[s]?/i, 'back'],
  [/perna|leg[s]?|glúteo|glute/i, 'legs'],
  [/ombro|shoulder/i, 'shoulders'],
  [/bra[çc]o|arm[s]?|bícep|bicep|trícep|tricep/i, 'arms'],
  [/core|abdômen|abdom|abs/i, 'core'],
  [/corpo inteiro|full.?body|geral|total/i, 'full_body'],
  [/cardio|aeró|aerob/i, 'cardio'],
  [/mobilidade|flexib|stretching/i, 'mobility'],
];

function deriveMuscleGroupsFromFocus(focus: string | null, selectedGroup: string | null): MuscleGroup[] {
  const text = focus ?? selectedGroup ?? '';
  if (!text) return ['full_body'];
  const found: MuscleGroup[] = [];
  for (const [pattern, group] of MUSCLE_KEYWORD_MAP) {
    if (pattern.test(text) && !found.includes(group)) found.push(group);
  }
  return found.length > 0 ? found : ['full_body'];
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
          const gifMedia = getPreferredVisualMedia(ex);
          const hasGif = !!gifMedia;
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
                <div style={{ color: COLORS.muted, fontSize: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
                  <span>{item.sets} séries × {item.reps} reps · Descanso: {item.rest}</span>
                  {item.rpe ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {" · "}Esforço {item.rpe}/10
                      <InfoHint
                        termo="Esforço (RPE)"
                        resumo="Escala de 1 a 10 para a intensidade percebida. 1 = muito fácil, 10 = esforço máximo."
                        impacto="Seu personal usa esse número para calibrar a carga sem precisar medir peso na hora."
                        saibaMaisHref="/app/user/glossario#rpe"
                      />
                    </span>
                  ) : null}
                  {item.cadence ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {" · "}Ritmo: {item.cadence}
                      <InfoHint
                        termo="Ritmo (cadência)"
                        resumo="Velocidade de execução, em segundos. Ex: 3-1-2 = 3s descida, 1s pausa, 2s subida."
                        impacto="Ritmo mais lento aumenta tensão no músculo. Mais rápido desenvolve potência."
                        saibaMaisHref="/app/user/glossario#cadencia"
                      />
                    </span>
                  ) : null}
                  {!item.technique && item.restPause ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {" · "}Pausa-descanso
                      <InfoHint
                        termo="Pausa-descanso"
                        resumo="Faz algumas reps, descansa 10-15 segundos e continua sem trocar o peso."
                        impacto="Permite mais volume com cargas pesadas. Indicado para quem já tem experiência."
                        saibaMaisHref="/app/user/glossario#pausa-descanso"
                      />
                    </span>
                  ) : null}
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
  onAbandon: () => void;
  adaptiveData?: AdaptiveTodayResponse | null;
};

function PlanCard({ plan, isOpen, onToggle, onAbandon, adaptiveData }: PlanCardProps) {
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredToday, setRegisteredToday] = useState(false);
  const [registrationStreak, setRegistrationStreak] = useState<number | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Capacidade de compartilhar imagem = ≈ mobile (desktop não compartilha arquivo).
  const canShare = useMemo(() => canShareWorkoutImage(), []);

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

  const activeDay = days[activeDayIdx] ?? days[0];
  const hasExercises = (activeDay?.items?.length ?? 0) > 0;

  // Inject adapted items when this day matches what the engine adapted today
  const displayDay = useMemo<UserWorkoutPlanDay>(() => {
    if (!adaptiveData?.adaptationEnabled || !adaptiveData.changes.length) return activeDay;
    if (activeDay?.index !== adaptiveData.adaptedPlanDay.index) return activeDay;
    return { ...activeDay, items: adaptiveData.adaptedPlanDay.items as UserWorkoutPlanItem[] };
  }, [activeDay, adaptiveData]);
  const isAdaptedDay = displayDay !== activeDay;

  async function handleCompleteSession() {
    if (isRegistering || registeredToday) return;
    setIsRegistering(true);
    setRegistrationError(null);

    const dayLabel = activeDay?.name ?? 'Sessão';
    const workoutId = `plan-${plan.id}-day-${activeDay?.index ?? activeDayIdx + 1}-${Date.now()}`;
    const title = `${plan.title} · ${dayLabel}`;
    const muscleGroups = deriveMuscleGroupsFromFocus(activeDay?.focus ?? null, plan.selected_group);

    addWorkoutHistoryEntry({
      workoutId,
      title,
      muscleGroups,
      date: new Date().toISOString(),
    });

    try {
      const result = await persistGamificationCheckin({
        source: 'workout',
        xp: 30,
        workout: { workoutId, title, muscleGroups },
      });
      setRegisteredToday(true);
      setRegistrationStreak(result?.streak ?? null);
      const streakText = result?.streak ? `${result.streak} dias seguidos cuidando do seu corpo` : '';
      const parts = ['Sessão registrada — sua leitura foi atualizada', streakText].filter(Boolean);
      setSuccessToast(parts.join(' · '));
    } catch {
      setRegistrationError('Não foi possível registrar.');
    } finally {
      setIsRegistering(false);
    }
  }

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

          {isAdaptedDay && adaptiveData?.readiness && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>
                <ReadinessPill readiness={adaptiveData.readiness} />
              </div>
              <AdaptationBanner
                changes={adaptiveData.changes}
                recoverySuggestion={adaptiveData.recoverySuggestion}
                exerciseNames={Object.fromEntries(
                  adaptiveData.adaptedPlanDay.items.map(i => [i.exerciseId, i.name])
                )}
              />
            </div>
          )}

          <PlanDayExerciseList
            key={`${plan.id}-day-${activeDayIdx}`}
            day={displayDay}
            planId={plan.id}
          />

          {hasExercises && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={() => void handleCompleteSession()}
                disabled={isRegistering || registeredToday}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  minHeight: 48,
                  borderRadius: 12,
                  border: 'none',
                  background: registeredToday ? 'var(--color-success)' : COLORS.primary,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: isRegistering ? 'not-allowed' : registeredToday ? 'default' : 'pointer',
                  opacity: isRegistering ? 0.75 : 1,
                  transition: 'background 0.2s, opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isRegistering && (
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                )}
                {registeredToday && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                {registeredToday
                  ? `Sessão registrada${registrationStreak ? ` · ${registrationStreak} dias` : ''}`
                  : isRegistering
                    ? 'Registrando...'
                    : 'Concluir sessão de hoje'
                }
              </button>

              {/* Compartilhar a conquista (mobile): foto de fundo + foco + marca */}
              {registeredToday && canShare && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  style={{
                    width: '100%',
                    marginTop: 8,
                    padding: '11px 16px',
                    minHeight: 44,
                    borderRadius: 12,
                    border: `1px solid ${COLORS.border}`,
                    background: 'transparent',
                    color: COLORS.text,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Compartilhar treino
                </button>
              )}

              {shareOpen && (
                <ShareWorkoutModal
                  focus={displayDay.focus?.trim() || displayDay.name}
                  dayName={displayDay.name}
                  onClose={() => setShareOpen(false)}
                />
              )}

              {registrationError && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: COLORS.danger, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {registrationError}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRegistrationError(null); void handleCompleteSession(); }}
                    style={{
                      marginTop: 6,
                      padding: '5px 12px',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      background: 'transparent',
                      color: COLORS.muted,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Rodapé com ação "Abandonar ficha" */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${COLORS.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 11, color: COLORS.mutedSoft, lineHeight: 1.5 }}>
              Não vai usar esta ficha agora? Você pode abandoná-la — ela some daqui,
              mas só o seu personal pode reativar ou excluir.
            </div>
            <button
              type="button"
              onClick={onAbandon}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: "transparent",
                color: COLORS.muted,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Abandonar ficha
            </button>
          </div>
        </div>
      ) : null}
    {successToast && (
      <Toast message={successToast} kind="success" onDismiss={() => setSuccessToast(null)} />
    )}
    </div>
  );
}

export default function MyWorkoutPlansPage() {
  const [plans, setPlans] = useState<UserWorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPlanId, setOpenPlanId] = useState<number | null>(null);
  const [abandonTarget, setAbandonTarget] = useState<UserWorkoutPlan | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const adaptive = useAdaptiveTraining(!loading && plans.length > 0);

  const handleAbandonConfirmed = useCallback(async () => {
    if (!abandonTarget) return;
    setAbandoning(true);
    try {
      await abandonMyWorkoutPlan(abandonTarget.id);
      setPlans((prev) => prev.filter((p) => p.id !== abandonTarget.id));
      setToast({ message: `Ficha "${abandonTarget.title}" abandonada.`, kind: "success" });
      setAbandonTarget(null);
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Não foi possível abandonar a ficha.",
        kind: "error",
      });
    } finally {
      setAbandoning(false);
    }
  }, [abandonTarget]);

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.text }}>Minha ficha</div>
        <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>— fichas do seu personal</div>
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
            border: `1px solid ${COLORS.primaryBorder}`,
            borderRadius: 10,
            background: COLORS.primarySoft,
            padding: "8px 12px",
            color: COLORS.text,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 0", fontSize: 12, color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600, color: COLORS.text }}>{latestPlan.title}</span>
          </div>
          <Link
            to="/app/user/today"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 8,
              background: "var(--gradient-primary)",
              color: "var(--color-white)",
              fontWeight: 600,
              fontSize: 12,
              textDecoration: "none",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            Registrar no painel do dia →
          </Link>
        </div>
      ) : null}

      {plans.map((plan, idx) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isOpen={openPlanId === plan.id}
          onToggle={() => togglePlan(plan.id)}
          onAbandon={() => setAbandonTarget(plan)}
          adaptiveData={idx === 0 ? adaptive.data : undefined}
        />
      ))}

      {abandonTarget && (
        <ConfirmModal
          title={`Abandonar "${abandonTarget.title}"?`}
          description="A ficha some da sua lista, mas continua existindo. Só o seu personal pode reativar ou excluir. Tem certeza?"
          confirmLabel="Sim, abandonar"
          cancelLabel="Não"
          destructive
          loading={abandoning}
          onConfirm={() => void handleAbandonConfirmed()}
          onCancel={() => setAbandonTarget(null)}
        />
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />}
    </div>
  );
}
