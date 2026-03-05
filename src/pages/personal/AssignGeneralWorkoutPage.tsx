import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const LS_CATALOG = "generalWorkoutsCatalog_v1";
const LS_ASSIGNMENTS = "generalWorkoutsAssignments_v1";

type Plan = "basic" | "silver" | "gold" | "black";
type Gender = "masc" | "fem" | "outro";
type WorkoutLevel = "iniciante" | "intermediario" | "avancado";
type Equipment = "sem_peso" | "com_peso";

type VideoItem =
  | { id: string; kind: "youtube"; title?: string; url: string }
  | { id: string; kind: "upload"; title?: string; fileName: string; mimeType: string; objectUrl: string };

type GeneralWorkout = {
  id: string;
  title: string;
  description: string;

  goal: string;
  level: WorkoutLevel;
  minutes: number;
  equipment: Equipment;
  visibility: string;

  videos: VideoItem[];

  createdAtISO: string;
  updatedAtISO: string;

  assignedCount: number;
};

type Student = {
  id: string;
  name: string;
  plan: Plan;
  gender: Gender;
  age: number;
  level: WorkoutLevel;
  equipmentPreference: Equipment;
  isActive: boolean;
};

type Assignment = {
  id: string;
  workoutId: string;
  studentIds: string[];
  createdAtISO: string;

  // ✅ "audit" básico (fase MVP)
  assignedBy: "personal_mock";
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** ✅ UI base (mesma identidade) */
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

function hint(): React.CSSProperties {
  return { color: "rgba(255,255,255,.65)", fontSize: 13, lineHeight: 1.35 };
}

/** ✅ Storage */
function loadCatalog(): GeneralWorkout[] {
  try {
    const raw = localStorage.getItem(LS_CATALOG);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCatalog(items: GeneralWorkout[]) {
  localStorage.setItem(LS_CATALOG, JSON.stringify(items));
}

function loadAssignments(): Assignment[] {
  try {
    const raw = localStorage.getItem(LS_ASSIGNMENTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAssignments(items: Assignment[]) {
  localStorage.setItem(LS_ASSIGNMENTS, JSON.stringify(items));
}

export default function AssignGeneralWorkoutPage() {
  const navigate = useNavigate();

  /** ✅ Catálogo real (localStorage) */
  const catalog = useMemo(() => loadCatalog(), []);

  /** ✅ Mock alunos (trocar por API depois) */
  const students: Student[] = useMemo(
    () => [
      { id: "1", name: "João Silva", plan: "basic", gender: "masc", age: 22, level: "iniciante", equipmentPreference: "sem_peso", isActive: true },
      { id: "2", name: "Maria Souza", plan: "silver", gender: "fem", age: 29, level: "intermediario", equipmentPreference: "com_peso", isActive: true },
      { id: "3", name: "Pedro Lima", plan: "gold", gender: "masc", age: 35, level: "intermediario", equipmentPreference: "com_peso", isActive: true },
      { id: "4", name: "Ana Costa", plan: "black", gender: "fem", age: 41, level: "avancado", equipmentPreference: "com_peso", isActive: true },
      { id: "5", name: "Bruno Santos", plan: "black", gender: "masc", age: 26, level: "iniciante", equipmentPreference: "sem_peso", isActive: false },
      { id: "6", name: "Carla Nunes", plan: "silver", gender: "fem", age: 19, level: "iniciante", equipmentPreference: "sem_peso", isActive: true },
    ],
    []
  );

  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>(catalog[0]?.id ?? "");
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({});

  // ✅ filtros rápidos (pra seleção em massa)
  const [activeOnly, setActiveOnly] = useState(true);
  const [planFilter, setPlanFilter] = useState<"all" | Plan>("all");

  const eligibleStudents = useMemo(() => {
    return students.filter((s) => {
      const okActive = activeOnly ? s.isActive : true;
      const okPlan = planFilter === "all" ? true : s.plan === planFilter;
      return okActive && okPlan;
    });
  }, [students, activeOnly, planFilter]);

  const selectedCount = useMemo(() => Object.values(selectedStudents).filter(Boolean).length, [selectedStudents]);

  function toggleStudent(id: string) {
    setSelectedStudents((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAllEligible(value: boolean) {
    const next: Record<string, boolean> = {};
    eligibleStudents.forEach((s) => (next[s.id] = value));
    setSelectedStudents(next);
  }

  function assign() {
    if (!selectedWorkoutId) {
      alert("Selecione um treino do catálogo.");
      return;
    }

    const ids = Object.entries(selectedStudents)
      .filter(([, v]) => v)
      .map(([id]) => id);

    if (ids.length === 0) {
      alert("Selecione pelo menos 1 aluno.");
      return;
    }

    // ✅ salva assignment (audit simples)
    const now = new Date().toISOString();
    const newAssignment: Assignment = {
      id: `as-${uid()}`,
      workoutId: selectedWorkoutId,
      studentIds: ids,
      createdAtISO: now,
      assignedBy: "personal_mock",
    };

    const history = loadAssignments();
    saveAssignments([newAssignment, ...history]);

    // ✅ incrementa assignedCount no catálogo (pra aparecer na Library)
    const cat = loadCatalog();
    const idx = cat.findIndex((w) => w.id === selectedWorkoutId);
    if (idx >= 0) {
      cat[idx] = {
        ...cat[idx],
        assignedCount: (cat[idx].assignedCount ?? 0) + ids.length,
        updatedAtISO: now,
      };
      saveCatalog(cat);
    }

    alert(`Distribuído ✅ (${ids.length} aluno(s))`);
    navigate("/app/personal/library");
  }

  if (catalog.length === 0) {
    return (
      <div style={{ display: "grid", gap: 14, color: "#FFFFFF" }}>
        <div style={{ ...card(), padding: 16 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Distribuir treino geral</div>
          <div style={hint()}>Você ainda não tem treinos no catálogo.</div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => navigate("/app/personal/library/new")} style={btnPrimary()}>
              + Criar treino geral
            </button>
            <button onClick={() => navigate(-1)} style={btnBase()}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, color: "#FFFFFF" }}>
      {/* ✅ Header */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Distribuir treino geral</div>
            <div style={hint()}>
              Selecione o treino e escolha o público. (Na fase backend, o servidor valida que esses alunos pertencem ao personal.)
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => navigate(-1)} style={btnBase()}>
              Voltar
            </button>
            <button onClick={assign} style={btnPrimary()}>
              Distribuir agora
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Seleção do treino */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>1) Escolha o treino</div>

        <select value={selectedWorkoutId} onChange={(e) => setSelectedWorkoutId(e.target.value)} style={{ ...inputStyle(), width: "100%" }}>
          {catalog.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 10, ...hint() }}>
          Dica: se quiser UX “turbo”, distribua direto pelo botão “Distribuir” dentro da Library.
        </div>
      </div>

      {/* ✅ Filtros rápidos */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>2) Filtre o público</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as any)} style={inputStyle()}>
            <option value="all">Todos os planos</option>
            <option value="basic">Básico</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="black">Black</option>
          </select>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => selectAllEligible(true)} style={btnBase()}>
              Selecionar todos
            </button>
            <button onClick={() => selectAllEligible(false)} style={btnBase()}>
              Limpar
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, ...hint() }}>
          Elegíveis: <b style={{ color: "#FFFFFF" }}>{eligibleStudents.length}</b> • Selecionados:{" "}
          <b style={{ color: "#FF6A00" }}>{selectedCount}</b>
        </div>
      </div>

      {/* ✅ Lista de alunos */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>3) Selecione os alunos</div>

        <div style={{ display: "grid", gap: 10 }}>
          {eligibleStudents.map((s) => {
            const checked = !!selectedStudents[s.id];
            return (
              <label
                key={s.id}
                style={{
                  ...card(),
                  padding: 12,
                  background: "#141414",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleStudent(s.id)} />
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 1000 }}>{s.name}</div>
                  <div style={hint()}>
                    Plano: <b style={{ color: "#FFFFFF" }}>{s.plan}</b> • {s.age} anos • {s.gender} •{" "}
                    {s.isActive ? "Ativo" : "Inativo"}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* ✅ Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <button onClick={assign} style={btnPrimary()}>
          Distribuir agora
        </button>
      </div>
    </div>
  );
}