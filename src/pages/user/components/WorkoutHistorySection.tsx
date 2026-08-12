import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWorkoutSessionDetail,
  listWorkoutSessionsPage,
  type WorkoutSessionDetail,
  type WorkoutSessionListItem,
  type WorkoutSessionStatus,
  type WorkoutSessionSource,
  type ReadinessLevel,
} from "../../../services/workoutSessionApi";
import { useFeatureFlags } from "../../../auth/FeatureFlagsContext";

// Histórico de treinos executados (P1-1). Lê GET /training/sessions — a fonte
// canônica desde o write-through do P0-1 — e mostra cada sessão com detalhe por
// série sob demanda. Some quando não há sessão (não polui a Evolução do
// iniciante). Não é rota nova: seção auto-contida na Evolução, como a
// WorkoutProgressSection.

const STATUS_META: Record<WorkoutSessionStatus, { label: string; color: string }> = {
  completed: { label: "Concluído", color: "var(--color-success-text, #5E7412)" },
  partial: { label: "Parcial", color: "var(--color-warn, #D97706)" },
  abandoned: { label: "Incompleto", color: "var(--color-text-muted, var(--color-text-muted))" },
  started: { label: "Em andamento", color: "var(--color-text-muted, var(--color-text-muted))" },
};

const SOURCE_LABEL: Record<WorkoutSessionSource, string> = {
  personal: "Ficha do personal",
  suggested: "Treino sugerido",
  academy: "Academia",
  free: "Treino livre",
  movement_lab: "Lab de Movimento",
  user_retroactive: "Registro retroativo",
};

const READINESS_COLOR: Record<ReadinessLevel, string> = {
  green: "var(--color-success-text, #5E7412)",
  yellow: "var(--color-warn, #D97706)",
  red: "var(--color-danger, #DC2626)",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function StatusPill({ status }: { status: WorkoutSessionStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: meta.color,
        border: `1px solid ${meta.color}`,
        borderRadius: "var(--radius-full, 999px)",
        padding: "2px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

function SetsDetail({ detail }: { detail: WorkoutSessionDetail }) {
  if (detail.sets.length === 0) {
    return <p className="metabolic-section-copy">Sessão registrada sem detalhe de séries.</p>;
  }
  // Agrupa séries consecutivas pelo mesmo exercício (backend já ordena por
  // order_index, set_index).
  const groups: { name: string; sets: WorkoutSessionDetail["sets"] }[] = [];
  for (const s of detail.sets) {
    const last = groups[groups.length - 1];
    if (last && last.name === s.exerciseName) last.sets.push(s);
    else groups.push({ name: s.exerciseName, sets: [s] });
  }

  return (
    <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
      {groups.map((g, gi) => {
        const hadDiscomfort = g.sets.some((s) => s.discomfort);
        return (
        <div key={gi} style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ color: "var(--color-text)", fontSize: 14 }}>{g.name}</strong>
            {hadDiscomfort && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-warn, #D97706)",
                  border: "1px solid var(--color-warn, #D97706)",
                  borderRadius: "var(--radius-full, 999px)",
                  padding: "1px 8px",
                }}
              >
                desconforto
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {g.sets.map((s, si) => {
              const reps = s.repsDone != null ? `${s.repsDone}` : s.plannedReps ?? "—";
              const load = s.loadDoneKg != null ? ` × ${s.loadDoneKg} kg` : "";
              const skipped = s.status === "skipped";
              return (
                <span
                  key={si}
                  className="metabolic-eyebrow"
                  style={{
                    color: skipped ? "var(--color-text-muted, var(--color-text-muted))" : "var(--color-text-soft, #4B5563)",
                    textDecoration: skipped ? "line-through" : "none",
                  }}
                >
                  Série {s.setIndex} · {reps} reps{load}
                  {s.rpe != null ? ` · RPE ${s.rpe}` : ""}
                  {skipped ? " · pulada" : ""}
                </span>
              );
            })}
          </div>
        </div>
        );
      })}
      {detail.notes ? (
        <p className="metabolic-section-copy" style={{ fontStyle: "italic" }}>
          “{detail.notes}”
        </p>
      ) : null}
    </div>
  );
}

function SessionRow({ session }: { session: WorkoutSessionListItem }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail && !loadingDetail) {
      setLoadingDetail(true);
      const d = await getWorkoutSessionDetail(session.id);
      setDetail(d);
      setLoadingDetail(false);
    }
  }

  const metaParts = [SOURCE_LABEL[session.source]];
  if (session.sessionRpe != null) metaParts.push(`Esforço ${session.sessionRpe}/10`);

  return (
    <article className="metabolic-history-item" style={{ display: "grid", gap: 6 }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {session.readinessLevel && (
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: READINESS_COLOR[session.readinessLevel],
                  flexShrink: 0,
                }}
              />
            )}
            <strong
              style={{
                color: "var(--color-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {session.title || "Treino"}
            </strong>
            {session.isRetroactive && (
              <span
                title="Registrado pelo aluno após o dia do treino"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-text-muted, var(--color-text-muted))",
                  border: "1px solid var(--color-border, var(--color-border))",
                  borderRadius: "var(--radius-full, 999px)",
                  padding: "1px 8px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Registrado retroativamente
              </span>
            )}
          </div>
          <span className="metabolic-eyebrow">
            {formatDate(session.performedAt)} · {metaParts.join(" · ")}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <StatusPill status={session.status} />
          <span className="metabolic-eyebrow">{session.setsDone} séries · toque</span>
        </div>
      </button>

      {open &&
        (loadingDetail ? (
          <p className="metabolic-section-copy">Carregando séries...</p>
        ) : detail ? (
          <SetsDetail detail={detail} />
        ) : (
          <p className="metabolic-section-copy">Não foi possível carregar o detalhe.</p>
        ))}
    </article>
  );
}

function RetroEntryButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/app/user/registrar-treino-anterior")}
      style={{
        justifySelf: "start",
        padding: "8px 14px",
        borderRadius: "var(--radius-full, 999px)",
        border: "1px solid var(--color-border, var(--color-border))",
        background: "transparent",
        color: "var(--color-primary, #2563EB)",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      + Registrar treino anterior
    </button>
  );
}

const PAGE_SIZE = 6;

export function WorkoutHistorySection() {
  const { hasFeature } = useFeatureFlags();
  const canRetro = hasFeature("retro_workout_enabled");
  const [sessions, setSessions] = useState<WorkoutSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Paginação por cursor (Spec 033, P1). Antes o componente puxava 100 sessões
  // de uma vez e paginava no cliente — um aluno com mais de um ano de treino
  // batia no teto e simplesmente deixava de ver o histórico antigo.
  useEffect(() => {
    let cancelled = false;
    listWorkoutSessionsPage(PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setSessions(page.sessions);
        setCursor(page.nextCursor);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await listWorkoutSessionsPage(PAGE_SIZE, cursor);
    // Concatena sem deduplicar: o keyset garante que uma sessão nunca aparece em
    // duas páginas (a ordenação por (performed_at, id) é total).
    setSessions((prev) => [...prev, ...page.sessions]);
    setCursor(page.nextCursor);
    setLoadingMore(false);
  }

  // Sem sessão: com a flag ligada, ainda oferecemos o ponto de entrada retroativo
  // (o aluno pode nunca ter registrado ao vivo); sem a flag, some como antes.
  if (!loading && sessions.length === 0) {
    if (!canRetro) return null;
    return (
      <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <div className="metabolic-eyebrow">Linha do tempo</div>
          <h2 className="metabolic-section-title">Histórico de treinos</h2>
          <p className="metabolic-section-copy">Treinou fora do app? Registre um treino que você já fez.</p>
        </div>
        <RetroEntryButton />
      </section>
    );
  }

  // Alerta leve anti-abuso: muitos retroativos entre as sessões recentes.
  const recent = sessions.slice(0, 7);
  const retroRecent = recent.filter((s) => s.isRetroactive).length;
  const showRetroNudge = canRetro && retroRecent >= 3;

  return (
    <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-3)" }}>
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <div className="metabolic-eyebrow">Linha do tempo</div>
          <h2 className="metabolic-section-title">Histórico de treinos</h2>
          <p className="metabolic-section-copy">Cada sessão que você registrou, com as séries que fez.</p>
        </div>
        {canRetro && <RetroEntryButton />}
      </div>

      {showRetroNudge && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-soft, #4B5563)",
            background: "var(--color-warn-soft, var(--color-warn-soft))",
            border: "1px solid var(--color-warn, #D97706)",
            borderRadius: "var(--radius-md, 10px)",
            padding: "10px 12px",
          }}
        >
          Percebemos vários registros retroativos seguidos. Registrar no dia mantém seu plano mais afiado — que tal
          marcar o próximo logo depois do treino?
        </p>
      )}

      {loading ? (
        <p className="metabolic-section-copy">Carregando seus treinos...</p>
      ) : (
        <>
          <div className="metabolic-history-list">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>

          {cursor && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
                flexWrap: "wrap",
              }}
            >
              <span className="metabolic-eyebrow">
                {sessions.length} {sessions.length === 1 ? "treino carregado" : "treinos carregados"}
              </span>
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  minHeight: 44,
                  padding: "7px 16px",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  color: "var(--color-primary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: loadingMore ? "wait" : "pointer",
                }}
              >
                {loadingMore ? "Carregando..." : "Ver mais treinos"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
