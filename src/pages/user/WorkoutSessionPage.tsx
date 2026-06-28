import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchMyWorkoutPlans,
  type UserWorkoutPlan,
  type UserWorkoutPlanDay,
  type UserWorkoutPlanItem,
} from "../../services/userWorkoutPlansApi";
import { getExercisesBatch, type Exercise } from "../../services/exercisesApi";
import { getWorkoutStats } from "../../services/workoutSessionApi";
import { useAdaptiveTraining } from "../../features/training/adaptive/useAdaptiveTraining";
import { ExerciseDemoModal } from "./components/ExerciseDemoModal";
import { registerWorkoutSession, type RegisterSessionStatus } from "./workoutSession/registerWorkoutSession";
import { useRestTimer } from "./workoutSession/useRestTimer";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type DraftExercise,
  type SessionDraft,
} from "./workoutSession/sessionDraft";
import { computeSessionComparison, deriveFatigueInsight } from "./workoutSession/sessionSummary";
import { WorkoutShareTrigger } from "./components/WorkoutShareTrigger";
import "./workoutSession/workoutSession.css";

// ── helpers de parsing (espelham o backend p/ contagem de séries / rest) ──
function parseSetCount(s?: string): number {
  if (!s) return 1;
  const t = String(s).trim();
  if (t.includes(",")) return Math.min(12, Math.max(1, t.split(",").length));
  const n = parseInt(t, 10);
  return Math.min(12, Math.max(1, Number.isFinite(n) ? n : 1));
}
function leadingInt(s?: string | null): number | null {
  if (s == null) return null;
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}
function parseNum(v: string): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function fmtClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function pickMediaUrl(ex: Exercise | undefined | null): string | null {
  if (!ex?.media?.length) return null;
  const gif = ex.media.find((m) => m.mediaType === "gif" || m.url.toLowerCase().includes(".gif"));
  const image = ex.media.find((m) => m.mediaType === "image");
  const primary = ex.media.find((m) => m.isPrimary) ?? ex.media[0];
  const chosen = gif ?? image ?? primary;
  return chosen && (chosen.mediaType === "gif" || chosen.mediaType === "image") ? chosen.url : null;
}

function buildExercises(items: UserWorkoutPlanItem[]): DraftExercise[] {
  return items.map((it) => {
    const count = parseSetCount(it.sets);
    const restS = leadingInt(it.rest);
    return {
      exerciseId: it.exerciseId ?? null,
      name: it.name,
      biSetGroupId: it.technique?.type === "bi_set" ? it.technique.biSetGroupId ?? null : null,
      sets: Array.from({ length: count }, (_, i) => ({
        setIndex: i + 1,
        plannedReps: it.reps,
        plannedRestS: restS,
        loadKg: "",
        reps: "",
        done: false,
        restDoneS: null,
        completedAt: null,
      })),
    };
  });
}

type Phase = "loading" | "empty" | "running" | "summary";

const RPE_OPTIONS = [
  { label: "Leve", rpe: 3 },
  { label: "Moderado", rpe: 6 },
  { label: "Intenso", rpe: 8 },
  { label: "Máximo", rpe: 10 },
];

export default function WorkoutSessionPage() {
  const navigate = useNavigate();
  const params = useParams();
  const planId = Number(params.planId);
  const dayIndex = Number(params.dayIndex);

  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<UserWorkoutPlan | null>(null);
  const [day, setDay] = useState<UserWorkoutPlanDay | null>(null);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [prevLoad, setPrevLoad] = useState<Map<string, number>>(new Map());
  const [exMedia, setExMedia] = useState<Map<string, string>>(new Map());
  const [demoName, setDemoName] = useState<string | null>(null);
  const [showExit, setShowExit] = useState(false);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [finishing, setFinishing] = useState(false);

  const adaptive = useAdaptiveTraining(true);
  const restCtx = useRef<{ exIdx: number; setIdx: number; planned: number; endsAt: number } | null>(null);
  const currentIndexRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  // Aplica itens adaptados quando o motor adaptou ESTE dia hoje (mesma regra da ficha).
  const resolvedItems = useMemo<UserWorkoutPlanItem[] | null>(() => {
    if (!day) return null;
    const ad = adaptive.data;
    if (ad?.adaptationEnabled && ad.changes.length && ad.adaptedPlanDay.index === day.index) {
      return ad.adaptedPlanDay.items as UserWorkoutPlanItem[];
    }
    return day.items ?? [];
  }, [day, adaptive.data]);

  // ── persistência do rascunho ──────────────────────────
  const persist = useCallback(
    (exs: DraftExercise[], idx: number, started: number) => {
      const ctx = restCtx.current;
      const draft: SessionDraft = {
        version: 1,
        planId,
        dayIndex,
        startedAt: started,
        currentIndex: idx,
        exercises: exs,
        restEndsAt: ctx?.endsAt ?? null,
        restForKey: ctx ? `${ctx.exIdx}:${ctx.setIdx}` : null,
      };
      saveDraft(draft);
    },
    [planId, dayIndex],
  );

  // grava restDoneS na série que disparou o descanso
  const finalizeRest = useCallback(
    (spent: number) => {
      const ctx = restCtx.current;
      restCtx.current = null;
      if (!ctx) return;
      setExercises((prev) => {
        const next = prev.map((ex, i) =>
          i === ctx.exIdx
            ? {
                ...ex,
                sets: ex.sets.map((s) => (s.setIndex === ctx.setIdx ? { ...s, restDoneS: spent } : s)),
              }
            : ex,
        );
        persist(next, currentIndexRef.current, startedAtRef.current);
        return next;
      });
    },
    [persist],
  );

  const rest = useRestTimer({ onComplete: () => finalizeRest(restCtx.current?.planned ?? 0) });

  // ── carga: busca plano + dia ──────────────────────────
  useEffect(() => {
    let alive = true;
    if (!Number.isFinite(planId) || !Number.isFinite(dayIndex)) {
      setPhase("empty");
      return;
    }
    fetchMyWorkoutPlans()
      .then((plans) => {
        if (!alive) return;
        const p = plans.find((x) => x.id === planId) ?? null;
        const d = p?.days?.find((x) => x.index === dayIndex) ?? null;
        setPlan(p);
        setDay(d);
        if (!p || !d || !(d.items?.length)) setPhase("empty");
      })
      .catch(() => alive && setPhase("empty"));
    return () => {
      alive = false;
    };
  }, [planId, dayIndex]);

  // ── monta sessão (retoma rascunho se houver) — espera adaptação resolver ──
  useEffect(() => {
    if (phase !== "loading" || !plan || !day || !resolvedItems) return;
    if (adaptive.loading) return; // aguarda p/ não montar com prescrito errado

    const fresh = buildExercises(resolvedItems);
    const draft = loadDraft(planId, dayIndex);
    if (draft && draft.exercises.length === fresh.length) {
      setExercises(draft.exercises);
      setCurrentIndex(Math.min(draft.currentIndex, draft.exercises.length - 1));
      setStartedAt(draft.startedAt);
      // retoma descanso ativo
      if (draft.restForKey && draft.restEndsAt && draft.restEndsAt > Date.now()) {
        const [exIdx, setIdx] = draft.restForKey.split(":").map(Number);
        const remaining = Math.round((draft.restEndsAt - Date.now()) / 1000);
        const planned = draft.exercises[exIdx]?.sets[setIdx - 1]?.plannedRestS ?? remaining;
        restCtx.current = { exIdx, setIdx, planned, endsAt: draft.restEndsAt };
        rest.start(remaining);
      }
    } else {
      setExercises(fresh);
    }
    setPhase("running");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plan, day, resolvedItems, adaptive.loading, planId, dayIndex]);

  // ── carga anterior + mídias (GIF) ─────────────────────
  useEffect(() => {
    let alive = true;
    getWorkoutStats().then((stats) => {
      if (!alive || !stats) return;
      const m = new Map<string, number>();
      for (const e of stats.exerciseProgression) m.set(e.exerciseId, e.lastLoadKg);
      setPrevLoad(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const ids = Array.from(new Set((resolvedItems ?? []).map((i) => i.exerciseId).filter(Boolean))) as string[];
    if (!ids.length) return;
    getExercisesBatch(ids)
      .then((rows) => {
        if (!alive) return;
        const m = new Map<string, string>();
        for (const ex of rows) {
          const url = pickMediaUrl(ex);
          if (url) m.set(ex.id, url);
        }
        setExMedia(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [resolvedItems]);

  const totalSets = useMemo(() => exercises.reduce((a, e) => a + e.sets.length, 0), [exercises]);
  const doneSets = useMemo(
    () => exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0),
    [exercises],
  );

  const current = exercises[currentIndex];
  const currentItem = (resolvedItems ?? [])[currentIndex];

  function updateSet(setIdx: number, patch: Partial<DraftExercise["sets"][number]>) {
    setExercises((prev) => {
      const next = prev.map((ex, i) =>
        i === currentIndex
          ? { ...ex, sets: ex.sets.map((s) => (s.setIndex === setIdx ? { ...s, ...patch } : s)) }
          : ex,
      );
      persist(next, currentIndex, startedAt);
      return next;
    });
  }

  function toggleDone(setIdx: number) {
    const ex = exercises[currentIndex];
    const set = ex?.sets.find((s) => s.setIndex === setIdx);
    if (!set) return;
    const becomingDone = !set.done;
    updateSet(setIdx, { done: becomingDone, completedAt: becomingDone ? Date.now() : null });

    if (becomingDone) {
      // Bi-Set roda em par, sem descanso entre os dois exercícios — não dispara timer.
      const planned = set.plannedRestS ?? 0;
      const isBiSet = !!ex.biSetGroupId;
      if (planned > 0 && !isBiSet) {
        restCtx.current = { exIdx: currentIndex, setIdx, planned, endsAt: Date.now() + planned * 1000 };
        rest.start(planned);
      }
    }
  }

  function goTo(idx: number) {
    const clamped = Math.max(0, Math.min(exercises.length - 1, idx));
    setCurrentIndex(clamped);
    persist(exercises, clamped, startedAt);
  }

  function buildSessionPayload(): { sets: unknown[]; status: RegisterSessionStatus } {
    const sets: unknown[] = [];
    exercises.forEach((ex, orderIndex) => {
      ex.sets.forEach((s) => {
        sets.push({
          exerciseId: ex.exerciseId,
          name: ex.name,
          orderIndex,
          setIndex: s.setIndex,
          plannedReps: s.plannedReps,
          repsDone: s.done ? parseNum(s.reps) ?? leadingInt(s.plannedReps) : null,
          plannedLoadKg: null,
          loadDoneKg: s.done ? parseNum(s.loadKg) : null,
          plannedRestS: s.plannedRestS,
          restDoneS: s.restDoneS,
          status: s.done ? "done" : "skipped",
        });
      });
    });
    const status: RegisterSessionStatus =
      doneSets === 0 ? "abandoned" : doneSets === totalSets ? "completed" : "partial";
    return { sets, status };
  }

  // resumo
  const volume = useMemo(() => {
    let v = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        if (!s.done) continue;
        const load = parseNum(s.loadKg);
        const reps = parseNum(s.reps) ?? leadingInt(s.plannedReps);
        if (load && reps) v += load * reps;
      }
    }
    return Math.round(v);
  }, [exercises]);
  const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const adherence = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;
  const sessionStatus: "completed" | "partial" | "abandoned" =
    doneSets === 0 ? "abandoned" : doneSets === totalSets ? "completed" : "partial";

  // Fase 4 — comparação carga hoje × anterior por exercício.
  const comparison = useMemo(() => computeSessionComparison(exercises, prevLoad), [exercises, prevLoad]);
  // Fase 5 — sinal de fadiga (readiness × queda de carga).
  const fatigue = useMemo(
    () =>
      deriveFatigueInsight({
        readiness: adaptive.data?.readiness?.level ?? null,
        comparison,
        status: sessionStatus,
      }),
    [adaptive.data, comparison, sessionStatus],
  );

  async function confirmFinish() {
    if (!plan || !day || finishing) return;
    setFinishing(true);
    const { sets, status } = buildSessionPayload();
    try {
      await registerWorkoutSession({
        planId: plan.id,
        planTitle: plan.title,
        selectedGroup: plan.selected_group,
        dayIndex: day.index,
        dayName: day.name,
        dayFocus: day.focus,
        prescribed: (resolvedItems ?? []).map((it) => ({
          exerciseId: it.exerciseId ?? null,
          name: it.name,
          sets: it.sets,
          reps: it.reps,
          rest: it.rest,
        })),
        sets,
        status,
        sessionRpe,
        notes: notes.trim() || null,
      });
    } catch {
      /* gamificação best-effort; segue mesmo assim */
    }
    clearDraft(planId, dayIndex);
    navigate("/app/user/ficha", { replace: true });
  }

  function discardAndExit() {
    rest.skip();
    clearDraft(planId, dayIndex);
    navigate("/app/user/ficha", { replace: true });
  }

  function exitKeepProgress() {
    if (rest.active) rest.pause();
    persist(exercises, currentIndex, startedAt);
    navigate("/app/user/ficha", { replace: true });
  }

  // ── render ────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="ws-root" style={{ display: "grid", placeItems: "center" }}>
        <div style={{ color: "var(--color-text-muted)" }}>Preparando seu treino…</div>
      </div>
    );
  }

  if (phase === "empty" || !plan || !day) {
    return (
      <div className="ws-root" style={{ display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Treino indisponível</div>
          <div style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
            Não encontramos os exercícios deste dia.
          </div>
          <button className="ws-btn ws-btn-primary" onClick={() => navigate("/app/user/ficha")}>
            Voltar para a ficha
          </button>
        </div>
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <div className="ws-root">
        <div className="ws-top">
          <div className="ws-top-row">
            <div>
              <div className="ws-title">Treino concluído</div>
              <div className="ws-sub">{plan.title} · {day.name}</div>
            </div>
          </div>
        </div>
        <div className="ws-body ws-summary">
          {fatigue ? (
            <div className={`ws-insight ws-insight-${fatigue.tone}`}>
              <div className="ws-insight-head">{fatigue.headline}</div>
              <div className="ws-insight-body">{fatigue.body}</div>
            </div>
          ) : null}

          <div className="ws-summary-grid">
            <div className="ws-stat">
              <div className="ws-stat-value">{durationMin} min</div>
              <div className="ws-stat-label">Duração</div>
            </div>
            <div className="ws-stat">
              <div className="ws-stat-value">{doneSets}/{totalSets}</div>
              <div className="ws-stat-label">Séries feitas</div>
            </div>
            <div className="ws-stat">
              <div className="ws-stat-value">{adherence}%</div>
              <div className="ws-stat-label">Aderência</div>
            </div>
            <div className="ws-stat">
              <div className="ws-stat-value">{volume > 0 ? `${volume} kg` : "—"}</div>
              <div className="ws-stat-label">Volume total</div>
            </div>
          </div>

          {comparison.items.length > 0 ? (
            <div className="ws-cmp">
              <div className="ws-cmp-title">Comparado à última vez</div>
              {comparison.items.map((it) => (
                <div className="ws-cmp-row" key={`${it.exerciseId ?? it.name}`}>
                  <span className="ws-cmp-name">{it.name}</span>
                  <span className="ws-cmp-load">
                    {it.dir === "new" ? (
                      <>{it.todayKg} kg <em>1ª vez</em></>
                    ) : (
                      <>
                        {it.prevKg} → {it.todayKg} kg{" "}
                        <em
                          className={
                            it.dir === "up" ? "ws-delta-up" : it.dir === "down" ? "ws-delta-down" : undefined
                          }
                        >
                          {it.dir === "equal"
                            ? "igual"
                            : `${(it.deltaKg ?? 0) > 0 ? "+" : ""}${it.deltaKg} kg`}
                        </em>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>
              Como foi o esforço? (opcional)
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {RPE_OPTIONS.map((o) => (
                <button
                  key={o.rpe}
                  type="button"
                  onClick={() => setSessionRpe(sessionRpe === o.rpe ? null : o.rpe)}
                  className="ws-rest-btn"
                  style={
                    sessionRpe === o.rpe
                      ? { flex: 1, background: "var(--color-primary-soft)", borderColor: "var(--color-primary)" }
                      : { flex: 1 }
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            className="ws-textarea"
            placeholder="Observação rápida (opcional): como você se sentiu, algum incômodo…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={280}
          />

          <div className="ws-actions">
            <button className="ws-btn ws-btn-primary" onClick={confirmFinish} disabled={finishing}>
              {finishing ? "Salvando…" : "Concluir e salvar"}
            </button>
            {/* ⚠️ Compartilhamento social (feature madura — ver docs/MATURE_FEATURES.md). */}
            {sessionStatus !== "abandoned" ? (
              <WorkoutShareTrigger
                focus={day.focus?.trim() || day.name}
                dayName={day.name}
                stats={{
                  durationMin,
                  doneSets,
                  totalSets,
                  completionPct: adherence,
                  volumeKg: volume > 0 ? volume : null,
                }}
              />
            ) : null}
            <button className="ws-btn ws-btn-ghost" onClick={() => setPhase("running")} disabled={finishing}>
              Voltar ao treino
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === "running"
  const restSoon = rest.active && rest.secondsLeft <= 10;
  const mediaUrl = current?.exerciseId ? exMedia.get(current.exerciseId) ?? null : null;
  const prev = current?.exerciseId ? prevLoad.get(current.exerciseId) ?? null : null;
  const allCurrentDone = current?.sets.every((s) => s.done) ?? false;
  const isLast = currentIndex >= exercises.length - 1;

  return (
    <div className="ws-root">
      <div className="ws-top">
        <div className="ws-top-row">
          <div style={{ minWidth: 0 }}>
            <div className="ws-title">{plan.title} · {day.name}</div>
            <div className="ws-sub">
              Exercício {currentIndex + 1}/{exercises.length} · {doneSets}/{totalSets} séries
            </div>
          </div>
          <button className="ws-icon-btn" aria-label="Sair" onClick={() => setShowExit(true)}>
            ×
          </button>
        </div>
        <div className="ws-progress-track">
          <div className="ws-progress-fill" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="ws-body">
        {current && (
          <div className="ws-ex-card">
            <div className="ws-ex-head">
              <button
                className="ws-thumb"
                onClick={() => setDemoName(current.name)}
                aria-label={`Ver demonstração de ${current.name}`}
              >
                {mediaUrl ? <img src={mediaUrl} alt={current.name} decoding="async" /> : null}
                <span className="ws-thumb-badge">ver</span>
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="ws-ex-name">{current.name}</div>
                <div className="ws-chips">
                  <span className="ws-chip">
                    {current.sets.length}×{currentItem?.reps ?? ""}
                  </span>
                  {current.sets[0]?.plannedRestS ? (
                    <span className="ws-chip">descanso {current.sets[0].plannedRestS}s</span>
                  ) : null}
                  {currentItem?.technique && currentItem.technique.type !== "none" ? (
                    <span className="ws-chip">
                      {currentItem.technique.type === "drop_set"
                        ? "Drop set"
                        : currentItem.technique.type === "rest_pause"
                          ? "Rest-pause"
                          : "Bi-set"}
                    </span>
                  ) : null}
                  {prev != null ? <span className="ws-chip ws-chip-prev">última: {prev} kg</span> : null}
                </div>
              </div>
            </div>

            <div className="ws-sets">
              {current.sets.map((s) => (
                <div key={s.setIndex} className={`ws-set-row${s.done ? " ws-set-done" : ""}`}>
                  <span className="ws-set-idx">{s.setIndex}</span>
                  <div className="ws-field">
                    <label>carga (kg)</label>
                    <input
                      className="ws-input"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder={prev != null ? String(prev) : "—"}
                      value={s.loadKg}
                      onChange={(e) => updateSet(s.setIndex, { loadKg: e.target.value })}
                      aria-label={`Carga série ${s.setIndex}`}
                    />
                  </div>
                  <div className="ws-field">
                    <label>reps</label>
                    <input
                      className="ws-input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder={s.plannedReps}
                      value={s.reps}
                      onChange={(e) => updateSet(s.setIndex, { reps: e.target.value })}
                      aria-label={`Repetições série ${s.setIndex}`}
                    />
                  </div>
                  <button
                    className={`ws-set-check${s.done ? " ws-checked" : ""}`}
                    onClick={() => toggleDone(s.setIndex)}
                    aria-label={s.done ? `Desmarcar série ${s.setIndex}` : `Concluir série ${s.setIndex}`}
                    aria-pressed={s.done}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ws-actions">
          {!isLast ? (
            <button className={`ws-btn ${allCurrentDone ? "ws-btn-primary" : "ws-btn-ghost"}`} onClick={() => goTo(currentIndex + 1)}>
              Próximo exercício →
            </button>
          ) : null}
          {currentIndex > 0 ? (
            <button className="ws-btn ws-btn-ghost" onClick={() => goTo(currentIndex - 1)}>
              ← Exercício anterior
            </button>
          ) : null}
          <button
            className={`ws-btn ${isLast || doneSets > 0 ? "ws-btn-primary" : "ws-btn-ghost"}`}
            onClick={() => setPhase("summary")}
          >
            Finalizar treino
          </button>
        </div>
      </div>

      {rest.active ? (
        <div className={`ws-rest${restSoon ? " ws-rest-soon" : ""}`}>
          <div>
            <div className="ws-rest-time">{fmtClock(rest.secondsLeft)}</div>
            <div className="ws-rest-label">{rest.running ? "Descanso" : "Pausado"}</div>
          </div>
          <div className="ws-rest-actions">
            <button className="ws-rest-btn" onClick={() => rest.add(15)}>+15s</button>
            <button className="ws-rest-btn" onClick={() => rest.add(30)}>+30s</button>
            <button className="ws-rest-btn" onClick={() => (rest.running ? rest.pause() : rest.resume())}>
              {rest.running ? "Pausar" : "Retomar"}
            </button>
            <button className="ws-rest-btn ws-rest-btn-skip" onClick={() => finalizeRest(rest.skip())}>
              Pular
            </button>
          </div>
        </div>
      ) : null}

      {demoName ? <ExerciseDemoModal key={demoName} name={demoName} onClose={() => setDemoName(null)} /> : null}

      {showExit ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(10,19,13,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}
          onClick={() => setShowExit(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px,100%)", background: "var(--color-surface)", borderRadius: 18, border: "1px solid var(--color-border)", padding: 18, display: "grid", gap: 10 }}
          >
            <div style={{ fontWeight: 700, fontSize: 17 }}>Sair do treino?</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Seu progresso fica salvo neste aparelho — você pode retomar de onde parou.
            </div>
            <button className="ws-btn ws-btn-ghost" onClick={() => setShowExit(false)}>Continuar treino</button>
            <button className="ws-btn ws-btn-ghost" onClick={exitKeepProgress}>Sair (salvar progresso)</button>
            <button
              className="ws-btn ws-btn-ghost"
              style={{ color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}
              onClick={discardAndExit}
            >
              Descartar treino
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
