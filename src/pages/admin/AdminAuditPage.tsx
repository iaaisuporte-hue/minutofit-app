import { useEffect, useState, useCallback } from "react";
import { fetchAdminAuditLog, type AdminAuditEntry } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { EmptyState } from "../../components/EmptyState";
import { Banner } from "../../components/Banner";

const PAGE_SIZE = 50;
const ACTION_OPTIONS = [
  { value: "", label: "Todas as ações" },
  { value: "admin.", label: "Ações admin" },
  { value: "product.", label: "Produtos" },
  { value: "auth.", label: "Autenticação" },
  { value: "personal.", label: "Personal" },
  { value: "membership.", label: "Memberships" },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminAuditLog({
        action: action || undefined,
        subjectUserId: subjectId ? Number(subjectId) : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setEntries(result?.entries ?? []);
      setTotal(result?.pagination.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar auditoria.");
    } finally {
      setLoading(false);
    }
  }, [action, subjectId, page]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: 16, display: "grid", gap: 16, color: COLORS.text }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, letterSpacing: 1, textTransform: "uppercase" }}>
          Operação
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Auditoria da plataforma</h2>
        <div style={{ color: COLORS.muted, fontSize: 13 }}>
          Trilha de ações sensíveis realizadas por admins — segurança e conformidade LGPD.
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(0); }}
          style={{
            padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
            background: COLORS.panelSoft, color: COLORS.text, fontSize: 13,
          }}
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="ID do usuário alvo…"
          value={subjectId}
          onChange={(e) => { setSubjectId(e.target.value); setPage(0); }}
          style={{
            padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
            background: COLORS.panelSoft, color: COLORS.text, fontSize: 13, width: 180,
          }}
        />
        <button
          type="button"
          onClick={() => { setAction(""); setSubjectId(""); setPage(0); }}
          style={{
            padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
            background: COLORS.panelSoft, color: COLORS.muted, fontSize: 13, cursor: "pointer",
          }}
        >
          Limpar
        </button>
        <span style={{ color: COLORS.muted, fontSize: 13, marginLeft: 8 }}>{total} registro(s)</span>
      </div>

      {loading && <LoadingSkeleton variant="list" lines={6} />}
      {error && <Banner variant="error" title="Erro ao carregar" description={error} />}

      {!loading && !error && entries.length === 0 && (
        <EmptyState title="Nenhuma ação registrada" description="Aplique outros filtros ou aguarde ações serem realizadas." />
      )}

      {!loading && !error && entries.length > 0 && (
        <div style={{
          border: `1px solid ${COLORS.border}`, borderRadius: 20,
          background: COLORS.panel, overflow: "hidden",
        }}>
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                padding: "12px 16px",
                borderBottom: idx < entries.length - 1 ? `1px solid ${COLORS.border}` : undefined,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontWeight: 700, fontSize: 13,
                    padding: "2px 8px", borderRadius: 6,
                    background: COLORS.primarySoft, color: COLORS.text,
                  }}>{entry.action}</span>
                  {entry.entity_type && (
                    <span style={{ fontSize: 12, color: COLORS.muted }}>
                      {entry.entity_type} #{entry.entity_id}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  por <b style={{ color: COLORS.text }}>{entry.actor_name ?? `#${entry.user_id}`}</b>
                  {entry.academy_id ? ` · academia #${entry.academy_id}` : " · plataforma"}
                </div>
                {entry.meta && Object.keys(entry.meta).length > 0 && (
                  <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "monospace", marginTop: 2 }}>
                    {JSON.stringify(entry.meta)}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, whiteSpace: "nowrap" }}>
                {formatDate(entry.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button" disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              style={{
                padding: "6px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft, color: COLORS.text, cursor: page === 0 ? "default" : "pointer",
                opacity: page === 0 ? 0.4 : 1, fontSize: 13,
              }}
            >Anterior</button>
            <button
              type="button" disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: "6px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft, color: COLORS.text,
                cursor: page >= totalPages - 1 ? "default" : "pointer",
                opacity: page >= totalPages - 1 ? 0.4 : 1, fontSize: 13,
              }}
            >Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
}
