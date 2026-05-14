import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchPersonalDashboard } from "../../services/personalDashboardApi";
import type { PersonalDashboardStudent } from "../../services/personalDashboardApi";
import { createPersonalWorkoutPlan, fetchPersonalWorkoutPlans } from "../../services/personalWorkoutApi";
import { searchExercises, exerciseSummaryToCatalogEntry } from "../../services/exercisesApi";
import {
  createWorkoutProtocol,
  fetchProtocolSuggestions,
  fetchWorkoutProtocolById,
  type ProtocolSuggestion,
  type WorkoutProtocol,
} from "../../services/workoutProtocolsApi";
import { generateWorkoutWithAi, type AiGeneratedExercise, type AiGeneratedWeeklyPlan } from "../../services/aiWorkoutApi";
import {
  FeedbackBanner,
  IconArrowDown,
  IconArrowUp,
  pillStyle,
  WbButton,
  WbCard,
} from "./workoutBuilder/WorkoutBuilderUi";
import { WB } from "./workoutBuilder/workoutBuilderTheme";
import "./personalPremium.css";

const BUILDER_BASE = "/app/personal/students";

type Plan = "basic" | "silver" | "gold" | "black";
type Gender = "M" | "F";

type Student = {
  id: string;
  name: string;
  plan: Plan;
  gender: Gender | null;
};

type MuscleGroup =
  | "Perna"
  | "Peito"
  | "Costas"
  | "Ombro"
  | "Bíceps"
  | "Tríceps"
  | "Abdômen"
  | "Glúteo"
  | "Cardio"
  | "Outros";

type Exercise = {
  id: string;
  name: string;
  group: MuscleGroup;
  videoUrl?: string;
  source: "seed" | "video" | "metacore";
  bodyPart?: string;
  equipment?: string;
  primaryMediaUrl?: string | null;
};

type WorkoutExercise = {
  exerciseId: string;
  name: string;
  sets: string;
  reps: string;
  rest: string;
  rpe?: string;
  cadence?: string;
  restPause?: boolean;
  notes?: string;
};

const RPE_REGEX = /^([0-9]|10)(-([0-9]|10))?$/;
const CADENCE_REGEX = /^\d-\d-\d-\d$/;

const KNOWN_GROUPS: MuscleGroup[] = [
  "Perna", "Peito", "Costas", "Ombro", "Bíceps", "Tríceps", "Abdômen", "Glúteo", "Cardio", "Outros",
];

const CATALOG_GROUPS: MuscleGroup[] = [
  "Perna", "Peito", "Costas", "Ombro", "Bíceps", "Tríceps", "Abdômen", "Glúteo", "Cardio",
];

function catalogEntryToExercise(e: ReturnType<typeof exerciseSummaryToCatalogEntry>): Exercise {
  const group = (KNOWN_GROUPS.includes(e.group as MuscleGroup) ? e.group : "Outros") as MuscleGroup;
  return {
    id: e.id,
    name: e.name,
    group,
    videoUrl: e.videoUrl ?? undefined,
    source: "metacore",
    bodyPart: e.bodyPart,
    equipment: e.equipment,
    primaryMediaUrl: e.primaryMediaUrl,
  };
}

function coerceWeekPreset(raw: string): "semana_util" | "4" | "5" | "6" {
  const w = String(raw || "5");
  if (w === "semana_util" || w === "4" || w === "5" || w === "6") return w;
  return "5";
}

function protocolToWorkoutItems(p: WorkoutProtocol): WorkoutExercise[] {
  return p.items.map((it) => ({
    exerciseId: it.exerciseId,
    name: it.name,
    sets: it.sets,
    reps: it.reps,
    rest: it.rest,
    rpe: it.rpe,
    cadence: it.cadence,
    restPause: it.restPause,
    notes: it.notes,
  }));
}

function mapDashboardToStudents(rows: PersonalDashboardStudent[]): Student[] {
  return rows.map((s) => ({ id: s.id, name: s.name, plan: s.plan, gender: null }));
}

function useNarrowLayout(maxPx = 900) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxPx}px)`);
    const update = () => setNarrow(mq.matches);
    mq.addEventListener("change", update);
    update();
    return () => mq.removeEventListener("change", update);
  }, [maxPx]);
  return narrow;
}

export default function WorkoutBuilderPage() {
  const navigate = useNavigate();
  const { studentId: studentIdParam } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const prefilledStudentName = (location.state as { studentName?: string } | null)?.studentName;
  const prefilledStudentId = (location.state as { studentId?: string } | null)?.studentId;

  const narrow = useNarrowLayout(900);

  // ── Students ──────────────────────────────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    studentIdParam ?? prefilledStudentId ?? ""
  );

  // ── Catalog ───────────────────────────────────────────────────────
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // ── Protocols ─────────────────────────────────────────────────────
  const [protocolSuggestions, setProtocolSuggestions] = useState<ProtocolSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showProtocols, setShowProtocols] = useState(false);

  // ── Plan meta ─────────────────────────────────────────────────────
  const [workoutName, setWorkoutName] = useState("Treino A");
  const [weekPreset, setWeekPreset] = useState<"semana_util" | "4" | "5" | "6">("5");
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup>("Perna");
  const [recentPlansCount, setRecentPlansCount] = useState<number | null>(null);

  // ── Library filters ───────────────────────────────────────────────
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [libGroupFilter, setLibGroupFilter] = useState<MuscleGroup | "all">("all");
  const [showVideoOnly, setShowVideoOnly] = useState(false);

  // ── Workout list ──────────────────────────────────────────────────
  const [items, setItems] = useState<WorkoutExercise[]>([]);

  // ── UI ────────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // ── AI ────────────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState<AiGeneratedWeeklyPlan | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStudentsLoading(true);
    setStudentsError(null);
    void (async () => {
      try {
        const dash = await fetchPersonalDashboard();
        if (cancelled) return;
        if (!dash?.students.length) {
          setStudentsError("Nenhum aluno vinculado ao seu perfil.");
          return;
        }
        const list = mapDashboardToStudents(dash.students);
        setStudents(list);
        if (studentIdParam && list.some((s) => s.id === studentIdParam)) {
          setSelectedStudentId(studentIdParam);
        } else if (prefilledStudentId && list.some((s) => s.id === prefilledStudentId)) {
          setSelectedStudentId(prefilledStudentId);
        } else if (prefilledStudentName) {
          const match = list.find((s) => s.name === prefilledStudentName);
          if (match) {
            setSelectedStudentId(match.id);
            navigate(`${BUILDER_BASE}/${match.id}/workouts/builder`, { replace: true });
          }
        }
      } catch {
        if (!cancelled) setStudentsError("Não foi possível carregar alunos. Tente novamente.");
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    void (async () => {
      try {
        const rows = await searchExercises({ limit: 200 });
        if (cancelled) return;
        setAllExercises(rows.map(exerciseSummaryToCatalogEntry).map(catalogEntryToExercise));
      } catch (e) {
        if (!cancelled) {
          setAllExercises([]);
          setCatalogError(e instanceof Error ? e.message : "Catálogo indisponível.");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedStudentId) {
      setProtocolSuggestions([]);
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    void (async () => {
      try {
        const rows = await fetchProtocolSuggestions(selectedStudentId);
        if (!cancelled) setProtocolSuggestions(rows);
      } catch {
        if (!cancelled) setProtocolSuggestions([]);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedStudentId]);

  const refreshRecentPlans = useCallback(async (sid: string) => {
    try {
      const rows = await fetchPersonalWorkoutPlans(sid, 20);
      setRecentPlansCount(rows.length);
    } catch {
      setRecentPlansCount(null);
    }
  }, []);

  useEffect(() => {
    if (selectedStudentId) void refreshRecentPlans(selectedStudentId);
  }, [selectedStudentId, refreshRecentPlans]);

  const hydrateFromProtocol = useCallback((p: WorkoutProtocol) => {
    setWorkoutName(p.title);
    setWeekPreset(coerceWeekPreset(p.weekPreset));
    const sg = p.selectedGroup;
    if (sg && KNOWN_GROUPS.includes(sg as MuscleGroup)) setSelectedGroup(sg as MuscleGroup);
    setItems(protocolToWorkoutItems(p));
  }, []);

  const loadProtocolIntoBuilder = useCallback(
    async (protocolId: number, msg?: string): Promise<boolean> => {
      try {
        const p = await fetchWorkoutProtocolById(protocolId);
        hydrateFromProtocol(p);
        setFeedback({ kind: "success", message: msg ?? `Protocolo "${p.title}" carregado.` });
        return true;
      } catch (e) {
        setFeedback({
          kind: "error",
          message: e instanceof Error ? e.message : "Não foi possível carregar o protocolo.",
        });
        return false;
      }
    },
    [hydrateFromProtocol]
  );

  useEffect(() => {
    const raw = searchParams.get("protocol");
    if (!raw) return;
    const pid = Number(raw);
    if (!Number.isFinite(pid)) return;
    let cancelled = false;
    void (async () => {
      const ok = await loadProtocolIntoBuilder(pid, "Protocolo da biblioteca aplicado.");
      if (!cancelled && ok) {
        navigate({ pathname: location.pathname, search: "" }, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams, navigate, location.pathname, loadProtocolIntoBuilder]);

  // ── Derived ───────────────────────────────────────────────────────
  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const libraryList = useMemo(() => {
    const q = exerciseQuery.trim().toLowerCase();
    let base: Exercise[];

    if (showVideoOnly) {
      base = allExercises.filter((e) => e.primaryMediaUrl != null || e.videoUrl != null);
    } else if (libGroupFilter === "all") {
      base = allExercises;
    } else {
      base = allExercises.filter((e) => e.group === libGroupFilter);
    }

    if (!q) return base;
    return base.filter((e) => e.name.toLowerCase().includes(q));
  }, [allExercises, exerciseQuery, showVideoOnly, libGroupFilter]);

  // ── Exercise ops ──────────────────────────────────────────────────
  function addExercise(ex: Exercise) {
    setItems((prev) => [
      ...prev,
      { exerciseId: ex.id, name: ex.name, sets: "4", reps: "10-12", rest: "60s" },
    ]);
  }

  function removeExercise(exerciseId: string) {
    setItems((prev) => prev.filter((i) => i.exerciseId !== exerciseId));
  }

  function moveExercise(exerciseId: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.exerciseId === exerciseId);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function updateItem(exerciseId: string, patch: Partial<WorkoutExercise>) {
    setItems((prev) => prev.map((i) => (i.exerciseId === exerciseId ? { ...i, ...patch } : i)));
  }

  function onStudentSelect(id: string) {
    setSelectedStudentId(id);
    if (id) navigate(`${BUILDER_BASE}/${id}/workouts/builder`, { replace: true });
  }

  function selectGroup(g: MuscleGroup) {
    setLibGroupFilter(g);
    setSelectedGroup(g);
    setShowVideoOnly(false);
  }

  // ── Save (direct, no modal) ────────────────────────────────────────
  async function saveWorkout() {
    if (!selectedStudentId || items.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      await createPersonalWorkoutPlan(selectedStudentId, {
        title: workoutName,
        weekPreset,
        selectedGroup,
        items,
      });
      setFeedback({
        kind: "success",
        message: `Ficha "${workoutName}" salva para ${selectedStudent?.name ?? "o aluno"}.`,
      });
      await refreshRecentPlans(selectedStudentId);
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : "Não foi possível salvar a ficha.",
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Save as template ──────────────────────────────────────────────
  async function saveAsTemplate() {
    if (items.length === 0) return;
    setSavingTemplate(true);
    setFeedback(null);
    try {
      await createWorkoutProtocol({ title: workoutName, weekPreset, selectedGroup, items });
      setFeedback({ kind: "success", message: `Template "${workoutName}" salvo na sua biblioteca.` });
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : "Não foi possível salvar o template.",
      });
    } finally {
      setSavingTemplate(false);
    }
  }

  // ── AI generation ─────────────────────────────────────────────────
  function resolveAiExercises(generated: AiGeneratedExercise[]): WorkoutExercise[] {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return generated.map((g) => {
      // IA nova retorna exercise_id UUID — usa direto se existir na lista carregada
      const byId = (g as { exercise_id?: string }).exercise_id;
      if (byId && UUID_RE.test(byId)) {
        const match = allExercises.find((c) => c.id === byId);
        if (match) {
          return {
            exerciseId: match.id,
            name: match.name,
            sets: g.sets,
            reps: g.reps,
            rest: g.rest,
            notes: g.note ?? undefined,
          };
        }
      }
      // Fallback: match por nome (IA legada ou exercício ainda não em memória)
      const nameLower = g.name.toLowerCase();
      const match =
        allExercises.find((c) => c.name.toLowerCase() === nameLower) ??
        allExercises.find((c) => c.name.toLowerCase().includes(nameLower.split(" ")[0]));
      return {
        exerciseId: match?.id ?? `ai-${Math.random().toString(36).slice(2)}`,
        name: match?.name ?? g.name,
        sets: g.sets,
        reps: g.reps,
        rest: g.rest,
        notes: g.note ?? undefined,
      };
    });
  }

  function loadDay(plan: AiGeneratedWeeklyPlan, dayIdx: number) {
    const day = plan.days[dayIdx];
    if (!day) return;
    setSelectedDayIdx(dayIdx);
    setWorkoutName(`${plan.title} — ${day.name}`);
    setItems(resolveAiExercises(day.exercises));
  }

  async function generateWithAi() {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setFeedback(null);
    try {
      const catalogNames = allExercises.map((e) => e.name);
      const result = await generateWorkoutWithAi(aiPrompt.trim(), catalogNames);
      if (result.weekPreset) setWeekPreset(coerceWeekPreset(result.weekPreset));
      setWeeklyPlan(result);
      setSelectedDayIdx(0);
      loadDay(result, 0);
      const totalEx = result.days.reduce((s, d) => s + d.exercises.length, 0);
      setFeedback({
        kind: "success",
        message: `Plano ${result.split ?? ""} gerado: ${result.days.length} dias, ${totalEx} exercícios. Selecione o dia e revise.`,
      });
      setShowAi(false);
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : "Não foi possível gerar a ficha.",
      });
    } finally {
      setAiLoading(false);
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────
  const inputS: React.CSSProperties = {
    minHeight: 34,
    padding: "7px 10px",
    borderRadius: 8,
    border: `1px solid ${WB.border}`,
    background: "#FFFFFF",
    color: WB.text,
    outline: "none",
    fontSize: 13,
    boxSizing: "border-box",
  };

  const compactInput: React.CSSProperties = {
    ...inputS,
    padding: "5px 7px",
    borderRadius: 7,
    fontSize: 12,
    width: "100%",
    minWidth: 0,
  };

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "5px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? WB.borderStrong : WB.border}`,
    background: active ? "rgba(15,23,42,0.05)" : "transparent",
    color: WB.text,
    cursor: "pointer",
    fontWeight: 650,
    fontSize: 12,
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  const freqBtn = (active: boolean): React.CSSProperties => ({
    padding: "5px 10px",
    borderRadius: 8,
    border: `1px solid ${active ? WB.borderStrong : "transparent"}`,
    background: active ? "#FFFFFF" : "transparent",
    color: WB.text,
    cursor: "pointer",
    fontWeight: 650,
    fontSize: 12,
    boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
  });

  const iconBtn = (disabled: boolean): React.CSSProperties => ({
    padding: 4,
    borderRadius: 6,
    border: `1px solid ${WB.border}`,
    background: "transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.35 : 1,
    display: "grid",
    placeItems: "center",
    color: WB.text,
    lineHeight: 0,
  });

  const canSave = Boolean(selectedStudent) && items.length > 0;

  return (
    <div className="pp-page" style={{ maxWidth: 1200 }}>
      {feedback ? (
        <FeedbackBanner kind={feedback.kind} message={feedback.message} onDismiss={() => setFeedback(null)} />
      ) : null}
      {studentsError ? (
        <FeedbackBanner kind="error" message={studentsError} onDismiss={() => setStudentsError(null)} />
      ) : null}
      {catalogError ? (
        <FeedbackBanner kind="error" message={catalogError} onDismiss={() => setCatalogError(null)} />
      ) : null}

      {/* ── Compact header ─────────────────────────────────────────── */}
      <div className="wb-header">
        {/* Student */}
        <div style={{ display: "grid", gap: 4, minWidth: 150 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: WB.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Aluno
          </span>
          <select
            value={selectedStudentId}
            onChange={(e) => onStudentSelect(e.target.value)}
            disabled={studentsLoading}
            style={{ ...inputS, minWidth: 150, cursor: "pointer" }}
          >
            <option value="">— Selecionar —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Plan name */}
        <div style={{ display: "grid", gap: 4, flex: "1 1 180px", minWidth: 130 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: WB.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Nome da ficha
          </span>
          <input
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="Treino A"
            style={{ ...inputS, width: "100%" }}
          />
        </div>

        {/* Frequency */}
        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: WB.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Frequência
          </span>
          <div style={{ display: "flex", gap: 2, border: `1px solid ${WB.border}`, borderRadius: 10, background: "rgba(241,245,249,.92)", padding: 3 }}>
            {(["semana_util", "4", "5", "6"] as const).map((v) => (
              <button key={v} type="button" style={freqBtn(weekPreset === v)} onClick={() => setWeekPreset(v)}>
                {v === "semana_util" ? "Útil" : `${v}x`}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginLeft: "auto" }}>
          <WbButton variant="ghost" onClick={() => navigate("/app/personal/library")}>
            Biblioteca
          </WbButton>
          {items.length > 0 ? (
            <WbButton
              variant="ghost"
              disabled={savingTemplate}
              title="Salvar como template reutilizável na sua biblioteca"
              onClick={() => void saveAsTemplate()}
            >
              {savingTemplate ? "Salvando…" : "Salvar template"}
            </WbButton>
          ) : null}
          <WbButton
            variant="primary"
            disabled={!canSave || saving}
            title={!selectedStudent ? "Selecione um aluno" : items.length === 0 ? "Adicione exercícios" : ""}
            onClick={() => void saveWorkout()}
          >
            {saving ? "Salvando…" : "Salvar ficha"}
          </WbButton>
        </div>
      </div>

      {/* Context subline */}
      {selectedStudent ? (
        <div style={{ fontSize: 12, color: WB.muted, paddingLeft: 2 }}>
          <strong style={{ color: WB.text }}>{selectedStudent.name}</strong>
          {" · "}Plano {selectedStudent.plan.toUpperCase()}
          {recentPlansCount != null ? ` · ${recentPlansCount} ficha(s) existente(s)` : ""}
        </div>
      ) : null}

      {/* ── Split panels ───────────────────────────────────────────── */}
      <div
        className="wb-split"
        style={{ gridTemplateColumns: narrow ? "1fr" : "1fr minmax(300px, 380px)" }}
      >
        {/* ── Library ─────────────────────────────────────────────── */}
        <WbCard>
          <div style={{ padding: 16, display: "grid", gap: 12, order: narrow ? 2 : 1 }}>
            <div style={{ fontWeight: 650, fontSize: 15, color: WB.text }}>Exercícios</div>

            {/* Search */}
            <input
              value={exerciseQuery}
              onChange={(e) => setExerciseQuery(e.target.value)}
              placeholder="Buscar exercício…"
              style={{ ...inputS, width: "100%" }}
            />

            {/* Group chips */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              <button
                type="button"
                style={chip(libGroupFilter === "all" && !showVideoOnly)}
                onClick={() => { setLibGroupFilter("all"); setShowVideoOnly(false); }}
              >
                Todos
              </button>
              {CATALOG_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  style={chip(libGroupFilter === g && !showVideoOnly)}
                  onClick={() => selectGroup(g)}
                >
                  {g}
                </button>
              ))}
              <button
                type="button"
                style={chip(showVideoOnly)}
                onClick={() => { setShowVideoOnly((v) => !v); setLibGroupFilter("all"); }}
              >
                Vídeos
              </button>
            </div>

            {/* Exercise rows */}
            <div style={{ display: "grid", gap: 6 }}>
              {catalogLoading ? (
                <div style={{ color: WB.muted, fontSize: 13 }}>Carregando exercícios…</div>
              ) : libraryList.length === 0 ? (
                <div style={{ color: WB.muted, fontSize: 13 }}>
                  {exerciseQuery ? "Nenhum resultado para esta busca." : "Nenhum exercício neste grupo."}
                </div>
              ) : (
                libraryList.map((ex) => {
                  const already = items.some((i) => i.exerciseId === ex.id);
                  return (
                    <div
                      key={ex.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 11px",
                        borderRadius: 9,
                        border: `1px solid ${WB.border}`,
                        background: "#FFFFFF",
                        opacity: already ? 0.55 : 1,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 650, fontSize: 13, lineHeight: 1.3 }}>{ex.name}</div>
                        <div style={{ fontSize: 11, color: WB.muted, marginTop: 1 }}>
                          {ex.source === "video" ? "Vídeo" : ex.group}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => addExercise(ex)}
                        title={already ? "Já na lista" : "Adicionar"}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: `1px solid ${already ? WB.border : WB.primaryBorder}`,
                          background: already ? "transparent" : WB.primary,
                          color: already ? WB.muted : "#FFFFFF",
                          cursor: already ? "default" : "pointer",
                          fontWeight: 700,
                          fontSize: 16,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        {already ? "✓" : "+"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Protocol suggestions accordion */}
            <div style={{ borderTop: `1px solid ${WB.border}`, paddingTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowProtocols((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: WB.muted,
                  fontSize: 12,
                  fontWeight: 650,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: 0,
                }}
              >
                <span style={{ fontSize: 10 }}>{showProtocols ? "▲" : "▼"}</span>
                Carregar protocolo
                {protocolSuggestions.length > 0 ? ` (${protocolSuggestions.length})` : ""}
              </button>

              {showProtocols ? (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {suggestionsLoading ? (
                    <div style={{ color: WB.muted, fontSize: 13 }}>Carregando…</div>
                  ) : protocolSuggestions.length === 0 ? (
                    <div style={{ color: WB.muted, fontSize: 13 }}>
                      Nenhuma sugestão automática para este perfil.
                    </div>
                  ) : (
                    protocolSuggestions.map((s) => (
                      <div
                        key={s.protocolId}
                        style={{
                          padding: "9px 11px",
                          borderRadius: 9,
                          border: `1px solid ${WB.border}`,
                          background: "#FFFFFF",
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 650, fontSize: 13 }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: WB.muted, marginTop: 1 }}>{s.reason}</div>
                        </div>
                        <WbButton
                          variant="ghost"
                          type="button"
                          onClick={() => void loadProtocolIntoBuilder(s.protocolId)}
                        >
                          Carregar
                        </WbButton>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {/* AI generation accordion */}
            <div style={{ borderTop: `1px solid ${WB.border}`, paddingTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowAi((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: WB.muted,
                  fontSize: 12,
                  fontWeight: 650,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: 0,
                }}
              >
                <span style={{ fontSize: 10 }}>{showAi ? "▲" : "▼"}</span>
                Gerar com IA
              </button>

              {showAi ? (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, color: WB.muted, lineHeight: 1.45 }}>
                    Descreva o treino em linguagem natural. A IA escolherá exercícios do catálogo e preencherá séries, reps e descanso.
                  </div>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ex: Treino de perna para iniciante, 4 dias na semana, foco em hipertrofia"
                    rows={3}
                    style={{
                      ...inputS,
                      width: "100%",
                      minHeight: 72,
                      resize: "vertical",
                      fontFamily: "inherit",
                      fontSize: 13,
                    }}
                    maxLength={400}
                  />
                  <WbButton
                    variant="primary"
                    disabled={!aiPrompt.trim() || aiLoading}
                    onClick={() => void generateWithAi()}
                  >
                    {aiLoading ? "Gerando…" : "Gerar ficha"}
                  </WbButton>
                </div>
              ) : null}
            </div>
          </div>
        </WbCard>

        {/* ── Workout list ─────────────────────────────────────────── */}
        <div
          style={{
            order: narrow ? 1 : 2,
            position: narrow ? "static" : "sticky",
            top: 12,
            alignSelf: "start",
          }}
        >
          <WbCard>
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 650, fontSize: 15, color: WB.text }}>Lista do treino</div>
                <span style={pillStyle(WB.primarySoft, WB.primaryBorder)}>{items.length} exercício(s)</span>
              </div>

              {/* Day selector — appears when IA returns a weekly plan */}
              {weeklyPlan && weeklyPlan.days.length > 1 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: WB.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    Plano {weeklyPlan.split} — selecione o dia
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {weeklyPlan.days.map((day, idx) => (
                      <button
                        key={day.name}
                        type="button"
                        onClick={() => loadDay(weeklyPlan, idx)}
                        style={{
                          padding: "5px 11px",
                          borderRadius: 8,
                          border: `1px solid ${idx === selectedDayIdx ? WB.primaryBorder : WB.border}`,
                          background: idx === selectedDayIdx ? WB.primary : "transparent",
                          color: idx === selectedDayIdx ? "#FFFFFF" : WB.text,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 650,
                          lineHeight: 1.4,
                        }}
                        title={day.focus}
                      >
                        {day.name}
                        <span style={{ display: "block", fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{day.focus}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {items.length === 0 ? (
                <div
                  style={{
                    border: `1px dashed ${WB.border}`,
                    borderRadius: 9,
                    padding: 20,
                    textAlign: "center",
                    color: WB.muted,
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  Adicione exercícios da biblioteca{narrow ? " abaixo" : " ao lado"}.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((it, idx) => (
                    <div
                      key={it.exerciseId}
                      style={{
                        border: `1px solid ${WB.border}`,
                        borderRadius: 9,
                        background: "#FFFFFF",
                        padding: "10px 11px",
                        display: "grid",
                        gap: 7,
                      }}
                    >
                      {/* Row header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: WB.muted, minWidth: 18, flexShrink: 0 }}>
                          {idx + 1}.
                        </span>
                        <span style={{ flex: 1, fontWeight: 650, fontSize: 13, lineHeight: 1.3 }}>
                          {it.name}
                        </span>
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveExercise(it.exerciseId, -1)}
                            style={iconBtn(idx === 0)}
                            title="Mover para cima"
                          >
                            <IconArrowUp />
                          </button>
                          <button
                            type="button"
                            disabled={idx >= items.length - 1}
                            onClick={() => moveExercise(it.exerciseId, 1)}
                            style={iconBtn(idx >= items.length - 1)}
                            title="Mover para baixo"
                          >
                            <IconArrowDown />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExercise(it.exerciseId)}
                            style={{ ...iconBtn(false), color: WB.muted, fontSize: 12 }}
                            title="Remover"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Sets / Reps / Rest */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["sets", "reps", "rest"] as const).map((field) => (
                          <label
                            key={field}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: "grid",
                              gap: 2,
                              fontSize: 10,
                              fontWeight: 600,
                              color: WB.muted,
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                            }}
                          >
                            {field === "sets" ? "Séries" : field === "reps" ? "Reps" : "Desc."}
                            <input
                              value={it[field]}
                              onChange={(e) => updateItem(it.exerciseId, { [field]: e.target.value })}
                              style={compactInput}
                              autoComplete="off"
                            />
                          </label>
                        ))}
                      </div>

                      {/* Technical details */}
                      <details>
                        <summary
                          style={{
                            cursor: "pointer",
                            color: WB.muted,
                            fontSize: 11,
                            fontWeight: 650,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            listStyle: "none",
                            padding: "2px 0",
                          }}
                        >
                          Técnico {it.rpe || it.cadence || it.restPause || it.notes ? "•" : ""}
                        </summary>
                        <div
                          style={{
                            display: "grid",
                            gap: 7,
                            paddingTop: 7,
                            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                          }}
                        >
                          <label
                            style={{
                              display: "grid",
                              gap: 2,
                              fontSize: 10,
                              fontWeight: 600,
                              color: WB.muted,
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                            }}
                          >
                            RPE
                            <input
                              value={it.rpe ?? ""}
                              placeholder="7-8"
                              onChange={(e) => updateItem(it.exerciseId, { rpe: e.target.value })}
                              style={{
                                ...compactInput,
                                borderColor:
                                  it.rpe && !RPE_REGEX.test(it.rpe)
                                    ? "rgba(248,113,113,.55)"
                                    : undefined,
                              }}
                              autoComplete="off"
                            />
                          </label>
                          <label
                            style={{
                              display: "grid",
                              gap: 2,
                              fontSize: 10,
                              fontWeight: 600,
                              color: WB.muted,
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                            }}
                          >
                            Cadência
                            <input
                              value={it.cadence ?? ""}
                              placeholder="3-1-2-0"
                              onChange={(e) => updateItem(it.exerciseId, { cadence: e.target.value })}
                              style={{
                                ...compactInput,
                                borderColor:
                                  it.cadence && !CADENCE_REGEX.test(it.cadence)
                                    ? "rgba(248,113,113,.55)"
                                    : undefined,
                              }}
                              autoComplete="off"
                            />
                          </label>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 11,
                              fontWeight: 600,
                              color: WB.text,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(it.restPause)}
                              onChange={(e) => updateItem(it.exerciseId, { restPause: e.target.checked })}
                            />
                            Rest-pause
                          </label>
                        </div>
                        <label
                          style={{
                            display: "grid",
                            gap: 2,
                            fontSize: 10,
                            fontWeight: 600,
                            color: WB.muted,
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                            marginTop: 7,
                          }}
                        >
                          Observações
                          <textarea
                            value={it.notes ?? ""}
                            onChange={(e) => updateItem(it.exerciseId, { notes: e.target.value })}
                            placeholder="cues de execução, amplitude…"
                            rows={2}
                            style={{
                              ...compactInput,
                              minHeight: 48,
                              resize: "vertical",
                              fontFamily: "inherit",
                            }}
                            maxLength={500}
                          />
                        </label>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA duplicated at bottom */}
              <WbButton
                variant="primary"
                disabled={!canSave || saving}
                onClick={() => void saveWorkout()}
              >
                {saving ? "Salvando…" : "Salvar ficha"}
              </WbButton>
            </div>
          </WbCard>
        </div>
      </div>
    </div>
  );
}
