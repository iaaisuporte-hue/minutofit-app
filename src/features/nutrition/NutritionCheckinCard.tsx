import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { COLORS } from "../../styles/colors";
import {
  fetchMyNutritionPlan,
  recordNutritionCheckin,
  ADHERENCE_LABELS,
  OBJECTIVE_LABELS,
  type Adherence,
  type NutritionPlan,
} from "../../services/nutriApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardState = "loading" | "no_plan" | "idle" | "confirming" | "submitting" | "done" | "error";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AdherenceButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 100,
        padding: "10px 12px",
        borderRadius: 10,
        border: selected ? `2px solid ${COLORS.primary}` : "1.5px solid var(--color-border)",
        background: selected ? COLORS.primarySoft : "var(--color-surface)",
        color: selected ? COLORS.primary : COLORS.text,
        fontWeight: selected ? 700 : 500,
        fontSize: 13,
        cursor: "pointer",
        transition: "all 0.15s",
        lineHeight: 1.3,
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NutritionCheckinCard() {
  const [cardState, setCardState] = useState<CardState>("loading");
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [selected, setSelected] = useState<Adherence | null>(null);
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchMyNutritionPlan()
      .then((p) => {
        if (!p) {
          setCardState("no_plan");
          return;
        }
        setPlan(p);
        if (p.todayCheckin) {
          setCardState("done");
        } else {
          setCardState("idle");
        }
      })
      .catch(() => {
        // Silent — don't block TodayPage
        setCardState("no_plan");
      });
  }, []);

  function handleSelectAdherence(a: Adherence) {
    setSelected(a);
    setCardState("confirming");
    setTimeout(() => noteRef.current?.focus(), 50);
  }

  function handleCancel() {
    setSelected(null);
    setNote("");
    setSubmitError(null);
    setCardState("idle");
  }

  async function handleConfirm() {
    if (!selected) return;
    setCardState("submitting");
    setSubmitError(null);
    try {
      await recordNutritionCheckin(selected, note.trim() || undefined);
      setCardState("done");
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        // Already checked in — treat as done
        setCardState("done");
      } else {
        setSubmitError("Não foi possível registrar. Tente novamente.");
        setCardState("confirming");
      }
    }
  }

  // Don't render if no plan or still loading
  if (cardState === "loading" || cardState === "no_plan") return null;

  // ---------------------------------------------------------------------------
  // State: Done
  // ---------------------------------------------------------------------------
  if (cardState === "done") {
    const todayAdherence = plan?.todayCheckin?.adherence ?? selected ?? "full";
    return (
      <div
        className="today-card"
        style={{
          background: "var(--color-success-soft, rgba(34,197,94,.08))",
          borderRadius: 16,
          padding: "18px 20px",
          border: "1.5px solid var(--color-success, #22C55E)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-success, #22C55E)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Plano alimentar ✓
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>
              {ADHERENCE_LABELS[todayAdherence as Adherence] ?? "Check-in registrado"}
            </div>
          </div>
          <Link
            to="/app/user/plano-alimentar"
            style={{ fontSize: 13, color: COLORS.primary, fontWeight: 600, textDecoration: "none" }}
          >
            Ver meu plano →
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // State: Confirming / Submitting
  // ---------------------------------------------------------------------------
  if (cardState === "confirming" || cardState === "submitting") {
    return (
      <div className="today-card" style={{ background: COLORS.card, borderRadius: 16, padding: "18px 20px", border: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>
          {selected ? ADHERENCE_LABELS[selected] : ""}
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 6 }}>Alguma observação? (opcional)</div>
        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Como foi sua alimentação hoje..."
          rows={2}
          maxLength={200}
          style={{
            width: "100%",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 14,
            color: COLORS.text,
            background: "var(--color-surface)",
            resize: "none",
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {submitError && (
          <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{submitError}</div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cardState === "submitting"}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "1.5px solid var(--color-border)",
              background: "none",
              color: COLORS.text,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={cardState === "submitting"}
            style={{
              padding: "9px 22px",
              borderRadius: 8,
              border: "none",
              background: COLORS.primary,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: cardState === "submitting" ? "not-allowed" : "pointer",
              opacity: cardState === "submitting" ? 0.7 : 1,
            }}
          >
            {cardState === "submitting" ? "Registrando..." : "Confirmar"}
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // State: Idle
  // ---------------------------------------------------------------------------
  return (
    <div className="today-card" style={{ background: COLORS.card, borderRadius: 16, padding: "18px 20px", border: "1px solid var(--color-border)" }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
          Plano alimentar · {plan?.title ?? ""}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
          Como foi sua alimentação hoje?
        </div>
        {plan?.objective && (
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
            Objetivo: {OBJECTIVE_LABELS[plan.objective]}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["full", "partial", "skipped"] as Adherence[]).map((a) => (
          <AdherenceButton
            key={a}
            label={ADHERENCE_LABELS[a]}
            selected={selected === a}
            onClick={() => handleSelectAdherence(a)}
          />
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <Link
          to="/app/user/plano-alimentar"
          style={{ fontSize: 13, color: COLORS.primary, fontWeight: 600, textDecoration: "none" }}
        >
          Ver meu plano →
        </Link>
      </div>
    </div>
  );
}
