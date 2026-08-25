import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonStudentList } from "../../components/feedback/Skeleton";
import { fetchPersonalDashboard } from "../../services/personalDashboardApi";
import type { PersonalDashboardStudent } from "../../services/personalDashboardApi";
import {
  createWorkoutProtocol,
  deleteWorkoutProtocol,
  fetchWorkoutProtocols,
  setProtocolFavorite,
  type ProtocolScope,
  type WorkoutProtocol,
} from "../../services/workoutProtocolsApi";
import { FeedbackBanner, WbButton, WbCard } from "./workoutBuilder/WorkoutBuilderUi";
import { ProtocolUsageBadge } from "./workoutLibrary/ProtocolUsageBadge";
import { ProtocolUsageDrawer } from "./workoutLibrary/ProtocolUsageDrawer";
import "./workoutLibrary/workoutLibrary.css";
import { WB } from "./workoutBuilder/workoutBuilderTheme";
import "./personalPremium.css";

const BUILDER_BASE = "/app/personal/students";

function scopeLabel(s: ProtocolScope) {
  if (s === "platform") return "S2Core";
  if (s === "academy") return "Academia";
  return "Seu";
}

export default function WorkoutLibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<PersonalDashboardStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const [protocols, setProtocols] = useState<WorkoutProtocol[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(true);
  const [protocolsError, setProtocolsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ProtocolScope | "all">("all");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [activeProtocol, setActiveProtocol] = useState<WorkoutProtocol | null>(null);
  // Ref de "fechamento em andamento": impede o useEffect de sync URL→state de
  // reabrir o drawer no mesmo ciclo do close, mesmo se houver render intermediário.
  const closingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStudentsLoading(true);
      try {
        const dash = await fetchPersonalDashboard();
        if (cancelled) return;
        const list = dash?.students ?? [];
        setStudents(list);
      } catch {
        if (!cancelled) setStudents([]);
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProtocols = useCallback(async () => {
    setProtocolsLoading(true);
    setProtocolsError(null);
    try {
      const rows = await fetchWorkoutProtocols({
        q: query.trim() || undefined,
        scope,
        limit: 80,
      });
      setProtocols(rows);
    } catch (e) {
      setProtocols([]);
      setProtocolsError(e instanceof Error ? e.message : "Nao foi possivel carregar protocolos.");
    } finally {
      setProtocolsLoading(false);
    }
  }, [query, scope]);

  useEffect(() => {
    void loadProtocols();
  }, [loadProtocols]);


  useEffect(() => {
    // Trava: se acabamos de fechar via botão/backdrop, ignorar 1 ciclo de sync
    // para evitar reabertura imediata enquanto state e URL ainda estão se
    // estabilizando após onClose.
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    const raw = searchParams.get("protocol");
    if (!raw || protocolsLoading || activeProtocol) return;
    const protocolId = Number(raw);
    if (!Number.isFinite(protocolId)) return;
    const match = protocols.find((protocol) => protocol.id === protocolId);
    if (match) setActiveProtocol(match);
  }, [searchParams, protocols, protocolsLoading, activeProtocol]);

  async function toggleFavorite(p: WorkoutProtocol, next: boolean) {
    try {
      await setProtocolFavorite(p.id, next);
      setProtocols((prev) =>
        prev.map((row) => (row.id === p.id ? { ...row, isFavorite: next } : row))
      );
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : "Nao foi possivel atualizar favorito.",
      });
    }
  }

  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  async function handleDuplicate(p: WorkoutProtocol) {
    setDuplicatingId(p.id);
    try {
      const days = (p.days?.length ?? 0) > 0
        ? p.days.map((d) => ({ name: d.name, focus: d.focus, items: d.items }))
        : undefined;
      const created = await createWorkoutProtocol({
        title: `Cópia de ${p.title}`,
        description: p.description ?? undefined,
        weekPreset: p.weekPreset,
        selectedGroup: p.selectedGroup,
        items: p.items ?? [],
        days,
      });
      setProtocols((prev) => [created, ...prev]);
      setFeedback({ kind: "success", message: `Protocolo "${created.title}" criado.` });
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : "Não foi possível duplicar o protocolo.",
      });
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleDelete(p: WorkoutProtocol) {
    if (!window.confirm(`Excluir protocolo "${p.title}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteWorkoutProtocol(p.id);
      setProtocols((prev) => prev.filter((row) => row.id !== p.id));
      setFeedback({ kind: "success", message: `Protocolo "${p.title}" excluído.` });
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : "Não foi possível excluir o protocolo.",
      });
    }
  }

  const sortedProtocols = useMemo(() => {
    return [...protocols].sort((a, b) => {
      if (Boolean(b.isFavorite) !== Boolean(a.isFavorite)) return Number(b.isFavorite) - Number(a.isFavorite);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [protocols]);

  function openInBuilder(protocolId: number) {
    const path = selectedStudentId
      ? `${BUILDER_BASE}/${selectedStudentId}/workouts/builder?protocol=${protocolId}`
      : `/app/personal/builder?protocol=${protocolId}`;
    navigate(path);
  }

  // Criar treino/protocolo do zero. Respeita o seletor "Aluno (destino)": com aluno
  // selecionado, abre o builder já apontado para ele; sem aluno, abre o builder
  // standalone (protocolo/template reutilizável). Sem ?protocol → ficha em branco.
  function createNew() {
    navigate(
      selectedStudentId
        ? `${BUILDER_BASE}/${selectedStudentId}/workouts/builder`
        : "/app/personal/builder"
    );
  }

  function refreshAfterUsageChange() {
    void loadProtocols();
  }

  const inputStyle: React.CSSProperties = {
    minHeight: "var(--tap-h-input)",
    padding: "9px 11px",
    borderRadius: 10,
    border: `1px solid ${WB.border}`,
    background: "var(--color-surface)",
    color: WB.text,
    outline: "none",
    width: "100%",
    maxWidth: 320,
    boxSizing: "border-box",
  };

  return (
    <div className="pp-page">
      {feedback ? (
        <FeedbackBanner kind={feedback.kind} message={feedback.message} onDismiss={() => setFeedback(null)} />
      ) : null}

      <section className="pp-panel">
        <div className="pp-panel__header">
          <div style={{ display: "grid", gap: 5 }}>
            <div className="pp-panel__title">Biblioteca de protocolos</div>
            <div className="pp-panel__subtitle">
              Modelos da plataforma, da academia e seus protocolos privados — favoritos sobem na lista. Use o builder
              para aplicar ao aluno com contexto vivo.
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <WbButton variant="primary" type="button" onClick={createNew}>
              Criar treino
            </WbButton>
          </div>
        </div>
        <div className="pp-panel__body" style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: WB.muted }}>
              Aluno (destino no builder)
              <select
                style={inputStyle}
                disabled={studentsLoading || !students.length}
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">Sem aluno selecionado</option>
                {!students.length ? <option value="" disabled>Nenhum aluno vinculado</option> : null}
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: WB.muted }}>
              Escopo
              <select
                style={inputStyle}
                value={scope}
                onChange={(e) => setScope(e.target.value as ProtocolScope | "all")}
              >
                <option value="all">Todos</option>
                <option value="platform">S2Core</option>
                <option value="academy">Academia</option>
                <option value="personal">Meus</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: WB.muted, flex: "1 1 220px" }}>
              Busca
              <input
                style={{ ...inputStyle, maxWidth: "none" }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Titulo ou descricao"
              />
            </label>
            <WbButton variant="ghost" type="button" onClick={() => void loadProtocols()} disabled={protocolsLoading}>
              Atualizar
            </WbButton>
          </div>

          {protocolsError ? (
            <FeedbackBanner kind="error" message={protocolsError} onDismiss={() => setProtocolsError(null)} />
          ) : null}

          {protocolsLoading ? (
            <SkeletonStudentList rows={3} label="Carregando protocolos" />
          ) : sortedProtocols.length === 0 ? (
            <EmptyState
              variant="info"
              eyebrow="Biblioteca"
              title="Nenhum protocolo encontrado"
              description="Crie o primeiro protocolo usando o builder ou aguarde a curadoria S2Core. Protocolos da academia e os seus aparecem aqui quando existirem."
            />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {sortedProtocols.map((p) => (
                <WbCard key={p.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveProtocol(p)}
                    onKeyDown={(e) => { if (e.key === "Enter") setActiveProtocol(p); }}
                    style={{ padding: 14, display: "grid", gap: 10, cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: WB.text }}>{p.title}</div>
                      <span style={{ fontSize: 12, color: WB.muted }}>
                        {scopeLabel(p.scope)} · {p.items.length} exercicios
                      </span>
                    </div>
                    {p.description ? (
                      <p style={{ margin: 0, fontSize: 14, color: WB.muted, lineHeight: 1.45 }}>{p.description}</p>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <ProtocolUsageBadge count={p.usageCount} />
                      <span style={{ fontSize: 12, color: WB.muted }}>
                        Atualizado {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                      <WbButton variant="primary" type="button" onClick={() => openInBuilder(p.id)}>
                        Abrir no builder
                      </WbButton>
                      <WbButton
                        variant="ghost"
                        type="button"
                        onClick={() => void toggleFavorite(p, !p.isFavorite)}
                        aria-pressed={p.isFavorite}
                      >
                        {p.isFavorite ? "Remover favorito" : "Favoritar"}
                      </WbButton>
                      <WbButton
                        variant="ghost"
                        type="button"
                        onClick={() => void handleDuplicate(p)}
                        disabled={duplicatingId === p.id}
                        title="Duplicar este protocolo para a sua biblioteca"
                      >
                        {duplicatingId === p.id ? "Duplicando…" : "Duplicar"}
                      </WbButton>
                      {p.scope === "personal" ? (
                        <WbButton
                          variant="ghost"
                          type="button"
                          onClick={() => void handleDelete(p)}
                          title="Excluir este protocolo permanentemente"
                        >
                          Excluir
                        </WbButton>
                      ) : null}
                    </div>
                  </div>
                </WbCard>
              ))}
            </div>
          )}
        </div>
      </section>
      <ProtocolUsageDrawer
        protocol={activeProtocol}
        open={Boolean(activeProtocol)}
        onClose={() => {
          // 1) Marca fechamento em curso (impede sync URL→state de reabrir).
          closingRef.current = true;
          // 2) Limpa o ?protocol= da URL ANTES do state — assim, mesmo em
          //    render intermediário, o sync já lê URL sem o parâmetro.
          if (searchParams.has("protocol")) {
            const next = new URLSearchParams(searchParams);
            next.delete("protocol");
            setSearchParams(next, { replace: true });
          }
          // 3) Fecha o drawer.
          setActiveProtocol(null);
        }}
        onChanged={refreshAfterUsageChange}
      />
    </div>
  );
}
