import { useEffect, useState } from "react";
import { COLORS } from "../../styles/colors";
import {
  cancelSubscriptionAsPro,
  listMySubscriptionsAsPro,
  type ProfessionalSubscription,
  type SubscriptionStatus,
} from "../../services/professionalNetworkApi";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending_payment: "Aguardando pagamento",
  active: "Ativo",
  paused: "Pausado",
  cancelled: "Cancelado",
  expired: "Expirado",
};

const STATUS_COLOR: Record<SubscriptionStatus, string> = {
  pending_payment: "var(--color-warn,#f59e0b)",
  active: "var(--color-success,#7B9919)",
  paused: "var(--color-warn,#f59e0b)",
  cancelled: "var(--color-text-muted)",
  expired: "var(--color-text-muted)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function SubscribersSection() {
  const [subs, setSubs] = useState<ProfessionalSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const data = await listMySubscriptionsAsPro();
      setSubs(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancelar este vínculo? O aluno perde acesso imediatamente e a cobrança futura é suspensa.")) return;
    try {
      await cancelSubscriptionAsPro(id);
      await reload();
    } catch {
      alert("Não foi possível cancelar. Tente novamente.");
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, margin: 0, marginBottom: 12, letterSpacing: "-0.01em" }}>
        Assinaturas
      </h2>

      {loading ? (
        <div style={{ fontSize: 13, color: COLORS.muted }}>Carregando…</div>
      ) : subs.length === 0 ? (
        <div className="card cardPad" style={{ textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
          Nenhum aluno assinou seus planos ainda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subs.map((s) => {
            const canCancel = s.status === "active" || s.status === "paused" || s.status === "pending_payment";
            return (
              <div
                key={s.id}
                className="card cardPad"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: COLORS.text, fontSize: 14 }}>
                      Aluno #{s.studentId}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: STATUS_COLOR[s.status],
                        padding: "1px 6px",
                        border: `1px solid ${STATUS_COLOR[s.status]}`,
                        borderRadius: 4,
                      }}
                    >
                      {STATUS_LABELS[s.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>
                    {formatPrice(s.priceCentsSnapshot)} · desde {formatDate(s.currentPeriodStart ?? s.createdAt)}
                    {s.nextChargeAt && s.status === "active" && (
                      <> · próxima cobrança {formatDate(s.nextChargeAt)}</>
                    )}
                  </div>
                </div>
                {canCancel && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void handleCancel(s.id)}
                    style={{ color: COLORS.muted }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
