import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PERSONAL_STUDENTS, type PersonalStudentGender, type PersonalStudentPlan } from "./personalStudentsMock";
import { fetchPersonalDashboard } from "../../services/personalDashboardApi";
import type { PersonalDashboardStudent } from "../../services/personalDashboardApi";
import { createPersonalWorkoutPlan, fetchPersonalWorkoutPlans } from "../../services/personalWorkoutApi";
import { fetchVideosSearch } from "../../services/videosSearchApi";
import {
  BuilderStepRail,
  FeedbackBanner,
  pillStyle,
  SectionLabel,
  WbButton,
  WbCard,
} from "./workoutBuilder/WorkoutBuilderUi";
import { WB } from "./workoutBuilder/workoutBuilderTheme";

const BUILDER_BASE = "/app/personal/students";

type Plan = PersonalStudentPlan;
type Gender = PersonalStudentGender;

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
};

type WorkoutExercise = {
  exerciseId: string;
  name: string;
  sets: string;
  reps: string;
  rest: string;
};

function mapDashboardToStudents(rows: PersonalDashboardStudent[]): Student[] {
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    plan: s.plan,
    gender: null,
  }));
}

function mapMockToStudents(): Student[] {
  return PERSONAL_STUDENTS.map((student) => ({
    id: student.id,
    name: student.name,
    plan: student.plan,
    gender: student.gender,
  }));
}

function suggestNextExercises(firstExerciseName: string, group: MuscleGroup, all: Exercise[]) {
  const name = firstExerciseName.toLowerCase();
  const inGroup = all.filter((e) => e.group === group);

  if (group === "Outros") {
    return inGroup.slice(0, 6);
  }

  if (group === "Perna") {
    if (name.includes("extensora")) {
      return ["Agachamento Livre", "Leg Press 45°", "Mesa Flexora", "Panturrilha em Pé"]
        .map((n) => inGroup.find((e) => e.name === n))
        .filter(Boolean) as Exercise[];
    }
    if (name.includes("agach")) {
      return ["Leg Press 45°", "Cadeira Extensora", "Mesa Flexora", "Panturrilha Sentado"]
        .map((n) => inGroup.find((e) => e.name === n))
        .filter(Boolean) as Exercise[];
    }
  }

  return inGroup.slice(0, 6);
}

function useNarrowLayout(maxPx = 900) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxPx}px)`);
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener("change", fn);
    fn();
    return () => mq.removeEventListener("change", fn);
  }, [maxPx]);
  return narrow;
}

export default function WorkoutBuilderPage() {
  const navigate = useNavigate();
  const { studentId: studentIdParam } = useParams();
  const location = useLocation();

  const prefilledStudentName = (location.state as { studentName?: string } | null)?.studentName;
  const prefilledStudentId = (location.state as { studentId?: string } | null)?.studentId;

  const narrow = useNarrowLayout(900);

  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [videoExercises, setVideoExercises] = useState<Exercise[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [recentPlansCount, setRecentPlansCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStudentsLoading(true);
      setStudentsError(null);
      try {
        const dash = await fetchPersonalDashboard();
        if (cancelled) return;
        if (!dash) {
          setStudents(mapMockToStudents());
          setStudentsError("Não foi possível carregar o painel — exibindo lista de demonstração.");
          return;
        }
        if (dash.students.length) {
          setStudents(mapDashboardToStudents(dash.students));
        } else {
          setStudents([]);
          setStudentsError("Nenhum aluno vinculado ao seu perfil.");
        }
      } catch {
        if (cancelled) return;
        setStudents(mapMockToStudents());
        setStudentsError("Não foi possível carregar alunos do servidor — usando lista de demonstração.");
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setVideosLoading(true);
      setVideosError(null);
      try {
        const rows = await fetchVideosSearch({ limit: 48 });
        if (cancelled) return;
        setVideoExercises(
          rows.map((v) => ({
            id: `v-${v.id}`,
            name: v.title,
            group: "Outros" as MuscleGroup,
            videoUrl: v.url,
          }))
        );
      } catch (e) {
        if (cancelled) return;
        setVideoExercises([]);
        setVideosError(e instanceof Error ? e.message : "Biblioteca de vídeos indisponível.");
      } finally {
        if (!cancelled) setVideosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const staticExercises: Exercise[] = useMemo(
    () => [
      { id: "e1", name: "Cadeira Extensora", group: "Perna", videoUrl: "/videos/cadeira-extensora.mp4" },
      { id: "e2", name: "Agachamento Livre", group: "Perna", videoUrl: "/videos/agachamento-livre.mp4" },
      { id: "e3", name: "Leg Press 45°", group: "Perna", videoUrl: "/videos/leg-press-45.mp4" },
      { id: "e4", name: "Mesa Flexora", group: "Perna", videoUrl: "/videos/mesa-flexora.mp4" },
      { id: "e5", name: "Panturrilha em Pé", group: "Perna", videoUrl: "/videos/panturrilha-em-pe.mp4" },
      { id: "e6", name: "Panturrilha Sentado", group: "Perna", videoUrl: "/videos/panturrilha-sentado.mp4" },
      { id: "p1", name: "Supino Reto", group: "Peito", videoUrl: "/videos/supino-reto.mp4" },
      { id: "p2", name: "Supino Inclinado", group: "Peito", videoUrl: "/videos/supino-inclinado.mp4" },
      { id: "p3", name: "Crucifixo", group: "Peito", videoUrl: "/videos/crucifixo.mp4" },
      { id: "c1", name: "Puxada Frente", group: "Costas", videoUrl: "/videos/puxada-frente.mp4" },
      { id: "c2", name: "Remada Curvada", group: "Costas", videoUrl: "/videos/remada-curvada.mp4" },
      { id: "c3", name: "Remada Baixa", group: "Costas", videoUrl: "/videos/remada-baixa.mp4" },
      { id: "o1", name: "Desenvolvimento", group: "Ombro", videoUrl: "/videos/desenvolvimento.mp4" },
      { id: "o2", name: "Elevação Lateral", group: "Ombro", videoUrl: "/videos/elevacao-lateral.mp4" },
      { id: "b1", name: "Rosca Direta", group: "Bíceps", videoUrl: "/videos/rosca-direta.mp4" },
      { id: "t1", name: "Tríceps Corda", group: "Tríceps", videoUrl: "/videos/triceps-corda.mp4" },
      { id: "a1", name: "Abdominal Infra", group: "Abdômen", videoUrl: "/videos/abdominal-infra.mp4" },
      { id: "k1", name: "Esteira (HIIT)", group: "Cardio", videoUrl: "/videos/esteira-hiit.mp4" },
    ],
    []
  );

  const EXERCISES = useMemo(() => [...staticExercises, ...videoExercises], [staticExercises, videoExercises]);

  const catalogExercises = useMemo(() => EXERCISES.filter((e) => !e.id.startsWith("v-")), [EXERCISES]);

  const [libraryTab, setLibraryTab] = useState<"catalog" | "videos">("catalog");

  const derivedInitialStudent =
    students.find((s) => s.id === (studentIdParam ?? prefilledStudentId)) ??
    (prefilledStudentName ? students.find((s) => s.name === prefilledStudentName) : undefined);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(derivedInitialStudent?.id ?? "");

  useEffect(() => {
    if (!students.length) return;
    const fromUrl = studentIdParam && students.some((s) => s.id === studentIdParam);
    if (fromUrl) {
      setSelectedStudentId(studentIdParam);
      return;
    }
    const byState = prefilledStudentId && students.some((s) => s.id === prefilledStudentId);
    if (byState) {
      setSelectedStudentId(prefilledStudentId);
      return;
    }
    const byName = prefilledStudentName && students.find((s) => s.name === prefilledStudentName);
    if (byName) {
      setSelectedStudentId(byName.id);
      navigate(`${BUILDER_BASE}/${byName.id}/workouts/builder`, { replace: true });
    }
  }, [students, studentIdParam, prefilledStudentId, prefilledStudentName, navigate]);

  const [expandStudentPicker, setExpandStudentPicker] = useState(!studentIdParam);

  useEffect(() => {
    if (studentIdParam && selectedStudentId === studentIdParam) {
      setExpandStudentPicker(false);
    }
  }, [studentIdParam, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const [weekPreset, setWeekPreset] = useState<"semana_util" | "4" | "5" | "6">("5");

  const groups: MuscleGroup[] = useMemo(
    () => ["Perna", "Peito", "Costas", "Ombro", "Bíceps", "Tríceps", "Abdômen", "Glúteo", "Cardio", "Outros"],
    []
  );
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup>("Perna");

  const [exerciseQuery, setExerciseQuery] = useState("");

  const catalogGroups = useMemo(
    () => groups.filter((g) => g !== "Outros"),
    [groups]
  );

  useEffect(() => {
    if (libraryTab === "catalog" && selectedGroup === "Outros") {
      setSelectedGroup("Perna");
    }
  }, [libraryTab, selectedGroup]);

  const libraryList = useMemo(() => {
    const q = exerciseQuery.trim().toLowerCase();
    if (libraryTab === "videos") {
      const base = videoExercises;
      if (!q) return base;
      return base.filter((e) => e.name.toLowerCase().includes(q));
    }
    const inGroup = catalogExercises.filter((e) => e.group === selectedGroup);
    if (!q) return inGroup;
    return inGroup.filter((e) => e.name.toLowerCase().includes(q));
  }, [libraryTab, videoExercises, catalogExercises, selectedGroup, exerciseQuery]);

  const [workoutName, setWorkoutName] = useState<string>("Treino A");
  const [items, setItems] = useState<WorkoutExercise[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const firstExerciseGroup = useMemo((): MuscleGroup => {
    const id = items[0]?.exerciseId;
    if (!id) return selectedGroup;
    return EXERCISES.find((e) => e.id === id)?.group ?? selectedGroup;
  }, [items, EXERCISES, selectedGroup]);

  const suggestions = useMemo(() => {
    if (items.length === 0) return [];
    return suggestNextExercises(items[0].name, firstExerciseGroup, EXERCISES).filter(
      (e) => !items.some((it) => it.exerciseId === e.id)
    );
  }, [items, firstExerciseGroup, EXERCISES]);

  const [genderFilter, setGenderFilter] = useState<"all" | Gender>("all");
  const [planFilter, setPlanFilter] = useState<"all" | Plan>("all");
  const [studentQuery, setStudentQuery] = useState("");

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return students
      .filter((s) => {
        if (genderFilter === "all") return true;
        if (s.gender == null) return false;
        return s.gender === genderFilter;
      })
      .filter((s) => (planFilter === "all" ? true : s.plan === planFilter))
      .filter((s) => (!q ? true : s.name.toLowerCase().includes(q)));
  }, [students, genderFilter, planFilter, studentQuery]);

  const refreshRecentPlans = useCallback(async (sid: string) => {
    try {
      const rows = await fetchPersonalWorkoutPlans(sid, 20);
      setRecentPlansCount(rows.length);
    } catch {
      setRecentPlansCount(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    void refreshRecentPlans(selectedStudentId);
  }, [selectedStudentId, refreshRecentPlans]);

  function addExercise(ex: Exercise) {
    setItems((prev) => [...prev, { exerciseId: ex.id, name: ex.name, sets: "4", reps: "10-12", rest: "60s" }]);
  }

  function removeExercise(exerciseId: string) {
    setItems((prev) => prev.filter((i) => i.exerciseId !== exerciseId));
  }

  function moveExercise(exerciseId: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.exerciseId === exerciseId);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  }

  function updateItem(exerciseId: string, patch: Partial<WorkoutExercise>) {
    setItems((prev) => prev.map((i) => (i.exerciseId === exerciseId ? { ...i, ...patch } : i)));
  }

  function resolveVideoUrl(exerciseId: string): string {
    return EXERCISES.find((e) => e.id === exerciseId)?.videoUrl ?? "(definir)";
  }

  const requestCloseSummary = useCallback(() => {
    if (items.length > 0) {
      const ok = window.confirm(
        "Fechar o resumo? O rascunho do treino permanece na página; você pode abrir o resumo de novo quando quiser."
      );
      if (!ok) return;
    }
    setShowSummary(false);
    setSummaryError(null);
  }, [items.length]);

  useEffect(() => {
    if (!showSummary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestCloseSummary();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSummary, requestCloseSummary]);

  useEffect(() => {
    if (studentIdParam && students.length && !students.some((s) => s.id === studentIdParam)) {
      setExpandStudentPicker(true);
    }
  }, [studentIdParam, students]);

  async function confirmWorkout() {
    if (!selectedStudentId) {
      const msg = "Selecione um aluno antes de salvar.";
      setFeedback({ kind: "error", message: msg });
      setSummaryError(msg);
      return;
    }
    setSaving(true);
    setSummaryError(null);
    setFeedback(null);
    try {
      await createPersonalWorkoutPlan(selectedStudentId, {
        title: workoutName,
        weekPreset,
        selectedGroup,
        items,
      });
      setShowSummary(false);
      setSummaryError(null);
      setFeedback({
        kind: "success",
        message: `Ficha "${workoutName}" salva para ${selectedStudent?.name ?? "o aluno"}.`,
      });
      await refreshRecentPlans(selectedStudentId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível salvar a ficha.";
      setFeedback({
        kind: "error",
        message: msg,
      });
      setSummaryError(msg);
    } finally {
      setSaving(false);
    }
  }

  function onStudentSelect(id: string) {
    setSelectedStudentId(id);
    if (id) {
      navigate(`${BUILDER_BASE}/${id}/workouts/builder`, { replace: true });
    }
  }

  const stepAluno = Boolean(selectedStudent);
  const stepFicha = workoutName.trim().length > 0;
  const stepEx = items.length > 0;

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${WB.border}`,
    background: "#FAFAFA",
    color: WB.text,
    outline: "none",
  };

  const compactInputStyle: React.CSSProperties = {
    ...inputStyle,
    padding: "6px 8px",
    borderRadius: 8,
    fontSize: 13,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  };

  const railSteps: { id: string; label: string; status: "todo" | "current" | "done" }[] = [
    { id: "aluno", label: "Aluno", status: stepAluno ? "done" : "current" },
    {
      id: "meta",
      label: "Nome e frequência",
      status: !stepAluno ? "todo" : stepFicha ? "done" : "current",
    },
    {
      id: "lista",
      label: "Lista na ordem",
      status: !stepAluno || !stepFicha ? "todo" : stepEx ? "done" : "current",
    },
  ];

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 16px",
    borderRadius: 10,
    border: `1px solid ${active ? WB.primaryBorder : WB.border}`,
    background: active ? WB.primarySoft : "transparent",
    color: WB.text,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  });

  return (
    <div style={{ display: "grid", gap: 16, color: WB.text, maxWidth: 1200 }}>
      {feedback ? (
        <FeedbackBanner kind={feedback.kind} message={feedback.message} onDismiss={() => setFeedback(null)} />
      ) : null}

      {studentsError ? (
        <FeedbackBanner kind="error" message={studentsError} onDismiss={() => setStudentsError(null)} />
      ) : null}

      {/* Cabeçalho + fluxo */}
      <WbCard>
        <div style={{ padding: 18, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 8, maxWidth: 720 }}>
              <h1 style={{ margin: 0, fontWeight: 700, fontSize: 22, letterSpacing: "-0.03em" }}>Montar ficha de treino</h1>
              <p style={{ margin: 0, color: WB.muted, fontSize: 14, lineHeight: 1.5 }}>
                Primeiro confira o aluno. Depois dê um nome à ficha e escolha quantos dias na semana. Por fim, monte a{" "}
                <strong style={{ color: WB.text }}>ordem dos exercícios</strong> — é essa lista que o aluno seguirá.
              </p>
              <BuilderStepRail steps={railSteps} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <WbButton variant="ghost" onClick={() => navigate("/app/personal/students")}>
                Ver alunos
              </WbButton>
              <WbButton
                variant="primary"
                disabled={!selectedStudent || items.length === 0}
                title={!selectedStudent ? "Selecione um aluno" : items.length === 0 ? "Adicione exercícios" : ""}
                onClick={() => setShowSummary(true)}
              >
                Revisar e salvar
              </WbButton>
            </div>
          </div>
          <div style={{ color: WB.muted, fontSize: 13 }}>
            {studentsLoading ? (
              "Carregando dados do aluno…"
            ) : selectedStudent ? (
              <>
                <strong style={{ color: WB.text }}>{selectedStudent.name}</strong>
                {" · "}
                Plano {selectedStudent.plan.toUpperCase()}
                {recentPlansCount != null ? (
                  <>
                    {" · "}
                    {recentPlansCount} ficha(s) salva(s) recente(s) para este aluno
                  </>
                ) : null}
              </>
            ) : (
              "Selecione um aluno na caixa abaixo para continuar."
            )}
          </div>
        </div>
      </WbCard>

      {/* Passo 1: aluno */}
      <WbCard>
        <div style={{ padding: 18 }}>
          <SectionLabel
            title="1. Para qual aluno é esta ficha?"
            hint="Se você entrou por um link com o ID do aluno, ele já vem selecionado. Use Trocar apenas se precisar mudar."
          />

          {studentIdParam && selectedStudent && !expandStudentPicker ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: `1px solid ${WB.primaryBorder}`,
                  background: WB.primarySoft,
                  fontWeight: 600,
                }}
              >
                {selectedStudent.name}
              </div>
              <WbButton variant="ghost" onClick={() => setExpandStudentPicker(true)}>
                Trocar aluno
              </WbButton>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WB.muted }}>Buscar</div>
                  <input
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Nome do aluno…"
                    style={{ ...inputStyle, minWidth: 200 }}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WB.muted }}>Gênero</div>
                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value as "all" | Gender)}
                    style={{ ...inputStyle, minWidth: 140, cursor: "pointer" }}
                  >
                    <option value="all">Todos</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WB.muted }}>Plano</div>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as "all" | Plan)}
                    style={{ ...inputStyle, minWidth: 140, cursor: "pointer" }}
                  >
                    <option value="all">Todos</option>
                    <option value="basic">Básico</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="black">Black</option>
                  </select>
                </div>
                <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WB.muted }}>Aluno</div>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => onStudentSelect(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer", width: "100%" }}
                  >
                    <option value="">— Escolha —</option>
                    {filteredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.plan.toUpperCase()}
                        {s.gender ? ` · ${s.gender}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {studentIdParam ? (
                <WbButton variant="ghost" onClick={() => setExpandStudentPicker(false)}>
                  Recolher
                </WbButton>
              ) : null}
            </div>
          )}
        </div>
      </WbCard>

      {/* Passo 2: meta da ficha */}
      <WbCard>
        <div style={{ padding: 18, display: "grid", gap: 14 }}>
          <SectionLabel
            title="2. Nome da ficha e frequência na semana"
            hint="Isso fica salvo no servidor junto com os exercícios. O nome ajuda você e o aluno a identificarem o treino (ex.: Treino A — Perna)."
          />
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: narrow ? "1fr" : "1fr 1fr" }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: WB.muted }}>Nome da ficha</div>
              <input
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="Ex.: Treino A — Perna"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: WB.muted }}>Quantos treinos na semana (referência)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={tabBtn(weekPreset === "semana_util")} onClick={() => setWeekPreset("semana_util")}>
                  Semana útil
                </button>
                <button type="button" style={tabBtn(weekPreset === "4")} onClick={() => setWeekPreset("4")}>
                  4
                </button>
                <button type="button" style={tabBtn(weekPreset === "5")} onClick={() => setWeekPreset("5")}>
                  5
                </button>
                <button type="button" style={tabBtn(weekPreset === "6")} onClick={() => setWeekPreset("6")}>
                  6
                </button>
              </div>
            </div>
          </div>
        </div>
      </WbCard>

      {/* Passo 3: duas colunas — no mobile o treino vem primeiro */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) minmax(300px, 400px)",
        }}
      >
        {/* Biblioteca */}
        <WbCard>
          <div style={{ padding: 18, display: "grid", gap: 14, order: narrow ? 2 : 1 }}>
            <SectionLabel
              title="3. Adicionar exercícios à ficha"
              hint="Use o catálogo por grupo muscular ou a biblioteca de vídeos do app. Cada clique em Adicionar coloca o movimento ao final da lista ao lado."
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={tabBtn(libraryTab === "catalog")} onClick={() => setLibraryTab("catalog")}>
                Catálogo por grupo
              </button>
              <button type="button" style={tabBtn(libraryTab === "videos")} onClick={() => setLibraryTab("videos")}>
                Vídeos do app
                {videoExercises.length ? ` (${videoExercises.length})` : ""}
              </button>
            </div>

            {libraryTab === "catalog" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: WB.muted }}>Grupo muscular</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {catalogGroups.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGroup(g)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: `1px solid ${selectedGroup === g ? WB.primaryBorder : WB.border}`,
                        background: selectedGroup === g ? WB.primarySoft : "#FAFAFA",
                        color: WB.text,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: WB.muted, fontSize: 13 }}>
                {videosLoading ? "Carregando vídeos…" : videosError ? videosError : "Busque pelo nome e toque em Adicionar para incluir na ficha."}
              </div>
            )}

            <input
              value={exerciseQuery}
              onChange={(e) => setExerciseQuery(e.target.value)}
              placeholder={libraryTab === "videos" ? "Buscar vídeo por nome…" : "Filtrar exercício…"}
              style={{ ...inputStyle, width: "100%" }}
            />

            <div style={{ display: "grid", gap: 8 }}>
              {libraryList.length === 0 ? (
                <div style={{ color: WB.muted, fontSize: 14 }}>
                  {libraryTab === "catalog"
                    ? "Nenhum exercício neste grupo com esse filtro."
                    : "Nenhum vídeo encontrado. Ajuste a busca ou aguarde o carregamento."}
                </div>
              ) : (
                libraryList.map((ex) => {
                  const already = items.some((i) => i.exerciseId === ex.id);
                  return (
                    <div
                      key={ex.id}
                      style={{
                        border: `1px solid ${WB.border}`,
                        borderRadius: 12,
                        padding: 12,
                        background: "#FFFFFF",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{ex.name}</div>
                        <div style={{ color: WB.muted2, fontSize: 12 }}>
                          {libraryTab === "videos" ? "Vídeo da plataforma" : `Grupo: ${ex.group}`}
                        </div>
                      </div>
                      <WbButton disabled={already} onClick={() => addExercise(ex)} variant={already ? "ghost" : "primary"}>
                        {already ? "Na lista" : "Adicionar"}
                      </WbButton>
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && suggestions.length > 0 ? (
              <div style={{ display: "grid", gap: 8, paddingTop: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Sugestões heurísticas</div>
                <div style={{ color: WB.muted, fontSize: 12, lineHeight: 1.35 }}>
                  A partir do primeiro exercício da lista ({items[0]?.name}). Opcional.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {suggestions.slice(0, 6).map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => addExercise(ex)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: `1px solid ${WB.border}`,
                        background: "#FAFAFA",
                        color: WB.text,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      + {ex.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </WbCard>

        {/* Lista do treino — destaque */}
        <div style={{ order: narrow ? 1 : 2, position: narrow ? "static" : "sticky", top: 12, alignSelf: "start" }}>
          <WbCard>
            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Sua lista (ordem do treino)</div>
                  <div style={{ color: WB.muted, fontSize: 12, marginTop: 4 }}>
                    O aluno executa de cima para baixo. Use as setas para mudar a ordem.
                  </div>
                </div>
                <span style={pillStyle(WB.primarySoft, WB.primaryBorder)}>{items.length} exercício(s)</span>
              </div>

              {items.length === 0 ? (
                <div
                  style={{
                    border: `1px dashed ${WB.border}`,
                    borderRadius: 12,
                    padding: 20,
                    textAlign: "center",
                    color: WB.muted,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Nenhum exercício ainda.
                  <br />
                  Escolha itens em <strong style={{ color: WB.text }}>Adicionar exercícios</strong> à esquerda (ou acima no celular).
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((it, idx) => (
                    <div
                      key={it.exerciseId}
                      style={{
                        border: `1px solid ${WB.border}`,
                        borderRadius: 12,
                        background: "#FFFFFF",
                        padding: 12,
                        display: "grid",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontWeight: 700, minWidth: 0, flex: "1 1 140px", lineHeight: 1.3 }}>
                          {idx + 1}. {it.name}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveExercise(it.exerciseId, -1)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: `1px solid ${WB.border}`,
                              background: "transparent",
                              color: WB.text,
                              cursor: idx === 0 ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              opacity: idx === 0 ? 0.4 : 1,
                            }}
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            disabled={idx >= items.length - 1}
                            onClick={() => moveExercise(it.exerciseId, 1)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: `1px solid ${WB.border}`,
                              background: "transparent",
                              color: WB.text,
                              cursor: idx >= items.length - 1 ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              opacity: idx >= items.length - 1 ? 0.4 : 1,
                            }}
                          >
                            Descer
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExercise(it.exerciseId)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: `1px solid ${WB.border}`,
                              background: "transparent",
                              color: WB.text,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "flex-end",
                          gap: 8,
                          width: "100%",
                          minWidth: 0,
                        }}
                      >
                        {(
                          [
                            { key: "sets", label: "Séries", value: it.sets, field: "sets" as const },
                            { key: "reps", label: "Reps", value: it.reps, field: "reps" as const },
                            { key: "rest", label: "Descanso", value: it.rest, field: "rest" as const },
                          ] as const
                        ).map((col) => (
                          <label
                            key={col.key}
                            style={{
                              flex: "1 1 0",
                              minWidth: 0,
                              display: "grid",
                              gap: 3,
                              fontSize: 10,
                              fontWeight: 600,
                              color: WB.muted,
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                            }}
                          >
                            {col.label}
                            <input
                              value={col.value}
                              onChange={(e) => updateItem(it.exerciseId, { [col.field]: e.target.value })}
                              style={compactInputStyle}
                              inputMode="text"
                              autoComplete="off"
                            />
                          </label>
                        ))}
                      </div>
                      <div style={{ color: WB.muted2, fontSize: 11, lineHeight: 1.35, wordBreak: "break-word" }}>
                        Referência de vídeo: {resolveVideoUrl(it.exerciseId)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <WbButton
                variant="primary"
                disabled={!selectedStudent || items.length === 0}
                onClick={() => setShowSummary(true)}
              >
                Revisar e salvar ficha
              </WbButton>
            </div>
          </WbCard>
        </div>
      </div>

      {showSummary ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={requestCloseSummary}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(920px, 100%)",
              borderRadius: 18,
              border: `1px solid ${WB.border}`,
              background: WB.bgDeep,
              boxShadow: WB.shadow,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: `1px solid ${WB.border}`,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Resumo do treino</div>
                <div style={{ color: WB.muted, fontSize: 13 }}>
                  Aluno: <b style={{ color: WB.text }}>{selectedStudent?.name ?? "—"}</b> • Nome:{" "}
                  <b style={{ color: WB.text }}>{workoutName}</b> • Grupo: <b style={{ color: WB.text }}>{selectedGroup}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <WbButton variant="ghost" onClick={requestCloseSummary}>
                  Cancelar
                </WbButton>
                <WbButton variant="primary" disabled={saving} onClick={() => void confirmWorkout()}>
                  {saving ? "Salvando…" : "Confirmar e salvar"}
                </WbButton>
              </div>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              {summaryError ? (
                <div
                  role="alert"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(248, 113, 113, 0.4)",
                    background: "rgba(220, 38, 38, 0.14)",
                    color: WB.text,
                    fontSize: 13,
                  }}
                >
                  {summaryError}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={pillStyle(WB.primarySoft, WB.primaryBorder)}>
                  Preset: <b>{weekPreset === "semana_util" ? "Semana útil" : `${weekPreset} treinos`}</b>
                </span>
                <span style={pillStyle("#F9FAFB", WB.borderStrong)}>
                  Total: <b>{items.length}</b> exercício(s)
                </span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {items.map((it, idx) => (
                  <div
                    key={it.exerciseId}
                    style={{
                      border: `1px solid ${WB.border}`,
                      borderRadius: 14,
                      background: "#FFFFFF",
                      padding: 12,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {idx + 1}. {it.name}
                    </div>
                    <div style={{ color: WB.muted, fontSize: 13 }}>
                      Séries: <b style={{ color: WB.text }}>{it.sets}</b> • Reps: <b style={{ color: WB.text }}>{it.reps}</b>{" "}
                      • Descanso: <b style={{ color: WB.text }}>{it.rest}</b>
                    </div>
                    <div style={{ color: WB.muted2, fontSize: 12 }}>
                      Vídeo: <b style={{ color: WB.text }}>{resolveVideoUrl(it.exerciseId)}</b>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ color: WB.muted2, fontSize: 12, lineHeight: 1.35 }}>
                Ao confirmar, a ficha é enviada ao servidor e fica disponível na listagem deste aluno.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
