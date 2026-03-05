import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Plan = "basic" | "silver" | "gold" | "black";
type Gender = "masc" | "fem" | "outro";

type WorkoutLevel = "iniciante" | "intermediario" | "avancado";
type WorkoutGoal = "emagrecimento" | "hipertrofia" | "mobilidade" | "condicionamento";
type Equipment = "sem_peso" | "com_peso";

type WorkoutVisibility = "publico" | "restrito";

type GeneralWorkout = {
  id: string;
  title: string;
  goal: WorkoutGoal;
  level: WorkoutLevel;
  minutes: 10 | 15 | 20 | 30;
  equipment: Equipment;
  visibility: WorkoutVisibility;

  /** 🔥 “Storytelling” pro personal: */
  createdAtISO: string;
  assignedCount: number; // quantos alunos já receberam
};

type Student = {
  id: string;
  name: string;
  plan: Plan;
  gender: Gender;
  age: number;
  level: WorkoutLevel;
  equipmentPreference: Equipment;
  isActive: boolean; // placeholder: aluno ativo/inadimplente/pausado
};

const PLAN_LABEL: Record<Plan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

const GOAL_LABEL: Record<WorkoutGoal, string> = {
  emagrecimento: "Emagrecimento",
  hipertrofia: "Hipertrofia",
  mobilidade: "Mobilidade",
  condicionamento: "Condicionamento",
};

const LEVEL_LABEL: Record<WorkoutLevel, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

function chipBase(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.06)",
    color: "rgba(255,255,255,.92)",
    fontWeight: 900,
    fontSize: 12,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "warn" | "success" | "orange" }) {
  const base = chipBase();
  const toneStyle: Record<string, React.CSSProperties> = {
    warn: { borderColor: "rgba(255,183,3,.35)", background: "rgba(255,183,3,.12)" },
    success: { borderColor: "rgba(34,197,94,.35)", background: "rgba(34,197,94,.12)" },
    orange: { borderColor: "rgba(255,106,0,.35)", background: "rgba(255,106,0,.14)" },
  };

  return <span style={{ ...base, ...(tone ? toneStyle[tone] : {}) }}>{children}</span>;
}

function card(): React.CSSProperties {
  return {
    background: "#171717",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 16,
    boxShadow: "0 18px 44px rgba(0,0,0,.45)",
  };
}

function btnBase(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "transparent",
    color: "#FFFFFF",
    fontWeight: 1000,
    cursor: "pointer",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    ...btnBase(),
    background: "#FF6A00",
    border: "1px solid rgba(255,106,0,.35)",
    color: "#0F0F0F",
    boxShadow: "0 10px 24px rgba(0,0,0,.35)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#0F0F0F",
    color: "#FFFFFF",
    fontWeight: 800,
    outline: "none",
  };
}

/** ✅ util */
function formatDateBR(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

/** ✅ MVP “service” isolado (troca por API depois) */
function mockAssignWorkoutToStudents(workoutId: string, studentIds: string[]) {
  // Aqui no MVP a gente só simula. No backend real:
  // - validar token do personal
  // - checar se cada studentId pertence ao personal (tenant/owner)
  // - registrar audit log (quem distribuiu, quando, quantos)
  // - salvar mapping treino->aluno
  console.log("[assign]", { workoutId, studentIds });
}

export default function WorkoutLibraryPage() {
  const navigate = useNavigate();

  /** ✅ Mock catálogo */
  const workouts: GeneralWorkout[] = useMemo(
    () => [
      {
        id: "gw-01",
        title: "HIIT Iniciante • 15min",
        goal: "emagrecimento",
        level: "iniciante",
        minutes: 15,
        equipment: "sem_peso",
        visibility: "publico",
        createdAtISO: "2026-02-18T10:00:00.000Z",
        assignedCount: 42,
      },
      {
        id: "gw-02",
        title: "Mobilidade + Core • 10min",
        goal: "mobilidade",
        level: "iniciante",
        minutes: 10,
        equipment: "sem_peso",
        visibility: "publico",
        createdAtISO: "2026-02-05T10:00:00.000Z",
        assignedCount: 28,
      },
      {
        id: "gw-03",
        title: "Full Body com Halteres • 20min",
        goal: "hipertrofia",
        level: "intermediario",
        minutes: 20,
        equipment: "com_peso",
        visibility: "restrito",
        createdAtISO: "2026-02-21T10:00:00.000Z",
        assignedCount: 9,
      },
      {
        id: "gw-04",
        title: "Condicionamento • 30min",
        goal: "condicionamento",
        level: "avancado",
        minutes: 30,
        equipment: "com_peso",
        visibility: "restrito",
        createdAtISO: "2026-02-12T10:00:00.000Z",
        assignedCount: 6,
      },
    ],
    []
  );

  /** ✅ Mock alunos (no real: API retorna só alunos do personal logado) */
  const students: Student[] = useMemo(
    () => [
      { id: "1", name: "João Silva", plan: "basic", gender: "masc", age: 22, level: "iniciante", equipmentPreference: "sem_peso", isActive: true },
      { id: "2", name: "Maria Souza", plan: "silver", gender: "fem", age: 29, level: "intermediario", equipmentPreference: "com_peso", isActive: true },
      { id: "3", name: "Pedro Lima", plan: "gold", gender: "masc", age: 35, level: "intermediario", equipmentPreference: "com_peso", isActive: true },
      { id: "4", name: "Ana Costa", plan: "black", gender: "fem", age: 41, level: "avancado", equipmentPreference: "com_peso", isActive: true },
      { id: "5", name: "Bruno Santos", plan: "black", gender: "masc", age: 26, level: "iniciante", equipmentPreference: "sem_peso", isActive: false }, // placeholder: inadimplente/pausado
      { id: "6", name: "Carla Nunes", plan: "silver", gender: "fem", age: 19, level: "iniciante", equipmentPreference: "sem_peso", isActive: true },
    ],
    []
  );

  /** ✅ filtros do catálogo */
  const [q, setQ] = useState("");
  const [goalFilter, setGoalFilter] = useState<"all" | WorkoutGoal>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | WorkoutLevel>("all");
  const [minutesFilter, setMinutesFilter] = useState<"all" | GeneralWorkout["minutes"]>("all");
  const [equipFilter, setEquipFilter] = useState<"all" | Equipment>("all");
  const [visFilter, setVisFilter] = useState<"all" | WorkoutVisibility>("all");

  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      const okQ = q.trim().length === 0 ? true : w.title.toLowerCase().includes(q.trim().toLowerCase());
      const okGoal = goalFilter === "all" ? true : w.goal === goalFilter;
      const okLevel = levelFilter === "all" ? true : w.level === levelFilter;
      const okMin = minutesFilter === "all" ? true : w.minutes === minutesFilter;
      const okEquip = equipFilter === "all" ? true : w.equipment === equipFilter;
      const okVis = visFilter === "all" ? true : w.visibility === visFilter;
      return okQ && okGoal && okLevel && okMin && okEquip && okVis;
    });
  }, [workouts, q, goalFilter, levelFilter, minutesFilter, equipFilter, visFilter]);

  /** ✅ modal distribuir */
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<GeneralWorkout | null>(null);

  // filtros de alunos (distribuição)
  const [planPick, setPlanPick] = useState<Record<Plan, boolean>>({ basic: true, silver: true, gold: true, black: true });
  const [genderPick, setGenderPick] = useState<Record<Gender, boolean>>({ masc: true, fem: true, outro: true });
  const [ageMin, setAgeMin] = useState<number>(16);
  const [ageMax, setAgeMax] = useState<number>(80);
  const [studentLevelPick, setStudentLevelPick] = useState<Record<WorkoutLevel, boolean>>({
    iniciante: true,
    intermediario: true,
    avancado: true,
  });
  const [activeOnly, setActiveOnly] = useState(true);

  const eligibleStudents = useMemo(() => {
    return students.filter((s) => {
      const okPlan = planPick[s.plan];
      const okGender = genderPick[s.gender];
      const okAge = s.age >= ageMin && s.age <= ageMax;
      const okLvl = studentLevelPick[s.level];
      const okActive = activeOnly ? s.isActive : true;
      return okPlan && okGender && okAge && okLvl && okActive;
    });
  }, [students, planPick, genderPick, ageMin, ageMax, studentLevelPick, activeOnly]);

  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});

  function openAssignModal(workout: GeneralWorkout) {
    setSelectedWorkout(workout);
    setAssignOpen(true);

    // ✅ por padrão: pré-seleciona “quem bate com o treino” (UX turbo)
    const auto: Record<string, boolean> = {};
    eligibleStudents.forEach((s) => {
      const matchEquip = s.equipmentPreference === workout.equipment;
      const matchLevel = s.level === workout.level;
      if (matchEquip || matchLevel) auto[s.id] = true;
    });
    setSelectedStudentIds(auto);
  }

  function closeAssignModal() {
    setAssignOpen(false);
    setSelectedWorkout(null);
    setSelectedStudentIds({});
  }

  const selectedCount = useMemo(
    () => Object.values(selectedStudentIds).filter(Boolean).length,
    [selectedStudentIds]
  );

  function toggleAllEligible(value: boolean) {
    const next: Record<string, boolean> = {};
    eligibleStudents.forEach((s) => (next[s.id] = value));
    setSelectedStudentIds(next);
  }

  function quickPickPlans(mode: "all" | "only_black" | "only_paid") {
    if (mode === "all") setPlanPick({ basic: true, silver: true, gold: true, black: true });
    if (mode === "only_black") setPlanPick({ basic: false, silver: false, gold: false, black: true });
    if (mode === "only_paid") setPlanPick({ basic: false, silver: true, gold: true, black: true });
  }

  function handleAssign() {
    if (!selectedWorkout) return;

    const ids = Object.entries(selectedStudentIds)
      .filter(([, v]) => v)
      .map(([id]) => id);

    if (ids.length === 0) {
      alert("Selecione pelo menos 1 aluno para distribuir.");
      return;
    }

    // ✅ MVP: simula persistência
    mockAssignWorkoutToStudents(selectedWorkout.id, ids);

    alert(`Treino "${selectedWorkout.title}" distribuído para ${ids.length} aluno(s).`);
    closeAssignModal();
  }

  return (
    <div style={{ display: "grid", gap: 14, color: "#FFFFFF" }}>
      {/* ✅ Header com storytelling / decisões rápidas */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>Treinos gerais (Netflix)</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 14, lineHeight: 1.35 }}>
              Crie treinos prontos (sequência de vídeos) e distribua em <b>1 clique</b> por plano, perfil e objetivo.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <Chip tone="orange">📦 Catálogo: {workouts.length}</Chip>
              <Chip tone="success">👥 Alunos: {students.length}</Chip>
              <Chip tone="warn">⚡ Distribuição rápida</Chip>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("new")}
              style={btnPrimary()}
              title="Criar um treino geral (sequência de vídeos)"
            >
              + Criar treino geral
            </button>

            <button
              onClick={() => {
                // abre modal “vazio” (personal escolhe o treino dentro do modal)
                setSelectedWorkout(null);
                setAssignOpen(true);
              }}
              style={btnBase()}
              title="Escolha um treino do catálogo e distribua para grupos"
            >
              Distribuir para alunos
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Filtros do catálogo */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar treino (ex: HIIT, mobilidade, halteres...)"
            style={{ ...inputStyle(), minWidth: 260, flex: 1 }}
          />

          <select value={goalFilter} onChange={(e) => setGoalFilter(e.target.value as any)} style={inputStyle()}>
            <option value="all">Objetivo (todos)</option>
            <option value="emagrecimento">Emagrecimento</option>
            <option value="hipertrofia">Hipertrofia</option>
            <option value="mobilidade">Mobilidade</option>
            <option value="condicionamento">Condicionamento</option>
          </select>

          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as any)} style={inputStyle()}>
            <option value="all">Nível (todos)</option>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
            <option value="avancado">Avançado</option>
          </select>

          <select value={minutesFilter} onChange={(e) => setMinutesFilter(e.target.value as any)} style={inputStyle()}>
            <option value="all">Duração</option>
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
          </select>

          <select value={equipFilter} onChange={(e) => setEquipFilter(e.target.value as any)} style={inputStyle()}>
            <option value="all">Equipamento</option>
            <option value="sem_peso">Sem peso</option>
            <option value="com_peso">Com peso</option>
          </select>

          <select value={visFilter} onChange={(e) => setVisFilter(e.target.value as any)} style={inputStyle()}>
            <option value="all">Visibilidade</option>
            <option value="publico">Público</option>
            <option value="restrito">Restrito</option>
          </select>
        </div>

        <div style={{ marginTop: 10, color: "rgba(255,255,255,.65)", fontSize: 13 }}>
          Mostrando <b style={{ color: "#FFFFFF" }}>{filteredWorkouts.length}</b> treino(s) filtrado(s).
        </div>
      </div>

      {/* ✅ Catálogo */}
      <div style={{ display: "grid", gap: 10 }}>
        {filteredWorkouts.map((w) => (
          <div key={w.id} style={{ ...card(), padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>{w.title}</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Chip>{GOAL_LABEL[w.goal]}</Chip>
                  <Chip>{LEVEL_LABEL[w.level]}</Chip>
                  <Chip>{w.minutes} min</Chip>
                  <Chip>{w.equipment === "com_peso" ? "Com peso" : "Sem peso"}</Chip>
                  {w.visibility === "restrito" ? <Chip tone="warn">Restrito</Chip> : <Chip tone="success">Público</Chip>}
                  <Chip tone="orange">Distribuído: {w.assignedCount}</Chip>
                </div>

                <div style={{ color: "rgba(255,255,255,.60)", fontSize: 12 }}>
                  Criado em: <b style={{ color: "#FFFFFF" }}>{formatDateBR(w.createdAtISO)}</b> • ID:{" "}
                  <span style={{ opacity: 0.9 }}>{w.id}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => alert("Editar (placeholder) — Podemos ligar na tela CreateGeneralWorkoutPage depois.")}
                  style={btnBase()}
                >
                  Editar
                </button>

                <button
                  onClick={() => alert("Duplicar (placeholder) — cria uma cópia para editar rápido.")}
                  style={btnBase()}
                >
                  Duplicar
                </button>

                <button onClick={() => openAssignModal(w)} style={btnPrimary()}>
                  Distribuir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ MODAL: Distribuir para alunos */}
      {assignOpen ? (
        <div
          onClick={closeAssignModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(0,0,0,.65)",
            padding: 14,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 980,
              maxHeight: "88dvh",
              overflow: "auto",
              ...card(),
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 1000, fontSize: 18 }}>Distribuir treino para alunos</div>
                <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
                  Selecione um treino e filtre alunos por plano/perfil. <b>Sem vazamento:</b> no backend real, o servidor valida
                  se o aluno pertence ao seu perfil antes de aplicar.
                </div>
              </div>

              <button onClick={closeAssignModal} style={btnBase()}>
                Fechar
              </button>
            </div>

            {/* ✅ Escolha do treino (se abriu pelo botão do topo) */}
            <div style={{ marginTop: 12, ...card(), padding: 14, background: "#141414" }}>
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>1) Escolha o treino</div>

              <select
                value={selectedWorkout?.id ?? "none"}
                onChange={(e) => {
                  const w = workouts.find((x) => x.id === e.target.value) || null;
                  setSelectedWorkout(w);
                }}
                style={{ ...inputStyle(), width: "100%" }}
              >
                <option value="none">Selecione um treino do catálogo…</option>
                {workouts.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
              </select>

              {selectedWorkout ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Chip tone="orange">{GOAL_LABEL[selectedWorkout.goal]}</Chip>
                  <Chip>{LEVEL_LABEL[selectedWorkout.level]}</Chip>
                  <Chip>{selectedWorkout.minutes} min</Chip>
                  <Chip>{selectedWorkout.equipment === "com_peso" ? "Com peso" : "Sem peso"}</Chip>
                </div>
              ) : (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,.65)", fontSize: 13 }}>
                  Dica: clique em “Distribuir” direto no card do treino pra abrir aqui já selecionado.
                </div>
              )}
            </div>

            {/* ✅ Filtros de alunos */}
            <div style={{ marginTop: 12, ...card(), padding: 14, background: "#141414" }}>
              <div style={{ fontWeight: 1000, marginBottom: 10 }}>2) Filtre os alunos (seleção rápida)</div>

              {/* Atalhos */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <button onClick={() => quickPickPlans("all")} style={btnBase()}>
                  Todos os planos
                </button>
                <button onClick={() => quickPickPlans("only_paid")} style={btnBase()}>
                  Somente pagos (Silver+)
                </button>
                <button onClick={() => quickPickPlans("only_black")} style={btnBase()}>
                  Somente Black
                </button>

                <button
                  onClick={() => setActiveOnly((v) => !v)}
                  style={{
                    ...btnBase(),
                    borderColor: activeOnly ? "rgba(255,106,0,.35)" : "rgba(255,255,255,.12)",
                    background: activeOnly ? "rgba(255,106,0,.14)" : "transparent",
                  }}
                >
                  {activeOnly ? "✅ Apenas ativos" : "☐ Incluir inativos"}
                </button>
              </div>

              {/* Grid de filtros */}
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {/* Planos */}
                <div style={{ ...card(), padding: 12, background: "#171717" }}>
                  <div style={{ fontWeight: 1000, marginBottom: 8 }}>Plano</div>
                  {(["basic", "silver", "gold", "black"] as Plan[]).map((p) => (
                    <label key={p} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <input
                        type="checkbox"
                        checked={planPick[p]}
                        onChange={(e) => setPlanPick((prev) => ({ ...prev, [p]: e.target.checked }))}
                      />
                      <span style={{ fontWeight: 900 }}>{PLAN_LABEL[p]}</span>
                    </label>
                  ))}
                </div>

                {/* Gênero */}
                <div style={{ ...card(), padding: 12, background: "#171717" }}>
                  <div style={{ fontWeight: 1000, marginBottom: 8 }}>Gênero</div>
                  {(
                    [
                      { k: "masc", label: "Masculino" },
                      { k: "fem", label: "Feminino" },
                      { k: "outro", label: "Outro" },
                    ] as { k: Gender; label: string }[]
                  ).map((g) => (
                    <label key={g.k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <input
                        type="checkbox"
                        checked={genderPick[g.k]}
                        onChange={(e) => setGenderPick((prev) => ({ ...prev, [g.k]: e.target.checked }))}
                      />
                      <span style={{ fontWeight: 900 }}>{g.label}</span>
                    </label>
                  ))}
                </div>

                {/* Idade */}
                <div style={{ ...card(), padding: 12, background: "#171717" }}>
                  <div style={{ fontWeight: 1000, marginBottom: 8 }}>Faixa etária</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="number"
                      value={ageMin}
                      onChange={(e) => setAgeMin(Number(e.target.value))}
                      style={{ ...inputStyle(), width: 110 }}
                      min={10}
                      max={99}
                    />
                    <span style={{ color: "rgba(255,255,255,.70)", fontWeight: 900 }}>até</span>
                    <input
                      type="number"
                      value={ageMax}
                      onChange={(e) => setAgeMax(Number(e.target.value))}
                      style={{ ...inputStyle(), width: 110 }}
                      min={10}
                      max={99}
                    />
                  </div>
                  <div style={{ marginTop: 8, color: "rgba(255,255,255,.65)", fontSize: 12 }}>
                    Dica: deixe 16–80 e refine depois.
                  </div>
                </div>

                {/* Nível */}
                <div style={{ ...card(), padding: 12, background: "#171717" }}>
                  <div style={{ fontWeight: 1000, marginBottom: 8 }}>Nível</div>
                  {(["iniciante", "intermediario", "avancado"] as WorkoutLevel[]).map((lv) => (
                    <label key={lv} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <input
                        type="checkbox"
                        checked={studentLevelPick[lv]}
                        onChange={(e) => setStudentLevelPick((prev) => ({ ...prev, [lv]: e.target.checked }))}
                      />
                      <span style={{ fontWeight: 900 }}>{LEVEL_LABEL[lv]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ✅ Lista de alunos elegíveis */}
            <div style={{ marginTop: 12, ...card(), padding: 14, background: "#141414" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 1000 }}>3) Selecione os alunos</div>
                  <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
                    Elegíveis pelo filtro: <b style={{ color: "#FFFFFF" }}>{eligibleStudents.length}</b> • Selecionados:{" "}
                    <b style={{ color: "#FF6A00" }}>{selectedCount}</b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => toggleAllEligible(true)} style={btnBase()}>
                    Selecionar todos
                  </button>
                  <button onClick={() => toggleAllEligible(false)} style={btnBase()}>
                    Limpar seleção
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {eligibleStudents.map((s) => {
                  const checked = !!selectedStudentIds[s.id];
                  return (
                    <div
                      key={s.id}
                      style={{
                        ...card(),
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setSelectedStudentIds((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                        />

                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 1000 }}>{s.name}</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Chip>{PLAN_LABEL[s.plan]}</Chip>
                            <Chip>{s.age} anos</Chip>
                            <Chip>{LEVEL_LABEL[s.level]}</Chip>
                            <Chip>{s.gender === "masc" ? "Masculino" : s.gender === "fem" ? "Feminino" : "Outro"}</Chip>
                            <Chip>{s.equipmentPreference === "com_peso" ? "Curte com peso" : "Curte sem peso"}</Chip>
                            {s.isActive ? <Chip tone="success">Ativo</Chip> : <Chip tone="warn">Inativo</Chip>}
                          </div>
                        </div>
                      </label>

                      <button
                        onClick={() => alert("Abrir perfil do aluno (placeholder)")}
                        style={btnBase()}
                        title="Atalho para ver detalhes"
                      >
                        Ver aluno
                      </button>
                    </div>
                  );
                })}

                {eligibleStudents.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,.70)", fontWeight: 900, padding: 10 }}>
                    Nenhum aluno encontrado com esses filtros. Ajuste plano, idade ou nível.
                  </div>
                ) : null}
              </div>
            </div>

            {/* ✅ Footer do modal */}
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
                ✅ Sugestão: distribua por objetivo e depois acompanhe check-ins na Dashboard.
              </div>

              <button
                onClick={handleAssign}
                style={btnPrimary()}
                disabled={!selectedWorkout}
                title={!selectedWorkout ? "Selecione um treino primeiro" : "Distribuir agora"}
              >
                Distribuir agora
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}