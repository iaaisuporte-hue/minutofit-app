import { useEffect, useMemo, useState } from "react";

/**
 * ==========================================
 * ✅ REVIEW WORKOUTS (Personal) — Treinaí UI
 * ==========================================
 * O que essa tela resolve:
 * - Personal abre e enxerga a “fila” de revisões
 * - Decide rápido: aprova / pede ajuste / arquiva
 * - Prioriza quem está parado, quem é urgente e quem é Black
 *
 * MVP:
 * - Dados mock
 * - Pode persistir em localStorage (ligado abaixo)
 */

/** ✅ Ative/desative persistência (MVP) */
const USE_PERSISTENCE = true;
const STORAGE_KEY = "treinai_review_queue_v1";

type Plan = "basic" | "silver" | "gold" | "black";

type ReviewStatus = "pending" | "changes_requested" | "approved" | "archived";

/** ✅ Item da fila */
type ReviewItem = {
  id: string;
  studentId: string;
  studentName: string;
  plan: Plan;

  title: string; // ex: "Treino A (Perna) - Semana 2"
  goal: "hipertrofia" | "emagrecimento" | "forca" | "condicionamento";
  createdAt: string; // ISO
  updatedAt: string; // ISO

  status: ReviewStatus;

  /** ✅ Sinais pro personal decidir rápido */
  risk: "low" | "medium" | "high"; // “alta chance de dar ruim”
  priority: "low" | "normal" | "high"; // urgência operacional
  lastCheckinAt?: string; // ISO (se o aluno está sumido)

  notes?: string; // observações do personal
  lastFeedback?: string; // último feedback enviado ao aluno (quando devolve)
};

function nowISO() {
  return new Date().toISOString();
}

/** ✅ Helpers de datas */
function hoursBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.round((b - a) / (1000 * 60 * 60));
}

function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

/** ✅ UI: Card base (mesmo padrão das telas Treinaí) */
function Card({ children, pad = 16 }: { children: React.ReactNode; pad?: number }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.10)", // ✅ (UI) borda padrão
        borderRadius: 16, // ✅ (UI) arredondamento padrão
        background: "#171717", // ✅ (UI) fundo padrão
        boxShadow: "0 18px 44px rgba(0,0,0,.45)", // ✅ (UI) sombra padrão
        overflow: "hidden",
      }}
    >
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

/** ✅ UI: Pill/Badge */
function Pill({
  children,
  variant = "neutral",
  title,
}: {
  children: React.ReactNode;
  variant?: "neutral" | "orange" | "success" | "warn" | "danger";
  title?: string;
}) {
  const map = {
    neutral: { bd: "rgba(255,255,255,.12)", bg: "rgba(255,255,255,.06)" },
    orange: { bd: "rgba(255,106,0,.35)", bg: "rgba(255,106,0,.14)" },
    success: { bd: "rgba(34,197,94,.35)", bg: "rgba(34,197,94,.12)" },
    warn: { bd: "rgba(255,183,3,.35)", bg: "rgba(255,183,3,.12)" },
    danger: { bd: "rgba(220,38,38,.35)", bg: "rgba(220,38,38,.12)" },
  } as const;

  return (
    <span
      title={title}
      style={{
        padding: "6px 10px", // ✅ (UI) “tamanho do chip”
        borderRadius: 999,
        border: `1px solid ${map[variant].bd}`,
        background: map[variant].bg,
        color: "#FFFFFF",
        fontWeight: 900,
        fontSize: 12,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        width: "fit-content",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** ✅ UI: Button base */
function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const stylesByVariant: Record<typeof variant, React.CSSProperties> = {
    primary: {
      background: "#FF6A00",
      border: "1px solid rgba(255,106,0,.35)",
      color: "#0F0F0F",
      boxShadow: "0 10px 24px rgba(0,0,0,.35)",
    },
    ghost: {
      background: "transparent",
      border: "1px solid rgba(255,255,255,.12)",
      color: "#FFFFFF",
    },
    danger: {
      background: "rgba(220,38,38,.16)",
      border: "1px solid rgba(220,38,38,.35)",
      color: "#FFFFFF",
    },
  };

  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "12px 14px", // ✅ (UI) tamanho padrão
        borderRadius: 12, // ✅ (UI) bordas padrão
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 1000,
        fontSize: 14,
        opacity: disabled ? 0.6 : 1,
        ...stylesByVariant[variant],
      }}
    >
      {children}
    </button>
  );
}

/** ✅ Status label */
function statusLabel(s: ReviewStatus) {
  if (s === "pending") return "Pendente";
  if (s === "changes_requested") return "Ajustes solicitados";
  if (s === "approved") return "Aprovado";
  return "Arquivado";
}

function statusVariant(s: ReviewStatus): "neutral" | "warn" | "success" | "danger" {
  if (s === "pending") return "warn";
  if (s === "changes_requested") return "danger";
  if (s === "approved") return "success";
  return "neutral";
}

function planPill(plan: Plan) {
  if (plan === "black") return <Pill variant="orange">🟧 Black</Pill>;
  if (plan === "gold") return <Pill variant="neutral">Gold</Pill>;
  if (plan === "silver") return <Pill variant="neutral">Silver</Pill>;
  return <Pill variant="neutral">Básico</Pill>;
}

/** ✅ Mock base */
function makeMock(): ReviewItem[] {
  const minusH = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
  const minusD = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString();

  return [
    {
      id: "r1",
      studentId: "16",
      studentName: "Natália Freitas",
      plan: "black",
      title: "Semana 2 • Treino A (Perna) + ajustes de carga",
      goal: "hipertrofia",
      createdAt: minusH(36),
      updatedAt: minusH(10),
      status: "pending",
      risk: "medium",
      priority: "high",
      lastCheckinAt: minusD(3),
      notes: "Foco em técnica no leg press. Atenção ao joelho.",
    },
    {
      id: "r2",
      studentId: "20",
      studentName: "Sabrina Cardoso",
      plan: "black",
      title: "Revisão • Ficha de recomeço (10 treinos)",
      goal: "emagrecimento",
      createdAt: minusH(70),
      updatedAt: minusH(70),
      status: "pending",
      risk: "high",
      priority: "high",
      lastCheckinAt: minusD(7),
      notes: "Aluna voltou agora. Ajustar volume pra não gerar DOMS forte.",
    },
    {
      id: "r3",
      studentId: "11",
      studentName: "Gustavo Araújo",
      plan: "gold",
      title: "Treino B (Superior) • Semana 1",
      goal: "forca",
      createdAt: minusH(12),
      updatedAt: minusH(12),
      status: "pending",
      risk: "low",
      priority: "normal",
      lastCheckinAt: minusD(1),
    },
    {
      id: "r4",
      studentId: "7",
      studentName: "Carla Nunes",
      plan: "silver",
      title: "Treino em casa • Progressão 20min HIIT",
      goal: "condicionamento",
      createdAt: minusD(2),
      updatedAt: minusD(1),
      status: "changes_requested",
      risk: "medium",
      priority: "normal",
      lastCheckinAt: minusD(5),
      lastFeedback: "Incluí descanso maior e troquei burpee por opção low-impact.",
    },
    {
      id: "r5",
      studentId: "3",
      studentName: "Pedro Lima",
      plan: "basic",
      title: "Treino em casa • Mobilidade + Core (10min)",
      goal: "condicionamento",
      createdAt: minusD(1),
      updatedAt: minusH(2),
      status: "approved",
      risk: "low",
      priority: "low",
      lastCheckinAt: minusD(0),
    },
  ];
}

/** ✅ Persistência */
function loadQueue(): ReviewItem[] {
  if (!USE_PERSISTENCE) return makeMock();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeMock();
    return JSON.parse(raw) as ReviewItem[];
  } catch {
    return makeMock();
  }
}

function saveQueue(list: ReviewItem[]) {
  if (!USE_PERSISTENCE) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** ✅ Decide “urgência” (storytelling) */
function isUrgent(item: ReviewItem) {
  // ✅ (REGRA) urgente se > 48h e ainda pendente
  const ageH = hoursBetween(item.createdAt, nowISO());
  return item.status === "pending" && ageH >= 48;
}

export default function ReviewWorkoutsPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("pending");
  const [planFilter, setPlanFilter] = useState<"all" | Plan>("all");
  const [sort, setSort] = useState<"priority" | "recent">("priority");

  /** ✅ Modal/drawer */
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const initial = loadQueue();
    setQueue(initial);
  }, []);

  /** ✅ KPIs */
  const kpis = useMemo(() => {
    const pending = queue.filter((q) => q.status === "pending").length;
    const urgent = queue.filter((q) => isUrgent(q)).length;

    const approvedToday = queue.filter((q) => {
      if (q.status !== "approved") return false;
      return daysBetween(new Date().toISOString(), q.updatedAt) === 0;
    }).length;

    const returned = queue.filter((q) => q.status === "changes_requested").length;

    return { pending, urgent, approvedToday, returned };
  }, [queue]);

  /** ✅ Filtrado */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = queue.slice();

    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (planFilter !== "all") list = list.filter((i) => i.plan === planFilter);

    if (q) {
      list = list.filter((i) => {
        const hay = `${i.studentName} ${i.title} ${i.goal} ${i.plan}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // ✅ Ordenação
    list.sort((a, b) => {
      if (sort === "recent") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

      // priority
      const score = (x: ReviewItem) => {
        let s = 0;
        if (x.status === "pending") s += 100;
        if (isUrgent(x)) s += 80;
        if (x.priority === "high") s += 40;
        if (x.plan === "black") s += 25;
        if (x.risk === "high") s += 20;
        return s;
      };
      return score(b) - score(a);
    });

    return list;
  }, [queue, query, statusFilter, planFilter, sort]);

  const selected = useMemo(() => queue.find((x) => x.id === openId) || null, [queue, openId]);

  /** ✅ Abrir modal (carrega campos) */
  function open(item: ReviewItem) {
    setOpenId(item.id);
    setFeedback(item.lastFeedback || "");
    setNotes(item.notes || "");
  }

  function close() {
    setOpenId(null);
    setFeedback("");
    setNotes("");
  }

  /** ✅ Actions */
  function updateItem(id: string, patch: Partial<ReviewItem>) {
    const next = queue.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: nowISO() } : x));
    setQueue(next);
    saveQueue(next);
  }

  function approve(id: string) {
    updateItem(id, { status: "approved" });
    close();
  }

  function requestChanges(id: string) {
    updateItem(id, { status: "changes_requested", lastFeedback: feedback.trim() || "Ajustar detalhes da ficha." });
    close();
  }

  function archive(id: string) {
    updateItem(id, { status: "archived" });
    close();
  }

  function saveNotesOnly(id: string) {
    updateItem(id, { notes: notes });
  }

  return (
    <div style={{ display: "grid", gap: 16, color: "#FFFFFF" }}>
      {/* ✅ Header */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Revisão de Treinos</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
              Fila operacional: priorize <b>pendências antigas</b>, alunos <b>Black</b> e casos de <b>risco</b>.
            </div>
          </div>

          <Pill variant="orange" title="Padrão Treinaí">
            🟧 Treinaí • Review Queue
          </Pill>
        </div>
      </Card>

      {/* ✅ KPIs */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        }}
      >
        <Card>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900, fontSize: 12 }}>PENDENTES</div>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{kpis.pending}</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
              Itens aguardando sua aprovação.
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900, fontSize: 12 }}>URGENTES (48h+)</div>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{kpis.urgent}</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
              Priorize para evitar aluno “sumir”.
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900, fontSize: 12 }}>APROVADOS HOJE</div>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{kpis.approvedToday}</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
              Ritmo do dia (produção).
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900, fontSize: 12 }}>DEVOLVIDOS</div>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{kpis.returned}</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
              Itens aguardando ajuste do aluno.
            </div>
          </div>
        </Card>
      </div>

      {/* ✅ Toolbar: busca + filtros */}
      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por aluno, título, objetivo…"
            style={{
              flex: 1,
              minWidth: 240,

              // ✅ (UI) input padrão Treinaí
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: "#121212",
              color: "#FFFFFF",
              outline: "none",
              fontWeight: 800,
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: "#121212",
              color: "#FFFFFF",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            <option value="pending">Pendentes</option>
            <option value="all">Todos</option>
            <option value="approved">Aprovados</option>
            <option value="changes_requested">Ajustes solicitados</option>
            <option value="archived">Arquivados</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as any)}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: "#121212",
              color: "#FFFFFF",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            <option value="all">Todos os planos</option>
            <option value="basic">Básico</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="black">Black</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: "#121212",
              color: "#FFFFFF",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            <option value="priority">Ordenar: Prioridade</option>
            <option value="recent">Ordenar: Mais recente</option>
          </select>
        </div>
      </Card>

      {/* ✅ Fila */}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 ? (
          <Card>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
              Nenhum item para revisar com esses filtros.
            </div>
          </Card>
        ) : (
          filtered.map((item) => {
            const urgent = isUrgent(item);
            const ageH = hoursBetween(item.createdAt, nowISO());
            const inactiveDays = item.lastCheckinAt ? daysBetween(item.lastCheckinAt, nowISO()) : null;

            const riskVariant = item.risk === "high" ? "danger" : item.risk === "medium" ? "warn" : "neutral";
            const priVariant = item.priority === "high" ? "warn" : "neutral";

            return (
              <div
                key={item.id}
                style={{
                  border: "1px solid rgba(255,255,255,.10)",
                  borderRadius: 16,
                  background: "#171717",
                  boxShadow: "0 18px 44px rgba(0,0,0,.45)",
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {/* ✅ Left */}
                <div style={{ display: "grid", gap: 8, minWidth: 320 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 1000, fontSize: 15 }}>{item.studentName}</div>
                    {planPill(item.plan)}
                    <Pill variant={statusVariant(item.status)}>{statusLabel(item.status)}</Pill>

                    {urgent ? (
                      <Pill variant="danger" title="Mais de 48h pendente">
                        ⏱️ Urgente
                      </Pill>
                    ) : null}

                    <Pill variant={priVariant as any} title="Prioridade operacional">
                      ⭐ {item.priority}
                    </Pill>

                    <Pill variant={riskVariant as any} title="Risco de execução">
                      ⚠️ risco {item.risk}
                    </Pill>
                  </div>

                  <div style={{ color: "#FFFFFF", fontWeight: 900 }}>
                    {item.title}
                  </div>

                  <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
                    Objetivo: <b style={{ color: "#FFFFFF" }}>{item.goal}</b> • Criado há <b>{ageH}h</b>
                    {inactiveDays != null ? (
                      <>
                        {" "}
                        • Último check-in: <b>{inactiveDays} dia(s)</b>
                      </>
                    ) : null}
                  </div>

                  {item.notes ? (
                    <div style={{ color: "rgba(255,255,255,.65)", fontSize: 13, lineHeight: 1.35 }}>
                      📝 Nota: {item.notes}
                    </div>
                  ) : null}
                </div>

                {/* ✅ Right actions */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button variant="ghost" onClick={() => open(item)}>
                    Revisar
                  </Button>

                  {item.status === "pending" ? (
                    <Button variant="primary" onClick={() => approve(item.id)}>
                      Aprovar rápido
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => open(item)}>
                      Abrir detalhes
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ✅ Modal/Drawer simples */}
      {selected ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.60)",
            display: "grid",
            placeItems: "center",
            padding: 18,
            zIndex: 50,
          }}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 860,
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,.10)",
              background: "#141414",
              boxShadow: "0 22px 70px rgba(0,0,0,.55)",
              overflow: "hidden",
            }}
          >
            {/* Header modal */}
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid rgba(255,255,255,.10)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>
                  Revisão • {selected.studentName}
                </div>
                <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12 }}>
                  Criado: <b style={{ color: "#fff" }}>{formatDateTimeBR(selected.createdAt)}</b> • Atualizado:{" "}
                  <b style={{ color: "#fff" }}>{formatDateTimeBR(selected.updatedAt)}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {planPill(selected.plan)}
                <Pill variant={statusVariant(selected.status)}>{statusLabel(selected.status)}</Pill>
              </div>
            </div>

            {/* Body modal */}
            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              <Card>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 1000 }}>{selected.title}</div>
                  <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
                    Objetivo: <b style={{ color: "#fff" }}>{selected.goal}</b> • Risco:{" "}
                    <b style={{ color: "#fff" }}>{selected.risk}</b> • Prioridade:{" "}
                    <b style={{ color: "#fff" }}>{selected.priority}</b>
                  </div>
                </div>
              </Card>

              {/* ✅ Notes */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 1000, fontSize: 13 }}>📝 Observações internas (só personal)</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Ajustar volume, trocar exercício por alternativa, atenção a dor no joelho…"
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "none",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#121212",
                    color: "#FFFFFF",
                    outline: "none",
                    fontWeight: 700,
                    lineHeight: 1.35,
                  }}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      saveNotesOnly(selected.id);
                    }}
                    title="Salva apenas as observações internas"
                  >
                    Salvar observações
                  </Button>
                </div>
              </div>

              {/* ✅ Feedback ao aluno (quando devolve) */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 1000, fontSize: 13 }}>📩 Feedback para o aluno (quando pedir ajustes)</div>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ex: Ajustei descanso, reduzi volume, manda um feedback de como sentiu…"
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "none",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#121212",
                    color: "#FFFFFF",
                    outline: "none",
                    fontWeight: 700,
                    lineHeight: 1.35,
                  }}
                />
                {selected.lastFeedback ? (
                  <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12, lineHeight: 1.35 }}>
                    Último feedback enviado: <b style={{ color: "#fff" }}>{selected.lastFeedback}</b>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer modal */}
            <div
              style={{
                padding: 16,
                borderTop: "1px solid rgba(255,255,255,.10)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={close}>
                  Fechar
                </Button>

                <Button
                  variant="danger"
                  onClick={() => archive(selected.id)}
                  title="Arquiva (some da fila principal, mas fica salvo)"
                >
                  Arquivar
                </Button>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button
                  variant="ghost"
                  onClick={() => requestChanges(selected.id)}
                  title="Devolve para o aluno com feedback"
                  disabled={selected.status === "archived"}
                >
                  Pedir ajustes
                </Button>

                <Button
                  variant="primary"
                  onClick={() => approve(selected.id)}
                  title="Aprova o treino"
                  disabled={selected.status === "archived"}
                >
                  Aprovar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}