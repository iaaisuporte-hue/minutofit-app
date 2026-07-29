import { useEffect, useMemo, useState } from "react";
import { fetchNetworkProfessionals, type NetworkProfessionalRow } from "../../services/adminApi";
import { authFetch } from "../../services/apiClient";
import { API_URL, parseJson } from "../../services/apiBase";
import { COLORS } from "../../styles/colors";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { EmptyState } from "../../components/EmptyState";
import { Banner } from "../../components/Banner";

function Pill({ tone, children }: { tone: "ok" | "warn" | "danger" | "muted"; children: React.ReactNode }) {
  const tones = {
    ok: { bg: "#14532d", text: "#86efac" },
    warn: { bg: "#78350f", text: "#fde68a" },
    danger: { bg: "#7f1d1d", text: "#fca5a5" },
    muted: { bg: "#374151", text: "var(--color-border)" },
  } as const;
  const c = tones[tone];
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text,
    }}>{children}</span>
  );
}

/**
 * Explica, em uma linha, por que o profissional não aparece na busca do aluno.
 * Espelha os 4 predicados de `listAvailableProfessionals` no backend.
 */
function blockingReason(row: NetworkProfessionalRow): string {
  if (!row.has_profile) return "Sem perfil de rede — só o próprio profissional pode criar em /app/personal/meu-perfil";
  if (row.publication_status !== "approved") return "Perfil nunca publicado (ou despublicado) pelo profissional";
  if (row.credential_status !== "approved") return "Credencial não aprovada";
  if (!row.admin_enabled) return "Desabilitado pelo admin";
  if (row.availability_status && !["available", "limited"].includes(row.availability_status)) {
    return "Profissional marcou-se como sem vagas (availability = unavailable)";
  }
  return "Papel do usuário divergente do papel do perfil de rede";
}

export default function AdminCredentialQueuePage() {
  const [rows, setRows] = useState<NetworkProfessionalRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchNetworkProfessionals()
      .then((data) => setRows(data ?? []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (!rows) return null;
    const personals = rows.filter((r) => r.role === "personal");
    return {
      total: rows.length,
      discoverable: rows.filter((r) => r.discoverable).length,
      personalsDiscoverable: personals.filter((r) => r.discoverable).length,
      personalsTotal: personals.length,
    };
  }, [rows]);

  async function handleReview(professionalId: number, action: "approved" | "rejected") {
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
      setRows((prev) =>
        prev
          ? prev.map((r) =>
              r.professional_id === professionalId
                ? {
                    ...r,
                    credential_status: action,
                    publication_status: action === "approved" ? "approved" : "disabled",
                    admin_enabled: action === "approved",
                    discoverable:
                      action === "approved" &&
                      ["available", "limited"].includes(r.availability_status ?? "available"),
                  }
                : r
            )
          : prev
      );
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
          Pessoas · Rede de Profissionais
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Estado da Rede</h2>
        <div style={{ color: COLORS.muted, fontSize: 13 }}>
          Quem o aluno consegue encontrar na busca por profissional. Publicar o perfil é
          ação do próprio profissional — o admin só consegue desabilitar quem já publicou.
        </div>
      </div>

      {stats && stats.personalsTotal > 0 && stats.personalsDiscoverable === 0 && (
        <Banner
          variant="error"
          title="Nenhum personal está visível para os alunos"
          description="A busca por personal na tela do aluno retorna lista vazia. Peça aos profissionais abaixo que publiquem o perfil em /app/personal/meu-perfil."
        />
      )}

      {stats && (
        <div style={{ fontSize: 13, color: COLORS.muted }}>
          <b style={{ color: COLORS.text }}>{stats.discoverable}</b> de{" "}
          <b style={{ color: COLORS.text }}>{stats.total}</b> profissionais visíveis na busca do aluno
          {" · "}personais: <b style={{ color: COLORS.text }}>{stats.personalsDiscoverable}</b>/{stats.personalsTotal}
        </div>
      )}

      {reviewError && <Banner variant="error" title="Erro ao revisar" description={reviewError} />}

      {loading && <LoadingSkeleton variant="list" lines={4} />}
      {error && <Banner variant="error" title="Erro ao carregar" description={error} />}

      {!loading && !error && rows?.length === 0 && (
        <EmptyState
          title="Nenhum profissional cadastrado"
          description="Nenhum usuário com papel personal ou nutricionista existe na plataforma."
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{row.name ?? "—"}</span>
                  {row.discoverable
                    ? <Pill tone="ok">visível na busca</Pill>
                    : <Pill tone={row.has_profile ? "warn" : "danger"}>invisível</Pill>}
                  <span style={{ fontSize: 11, color: COLORS.muted }}>
                    {row.role === "personal" ? "Personal" : "Nutricionista"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{row.email}</div>

                {!row.discoverable && (
                  <div style={{ fontSize: 12, color: "#fca5a5" }}>{blockingReason(row)}</div>
                )}

                <div style={{ fontSize: 12 }}>
                  <span style={{ color: COLORS.muted }}>Registro: </span>
                  <b>{row.credential_code ?? "—"}</b>
                  {" · "}
                  <span style={{ color: COLORS.muted }}>Código do aluno: </span>
                  <b>{row.professional_code ?? "—"}</b>
                  {" · "}
                  <span style={{ color: COLORS.muted }}>Alunos ativos: </span>
                  <b>{row.active_students}</b>
                </div>

                {row.has_profile && (
                  <div style={{ fontSize: 11, color: COLORS.muted }}>
                    publicação: {row.publication_status} · credencial: {row.credential_status} ·
                    {" "}admin: {row.admin_enabled ? "on" : "off"} · vagas: {row.availability_status}
                  </div>
                )}

                {row.review_notes && (
                  <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic" }}>
                    Nota: {row.review_notes}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {row.has_profile ? (
                  <>
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
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: COLORS.muted, maxWidth: 180, textAlign: "right" }}>
                    Sem ação de admin disponível — o profissional precisa criar o perfil
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
