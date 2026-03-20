import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PERSONAL_STUDENTS, type PersonalStudentGender, type PersonalStudentPlan } from "./personalStudentsMock";

/** ====== Identidade Treinaí ====== */
const COLORS = {
  bg: "#0F0F0F",
  panel: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
  card: "rgba(255,255,255,.03)",
  cardHover: "rgba(255,255,255,.045)",
  border: "rgba(255,255,255,.10)",
  borderStrong: "rgba(255,255,255,.14)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.65)",
  muted2: "rgba(255,255,255,.55)",
  orange: "#FF6A00",
  orangeSoft: "rgba(255,106,0,.18)",
  orangeBorder: "rgba(255,106,0,.35)",
};

type Plan = PersonalStudentPlan;
type Gender = PersonalStudentGender;

type Student = {
  id: string;
  name: string;
  plan: Plan;
  gender: Gender;
};

type MuscleGroup = "Perna" | "Peito" | "Costas" | "Ombro" | "Bíceps" | "Tríceps" | "Abdômen" | "Glúteo" | "Cardio";

type Exercise = {
  id: string;
  name: string;
  group: MuscleGroup;
  // futuro: url do storage
  videoUrl?: string;
};

type WorkoutExercise = {
  exerciseId: string;
  name: string;
  sets: string; // "4"
  reps: string; // "10-12"
  rest: string; // "60s"
};

function pillStyle(bg: string, border: string): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: `1px solid ${border}`,
    background: bg,
    color: COLORS.text,
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    whiteSpace: "nowrap",
  };
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        background: COLORS.card,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
      }}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "ghost",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "primary";
  disabled?: boolean;
  title?: string;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: isPrimary ? `1px solid ${COLORS.orangeBorder}` : `1px solid ${COLORS.border}`,
        background: isPrimary ? COLORS.orange : "transparent",
        color: isPrimary ? "#0F0F0F" : COLORS.text,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 1000,
        fontSize: 14,
        boxShadow: isPrimary ? "0 10px 24px rgba(0,0,0,.35)" : "none",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Sugestão "IA" simples (heurística) só pra demonstrar fluxo */
function suggestNextExercises(firstExerciseName: string, group: MuscleGroup, all: Exercise[]) {
  const name = firstExerciseName.toLowerCase();
  const inGroup = all.filter((e) => e.group === group);

  // regras simples (exemplo perna)
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

  // fallback: pegar "mais populares" do grupo (primeiros)
  return inGroup.slice(0, 6);
}

export default function WorkoutBuilderPage() {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const location = useLocation();

  /** Se veio do StudentsList/Dashboard via navigate(..., { state: { studentName } }) */
  const prefilledStudentName = (location.state as any)?.studentName as string | undefined;
  const prefilledStudentId = (location.state as any)?.studentId as string | undefined;

  const students: Student[] = useMemo(
    () =>
      PERSONAL_STUDENTS.map((student) => ({
        id: student.id,
        name: student.name,
        plan: student.plan,
        gender: student.gender,
      })),
    []
  );

  /** Lista de exercícios (mock) */
  const EXERCISES: Exercise[] = useMemo(
    () => [
      // Perna
      { id: "e1", name: "Cadeira Extensora", group: "Perna", videoUrl: "/videos/cadeira-extensora.mp4" },
      { id: "e2", name: "Agachamento Livre", group: "Perna", videoUrl: "/videos/agachamento-livre.mp4" },
      { id: "e3", name: "Leg Press 45°", group: "Perna", videoUrl: "/videos/leg-press-45.mp4" },
      { id: "e4", name: "Mesa Flexora", group: "Perna", videoUrl: "/videos/mesa-flexora.mp4" },
      { id: "e5", name: "Panturrilha em Pé", group: "Perna", videoUrl: "/videos/panturrilha-em-pe.mp4" },
      { id: "e6", name: "Panturrilha Sentado", group: "Perna", videoUrl: "/videos/panturrilha-sentado.mp4" },

      // Peito
      { id: "p1", name: "Supino Reto", group: "Peito", videoUrl: "/videos/supino-reto.mp4" },
      { id: "p2", name: "Supino Inclinado", group: "Peito", videoUrl: "/videos/supino-inclinado.mp4" },
      { id: "p3", name: "Crucifixo", group: "Peito", videoUrl: "/videos/crucifixo.mp4" },

      // Costas
      { id: "c1", name: "Puxada Frente", group: "Costas", videoUrl: "/videos/puxada-frente.mp4" },
      { id: "c2", name: "Remada Curvada", group: "Costas", videoUrl: "/videos/remada-curvada.mp4" },
      { id: "c3", name: "Remada Baixa", group: "Costas", videoUrl: "/videos/remada-baixa.mp4" },

      // Ombro
      { id: "o1", name: "Desenvolvimento", group: "Ombro", videoUrl: "/videos/desenvolvimento.mp4" },
      { id: "o2", name: "Elevação Lateral", group: "Ombro", videoUrl: "/videos/elevacao-lateral.mp4" },

      // Braços
      { id: "b1", name: "Rosca Direta", group: "Bíceps", videoUrl: "/videos/rosca-direta.mp4" },
      { id: "t1", name: "Tríceps Corda", group: "Tríceps", videoUrl: "/videos/triceps-corda.mp4" },

      // Core/Cardio
      { id: "a1", name: "Abdominal Infra", group: "Abdômen", videoUrl: "/videos/abdominal-infra.mp4" },
      { id: "k1", name: "Esteira (HIIT)", group: "Cardio", videoUrl: "/videos/esteira-hiit.mp4" },
    ],
    []
  );

  /** Seleção de aluno */
  const [genderFilter, setGenderFilter] = useState<"all" | Gender>("all");
  const [planFilter, setPlanFilter] = useState<"all" | Plan>("all");
  const [studentQuery, setStudentQuery] = useState("");

  const derivedInitialStudent =
    students.find((s) => s.id === (studentId ?? prefilledStudentId)) ??
    (prefilledStudentName ? students.find((s) => s.name === prefilledStudentName) : undefined);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(derivedInitialStudent?.id ?? "");

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  /** Config rápida de semana */
  const [weekPreset, setWeekPreset] = useState<"semana_util" | "4" | "5" | "6">("5");

  /** Grupo muscular */
  const groups: MuscleGroup[] = useMemo(
    () => ["Perna", "Peito", "Costas", "Ombro", "Bíceps", "Tríceps", "Abdômen", "Glúteo", "Cardio"],
    []
  );
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup>("Perna");

  /** Busca exercícios */
  const [exerciseQuery, setExerciseQuery] = useState("");
  const allInGroup = useMemo(() => EXERCISES.filter((e) => e.group === selectedGroup), [EXERCISES, selectedGroup]);

  const filteredExercises = useMemo(() => {
    const q = exerciseQuery.trim().toLowerCase();
    if (!q) return allInGroup;
    return allInGroup.filter((e) => e.name.toLowerCase().includes(q));
  }, [allInGroup, exerciseQuery]);

  /** Treino sendo montado */
  const [workoutName, setWorkoutName] = useState<string>("Treino A");
  const [items, setItems] = useState<WorkoutExercise[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  /** Sugestões após primeiro exercício */
  const suggestions = useMemo(() => {
    if (items.length === 0) return [];
    return suggestNextExercises(items[0].name, selectedGroup, EXERCISES).filter(
      (e) => !items.some((it) => it.exerciseId === e.id)
    );
  }, [items, selectedGroup, EXERCISES]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return students
      .filter((s) => (genderFilter === "all" ? true : s.gender === genderFilter))
      .filter((s) => (planFilter === "all" ? true : s.plan === planFilter))
      .filter((s) => (!q ? true : s.name.toLowerCase().includes(q)));
  }, [students, genderFilter, planFilter, studentQuery]);

  function addExercise(ex: Exercise) {
    setItems((prev) => [
      ...prev,
      { exerciseId: ex.id, name: ex.name, sets: "4", reps: "10-12", rest: "60s" },
    ]);
  }

  function removeExercise(exerciseId: string) {
    setItems((prev) => prev.filter((i) => i.exerciseId !== exerciseId));
  }

  function updateItem(exerciseId: string, patch: Partial<WorkoutExercise>) {
    setItems((prev) => prev.map((i) => (i.exerciseId === exerciseId ? { ...i, ...patch } : i)));
  }

  function confirmWorkout() {
    // Aqui depois você liga no backend.
    alert(
      `Treino confirmado!\nAluno: ${selectedStudent?.name ?? "—"}\nPreset: ${weekPreset}\nGrupo: ${selectedGroup}\nExercícios: ${items.length}`
    );
    setShowSummary(false);
  }

  return (
    <div style={{ display: "grid", gap: 14, color: COLORS.text }}>
      {/* Header */}
      <Card>
        <div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Montar treino (Builder)</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.35 }}>
              {selectedStudent ? (
                <>
                  Aluno: <b style={{ color: COLORS.text }}>{selectedStudent.name}</b> • Plano:{" "}
                  <b style={{ color: COLORS.text }}>{selectedStudent.plan.toUpperCase()}</b>
                </>
              ) : (
                <>
                  Nenhum aluno selecionado. Use o seletor abaixo ou vá em <b>Ver alunos</b>.
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={() => navigate("/app/personal/students")}>
              👥 Ver alunos
            </Button>
            <Button
              variant="primary"
              disabled={!selectedStudent || items.length === 0}
              title={!selectedStudent ? "Selecione um aluno" : items.length === 0 ? "Adicione exercícios" : ""}
              onClick={() => setShowSummary(true)}
            >
              ✅ Revisar & Confirmar
            </Button>
          </div>
        </div>
      </Card>

      {/* Seletor de aluno */}
      <Card>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 1000 }}>Selecionar aluno</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>Buscar</div>
              <input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Digite nome..."
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,.03)",
                  color: COLORS.text,
                  outline: "none",
                  minWidth: 240,
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>Gênero</div>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as any)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,.03)",
                  color: COLORS.text,
                  outline: "none",
                  cursor: "pointer",
                  minWidth: 160,
                }}
              >
                <option value="all">Todos</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>Plano</div>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value as any)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,.03)",
                  color: COLORS.text,
                  outline: "none",
                  cursor: "pointer",
                  minWidth: 160,
                }}
              >
                <option value="all">Todos</option>
                <option value="basic">Básico</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="black">Black</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>Escolher</div>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,.03)",
                  color: COLORS.text,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">— Selecione —</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} • {s.plan.toUpperCase()} • {s.gender}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={pillStyle("rgba(255,255,255,.06)", "rgba(255,255,255,.12)")}>
              👤 Selecionado: <b>{selectedStudent?.name ?? "—"}</b>
            </span>
            <span style={pillStyle(COLORS.orangeSoft, COLORS.orangeBorder)}>
              🗓️ Preset: <b>{weekPreset === "semana_util" ? "Semana útil" : `${weekPreset} treinos`}</b>
            </span>
            <span style={pillStyle("rgba(120,160,255,.12)", "rgba(120,160,255,.35)")}>
              💪 Grupo: <b>{selectedGroup}</b>
            </span>
          </div>
        </div>
      </Card>

      {/* Config rápida */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <div style={{ padding: 16, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>Config rápida (semana)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant={weekPreset === "semana_util" ? "primary" : "ghost"} onClick={() => setWeekPreset("semana_util")}>
                Semana útil
              </Button>
              <Button variant={weekPreset === "4" ? "primary" : "ghost"} onClick={() => setWeekPreset("4")}>
                4 treinos
              </Button>
              <Button variant={weekPreset === "5" ? "primary" : "ghost"} onClick={() => setWeekPreset("5")}>
                5 treinos
              </Button>
              <Button variant={weekPreset === "6" ? "primary" : "ghost"} onClick={() => setWeekPreset("6")}>
                6 treinos
              </Button>
            </div>
            <div style={{ color: COLORS.muted2, fontSize: 12, lineHeight: 1.4 }}>
              Depois a gente liga isso na criação automática de “Treino A/B/C...” conforme o preset.
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: 16, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>Nome do treino</div>
            <input
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="Ex: Treino A - Perna"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.03)",
                color: COLORS.text,
                outline: "none",
              }}
            />
            <div style={{ color: COLORS.muted2, fontSize: 12, lineHeight: 1.4 }}>
              Use isso no resumo final e quando salvar no backend.
            </div>
          </div>
        </Card>
      </div>

      {/* Grupos + biblioteca + treino atual */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "340px 1fr" }}>
        <Card>
          <div style={{ padding: 16, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>Grupo muscular</div>
            <div style={{ display: "grid", gap: 8 }}>
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: `1px solid ${selectedGroup === g ? COLORS.orangeBorder : COLORS.border}`,
                    background: selectedGroup === g ? COLORS.orangeSoft : "rgba(255,255,255,.03)",
                    color: COLORS.text,
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 1000,
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gap: 12 }}>
          <Card>
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000 }}>Exercícios ({selectedGroup})</div>
                <input
                  value={exerciseQuery}
                  onChange={(e) => setExerciseQuery(e.target.value)}
                  placeholder='Buscar... (ex: "L")'
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,.03)",
                    color: COLORS.text,
                    outline: "none",
                    minWidth: 240,
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {filteredExercises.length === 0 ? (
                  <div style={{ color: COLORS.muted }}>Nenhum exercício encontrado.</div>
                ) : (
                  filteredExercises.map((ex) => {
                    const already = items.some((i) => i.exerciseId === ex.id);
                    return (
                      <div
                        key={ex.id}
                        style={{
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 14,
                          padding: 12,
                          background: "rgba(255,255,255,.02)",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 1000 }}>{ex.name}</div>
                          <div style={{ color: COLORS.muted2, fontSize: 12 }}>
                            Vídeo padrão: <b style={{ color: COLORS.text }}>{ex.videoUrl ?? "(definir)"}</b>
                          </div>
                        </div>

                        <Button disabled={already} onClick={() => addExercise(ex)} variant={already ? "ghost" : "primary"}>
                          {already ? "Adicionado" : "Adicionar"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sugestões */}
              {items.length > 0 ? (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 1000 }}>Sugestões (IA)</div>
                  <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.35 }}>
                    Baseado no primeiro exercício: <b style={{ color: COLORS.text }}>{items[0]?.name}</b>. (Você pode ignorar.)
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {suggestions.slice(0, 6).map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => addExercise(ex)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 999,
                          border: `1px solid ${COLORS.border}`,
                          background: "rgba(255,255,255,.03)",
                          color: COLORS.text,
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                      >
                        + {ex.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000 }}>Treino atual</div>
                <span style={pillStyle("rgba(255,255,255,.06)", "rgba(255,255,255,.12)")}>
                  {items.length} exercício(s)
                </span>
              </div>

              {items.length === 0 ? (
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  Adicione exercícios à direita para começar.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((it, idx) => (
                    <div
                      key={it.exerciseId}
                      style={{
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 14,
                        background: "rgba(255,255,255,.02)",
                        padding: 12,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 1000 }}>
                          {idx + 1}. {it.name}
                        </div>
                        <button
                          onClick={() => removeExercise(it.exerciseId)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: `1px solid ${COLORS.border}`,
                            background: "transparent",
                            color: COLORS.text,
                            cursor: "pointer",
                            fontWeight: 900,
                          }}
                        >
                          Remover
                        </button>
                      </div>

                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>Séries</div>
                          <input
                            value={it.sets}
                            onChange={(e) => updateItem(it.exerciseId, { sets: e.target.value })}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: `1px solid ${COLORS.border}`,
                              background: "rgba(255,255,255,.03)",
                              color: COLORS.text,
                              outline: "none",
                            }}
                          />
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>Repetições</div>
                          <input
                            value={it.reps}
                            onChange={(e) => updateItem(it.exerciseId, { reps: e.target.value })}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: `1px solid ${COLORS.border}`,
                              background: "rgba(255,255,255,.03)",
                              color: COLORS.text,
                              outline: "none",
                            }}
                          />
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: COLORS.muted }}>Descanso</div>
                          <input
                            value={it.rest}
                            onChange={(e) => updateItem(it.exerciseId, { rest: e.target.value })}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: `1px solid ${COLORS.border}`,
                              background: "rgba(255,255,255,.03)",
                              color: COLORS.text,
                              outline: "none",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ color: COLORS.muted2, fontSize: 12 }}>
                        Vídeo padrão:{" "}
                        <b style={{ color: COLORS.text }}>
                          {EXERCISES.find((e) => e.id === it.exerciseId)?.videoUrl ?? "(definir)"}
                        </b>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal resumo */}
      {showSummary ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setShowSummary(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(920px, 100%)",
              borderRadius: 18,
              border: `1px solid ${COLORS.border}`,
              background: "#121212",
              boxShadow: "0 30px 80px rgba(0,0,0,.65)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: `1px solid ${COLORS.border}`,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>Resumo do treino</div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  Aluno: <b style={{ color: COLORS.text }}>{selectedStudent?.name ?? "—"}</b> • Nome:{" "}
                  <b style={{ color: COLORS.text }}>{workoutName}</b> • Grupo:{" "}
                  <b style={{ color: COLORS.text }}>{selectedGroup}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => setShowSummary(false)}>
                  ↩️ Cancelar
                </Button>
                <Button variant="primary" onClick={confirmWorkout}>
                  ✅ Confirmar
                </Button>
              </div>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={pillStyle(COLORS.orangeSoft, COLORS.orangeBorder)}>
                  Preset: <b>{weekPreset === "semana_util" ? "Semana útil" : `${weekPreset} treinos`}</b>
                </span>
                <span style={pillStyle("rgba(255,255,255,.06)", "rgba(255,255,255,.12)")}>
                  Total: <b>{items.length}</b> exercício(s)
                </span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {items.map((it, idx) => (
                  <div
                    key={it.exerciseId}
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 14,
                      background: "rgba(255,255,255,.02)",
                      padding: 12,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 1000 }}>
                      {idx + 1}. {it.name}
                    </div>
                    <div style={{ color: COLORS.muted, fontSize: 13 }}>
                      Séries: <b style={{ color: COLORS.text }}>{it.sets}</b> • Reps:{" "}
                      <b style={{ color: COLORS.text }}>{it.reps}</b> • Descanso:{" "}
                      <b style={{ color: COLORS.text }}>{it.rest}</b>
                    </div>
                    <div style={{ color: COLORS.muted2, fontSize: 12 }}>
                      Vídeo padrão:{" "}
                      <b style={{ color: COLORS.text }}>
                        {EXERCISES.find((e) => e.id === it.exerciseId)?.videoUrl ?? "(definir)"}
                      </b>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ color: COLORS.muted2, fontSize: 12, lineHeight: 1.35 }}>
                Próximo passo: ao confirmar, salvar no backend e vincular “vídeos padrão” do Storage por `exerciseId`.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
