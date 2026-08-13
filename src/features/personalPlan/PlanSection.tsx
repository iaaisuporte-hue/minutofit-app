import { useEffect, useState } from "react";
import { ConfirmModal } from "../team/ConfirmModal";
import { isNativeApp } from "../../lib/platform";
import {
  cancelPersonalPlan,
  fetchPersonalPlan,
  type PersonalPlanConfig,
} from "../../services/personalPlanApi";

const PLAN_LABEL: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro" };

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

/**
 * "Meu plano" no perfil do profissional: mostra o plano atual e permite
 * cancelar (Spec 032).
 *
 * Existe porque o site sempre respondeu "cancele pelo próprio painel" e o painel
 * não tinha nada — só dava para cancelar entrando no Mercado Pago. O Decreto
 * 11.034/2022 exige que cancelar seja tão simples quanto contratar.
 */
export function PlanSection() {
  const [plan, setPlan] = useState<PersonalPlanConfig | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPersonalPlan()
      .then((p) => alive && setPlan(p))
      .catch(() => {
        /* fetchPersonalPlan já degrada para Free */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!plan) return null;

  const isPaid = plan.plan !== "free";
  const until = formatDate(plan.currentPeriodEnd);
  const cancelled = plan.status === "cancelled";

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      const updated = await cancelPersonalPlan();
      setPlan(updated);
      setConfirming(false);
      const date = formatDate(updated.currentPeriodEnd);
      setMessage(
        date
          ? `Assinatura cancelada. Você mantém o acesso até ${date}.`
          : "Assinatura cancelada.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível cancelar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card, 12px)",
        padding: 16,
        display: "grid",
        gap: 10,
        marginTop: 24,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        Meu plano
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 18, color: "var(--color-text)" }}>
          {PLAN_LABEL[plan.plan] ?? plan.plan}
        </strong>
        {cancelled && until && (
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            cancelado — acesso até {until}
          </span>
        )}
        {!cancelled && isPaid && until && (
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            renova em {until}
          </span>
        )}
      </div>

      <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        {plan.studentLimit === null
          ? "Alunos ilimitados e resumo com IA."
          : `Até ${plan.studentLimit} alunos.`}
      </div>

      {message && (
        <div style={{ fontSize: 13, color: "var(--color-success-text, var(--color-text))" }}>
          {message}
        </div>
      )}
      {error && <div style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</div>}

      {isPaid && !cancelled && (
        isNativeApp() ? (
          // No app empacotado não há caminho de compra nem de gestão de cobrança
          // (política das lojas) — o mesmo padrão de MySubscriptionsSection.
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Para alterar ou cancelar seu plano, acesse sua conta pela versão web do S2Core.
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              style={{
                minHeight: 44,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "none",
                color: "var(--color-text-muted)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancelar assinatura
            </button>
          </div>
        )
      )}

      {confirming && (
        <ConfirmModal
          title="Cancelar sua assinatura?"
          description={
            until
              ? `A cobrança recorrente para de ser feita e você mantém o acesso ao ${PLAN_LABEL[plan.plan]} até ${until}. Depois disso, sua conta volta ao Free.`
              : "A cobrança recorrente para de ser feita e sua conta volta ao Free."
          }
          confirmLabel="Cancelar assinatura"
          cancelLabel="Manter plano"
          destructive
          loading={busy}
          onConfirm={() => void handleCancel()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
