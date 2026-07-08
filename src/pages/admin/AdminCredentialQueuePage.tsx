import { useEffect, useState } from "react";
import { fetchPendingCredentials, type PendingCredentialRow } from "../../services/adminApi";
import { authFetch } from "../../services/apiClient";
import { API_URL, parseJson } from "../../services/apiBase";
import { COLORS } from "../../styles/colors";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { EmptyState } from "../../components/EmptyState";
import { Banner } from "../../components/Banner";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending_review: { bg: "#78350f", text: "#fde68a" },
    approved: { bg: "#14532d", text: "#86efac" },
    rejected: { bg: "#7f1d1d", text: "#fca5a5" },
  };
  const c = colors[status] ?? { bg: "#374151", text: "var(--color-border)" };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text,
    }}>{status.replace("_", " ")}</span>
  );
}

export default function AdminCredentialQueuePage() {
  const [rows, setRows] = useState<PendingCredentialRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPendingCredentials()
      .then((data) => setRows(data ?? []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
  }, []);

  async function handleReview(
    professionalId: number,
    action: "approved" | "rejected"
  ) {
    setReviewing(professionalId);
    setReviewError(null);
    try {
      const response = await authFetch(
        `${API_URL}/admin/professionals/${professionalId}/network-review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credentialStatus: action,
            publicationStatus: action === "approved" ? "approved" : "disabled",
            adminEnabled: action === "approved",
          }),
        }
      );
      const data = await parseJson(response);
      if (!response.ok) throw new Error(data?.error || "Erro ao revisar credencial.");
      setRows((prev) => prev ? prev.filter((r) => r.professional_id !== professionalId) : prev);
    } catch (e: unknown) {
      setReviewError(e instanceof Error ? e.message : "Erro ao revisar.");
    } finally {
      setReviewing(null);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 16, color: COLORS.text }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, letterSpacing: 1, textTransform: "uppercase" }}>
          Pessoas · Credenciamento
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Fila de credenciais pendentes
          {rows && rows.length > 0 && (
            <span style={{
              marginLeft: 10, fontSize: 14, padding: "3px 10px", borderRadius: 8,
              background: "#78350f", color: "#fde68a", fontWeight: 600,
            }}>{rows.length}</span>
          )}
        </h2>
        <div style={{ color: COLORS.muted, fontSize: 13 }}>
          Profissionais aguardando validação de CREF/CRN antes de poderem atender alunos.
        </div>
      </div>

      {reviewError && <Banner variant="error" title="Erro ao revisar" description={reviewError} />}

      {loading && <LoadingSkeleton variant="list" lines={4} />}
      {error && <Banner variant="error" title="Erro ao carregar" description={error} />}

      {!loading && !error && rows?.length === 0 && (
        <EmptyState
          title="Nenhuma credencial pendente"
          description="Todos os profissionais foram revisados ou nenhum solicitou aprovação ainda."
        />
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <div style={{
          border: `1px solid ${COLORS.border}`, borderRadius: 20,
          background: COLORS.panel, overflow: "hidden",
        }}>
          {rows.map((row, idx) => (
            <div
              key={row.professional_id}
              style={{
                padding: "16px 18px",
                borderBottom: idx < rows.length - 1 ? `1px solid ${COLORS.border}` : undefined,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{row.name ?? "—"}</span>
                  <StatusBadge status={row.credential_status} />
                  <span style={{ fontSize: 11, color: COLORS.muted }}>
                    {row.role === "personal" ? "Personal" : "Nutricionista"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{row.email}</div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: COLORS.muted }}>Registro: </span>
                  <b>{row.credential_code ?? "—"}</b>
                  {" · "}
                  <span style={{ color: COLORS.muted }}>Alunos ativos: </span>
                  <b>{row.active_students}</b>
                </div>
                {row.review_notes && (
                  <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic" }}>
                    Nota: {row.review_notes}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={reviewing === row.professional_id}
                  onClick={() => handleReview(row.professional_id, "approved")}
                  style={{
                    padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: "1px solid #14532d", background: "#14532d", color: "#86efac",
                    cursor: reviewing ? "default" : "pointer",
                    opacity: reviewing === row.professional_id ? 0.6 : 1,
                  }}
                >
                  {reviewing === row.professional_id ? "…" : "Aprovar"}
                </button>
                <button
                  type="button"
                  disabled={reviewing === row.professional_id}
                  onClick={() => handleReview(row.professional_id, "rejected")}
                  style={{
                    padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft,
                    color: "#EF4444", cursor: reviewing ? "default" : "pointer",
                    opacity: reviewing === row.professional_id ? 0.6 : 1,
                  }}
                >
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
