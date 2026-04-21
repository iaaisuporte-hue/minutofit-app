import React from "react";
import { WB } from "./workoutBuilderTheme";

export function pillStyle(bg: string, border: string): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${border}`,
    background: bg,
    color: WB.text,
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    whiteSpace: "nowrap",
  };
}

export function WbCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${WB.border}`,
        borderRadius: 16,
        background: WB.card,
        boxShadow: WB.shadow,
      }}
    >
      {children}
    </div>
  );
}

export function WbButton({
  children,
  onClick,
  variant = "ghost",
  disabled,
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "primary";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: isPrimary ? `1px solid ${WB.primaryBorder}` : `1px solid ${WB.border}`,
        background: isPrimary ? WB.primary : "transparent",
        color: isPrimary ? WB.ctaText : WB.text,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        fontSize: 14,
        boxShadow: isPrimary ? "0 10px 24px rgba(0,0,0,.35)" : "none",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Passos horizontais: aluno → ficha → exercícios (leitura rápida do fluxo). */
export function BuilderStepRail({
  steps,
}: {
  steps: { id: string; label: string; status: "todo" | "current" | "done" }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "stretch",
        gap: 0,
        borderRadius: 12,
        border: `1px solid ${WB.border}`,
        overflow: "hidden",
        width: "fit-content",
        maxWidth: "100%",
      }}
    >
      {steps.map((s, i) => {
        const isDone = s.status === "done";
        const isCurrent = s.status === "current";
        const bg = isDone ? WB.primarySoft : isCurrent ? "#F9FAFB" : "#FFFFFF";
        const bd = isDone || isCurrent ? WB.primaryBorder : WB.border;
        return (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              background: bg,
              borderRight: i < steps.length - 1 ? `1px solid ${WB.border}` : undefined,
              fontSize: 13,
              fontWeight: 600,
              color: WB.text,
              minWidth: 0,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `1px solid ${bd}`,
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 600,
                background: isDone ? WB.primary : "transparent",
                color: isDone ? WB.ctaText : WB.muted,
              }}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span style={{ lineHeight: 1.25 }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SectionLabel({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>{title}</div>
      {hint ? (
        <div style={{ color: WB.muted, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}

export function FeedbackBanner({
  kind,
  message,
  onDismiss,
}: {
  kind: "success" | "error";
  message: string;
  onDismiss?: () => void;
}) {
  const bg = kind === "success" ? "rgba(34, 197, 94, 0.14)" : "rgba(220, 38, 38, 0.14)";
  const border = kind === "success" ? "rgba(34, 197, 94, 0.35)" : "rgba(248, 113, 113, 0.4)";
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${border}`,
        background: bg,
        color: WB.text,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1.4 }}>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            border: `1px solid ${WB.border}`,
            background: "transparent",
            color: WB.text,
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Fechar
        </button>
      ) : null}
    </div>
  );
}
