import { useCallback, useEffect, useState } from "react";
import { fetchAcademyAuditLog, type AcademyAuditLogRow } from "../../../services/academyApi";
import { timeLabel } from "./recepcaoUtils";

function reasonPreview(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const r = meta.reason ?? meta.message ?? meta.note;
  if (typeof r === "string" && r.trim()) return r.trim().slice(0, 120);
  return "";
}

function studentLabel(row: AcademyAuditLogRow): string {
  const m = row.meta;
  if (m && typeof m.studentName === "string") return m.studentName;
  if (row.entity_type === "user" && row.entity_id) return `Aluno #${row.entity_id}`;
  return "—";
}

export function MyExceptionsCard({ actorUserId }: { actorUserId: number | null }) {
  const [rows, setRows] = useState<AcademyAuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!actorUserId) return;
    setLoading(true);
    setErr("");
    try {
      const data = await fetchAcademyAuditLog({
        actorUserId,
        actionPrefix: "reception.",
        limit: showAll ? 50 : 5,
        offset: 0,
      });
      setRows(data);
    } catch (e: unknown) {
      setErr((e as Error).message ?? "Falha ao carregar auditoria.");
    } finally {
      setLoading(false);
    }
  }, [actorUserId, showAll]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!actorUserId) return null;

  return (
    <div className="rec-exceptions-card">
      <div className="rec-exceptions-head">
        <div className="rec-exceptions-label">Suas últimas exceções</div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Mostrar menos" : "Ver todos"}
        </button>
      </div>
      {err && <div className="small muted" style={{ color: "var(--color-danger-text)" }}>{err}</div>}
      {loading && <div className="rec-exceptions-muted">Carregando…</div>}
      {!loading && rows.length === 0 && (
        <div className="rec-exceptions-muted">Nenhum registro reception.* nos últimos filtros.</div>
      )}
      <ul className="rec-exceptions-list">
        {rows.map((row) => {
          const prev = reasonPreview(row.meta);
          return (
            <li key={row.id} className="rec-exceptions-item">
              <div className="rec-exceptions-action">{row.action}</div>
              <div className="rec-exceptions-meta">
                <span>{studentLabel(row)}</span>
                <span aria-hidden="true"> · </span>
                <span>{timeLabel(row.created_at)}</span>
              </div>
              {prev ? (
                <div className="rec-exceptions-reason" title={prev}>
                  {prev}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {showAll && (
        <p className="rec-exceptions-foot small muted">
          Rota dedicada <code>/app/academy/audit</code> (placeholder) — por ora a lista expandida cobre até 50 itens.
        </p>
      )}
    </div>
  );
}
