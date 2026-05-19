import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { fetchPersonalDashboard } from "../../services/personalDashboardApi";
import type { PersonalDashboardStudent } from "../../services/personalDashboardApi";
import {
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
  if (s === "platform") return "MetaCore";
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

  function refreshAfterUsageChange() {
    void loadProtocols();
  }

  const inputStyle: React.CSSProperties = {
    minHeight: 38,
    padding: "9px 11px",
    borderRadius: 10,
    border: `1px solid ${WB.border}`,
    background: "rgba(255,255,255,0.88)",
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
                <option value="platform">MetaCore</option>
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
            <div style={{ color: WB.muted, fontSize: 14 }}>Carregando protocolos…</div>
          ) : sortedProtocols.length === 0 ? (
            <EmptyState
              variant="info"
              eyebrow="Biblioteca"
              title="Nenhum protocolo encontrado"
              description="Crie o primeiro protocolo usando o builder ou aguarde a curadoria MetaCore. Protocolos da academia e os seus aparecem aqui quando existirem."
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
          setActiveProtocol(null);
          // Limpar o ?protocol= da URL — caso contrário o useEffect que
          // sincroniza state com a query reabre o drawer imediatamente.
          if (searchParams.has("protocol")) {
            const next = new URLSearchParams(searchParams);
            next.delete("protocol");
            setSearchParams(next, { replace: true });
          }
        }}
        onChanged={refreshAfterUsageChange}
      />
    </div>
  );
}
