import React from "react";
import { WB } from "./workoutBuilderTheme";

export function pillStyle(bg: string, border: string): React.CSSProperties {
  return {
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 650,
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
        borderRadius: 14,
        background: WB.card,
        boxShadow: WB.shadow,
        overflow: "hidden",
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
        minHeight: 36,
        padding: "8px 11px",
        borderRadius: 10,
        border: isPrimary ? `1px solid ${WB.primaryBorder}` : `1px solid ${WB.border}`,
        background: isPrimary ? WB.primary : "rgba(255,255,255,0.72)",
        color: isPrimary ? WB.ctaText : WB.text,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 650,
        fontSize: 13,
        lineHeight: 1,
        boxShadow: isPrimary ? "0 8px 18px rgba(22, 163, 74, 0.14)" : "none",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 650, fontSize: 15, letterSpacing: "-0.02em", color: WB.text }}>{title}</div>
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
  const border = kind === "success" ? "rgba(34, 197, 94, 0.26)" : "rgba(248, 113, 113, 0.32)";
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        borderRadius: 10,
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
            fontWeight: 650,
          }}
        >
          Fechar
        </button>
      ) : null}
    </div>
  );
}

export function IconArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 3v8M3.5 7.5L7 11l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGrip() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="5" cy="3.5" r="1" fill="currentColor" />
      <circle cx="9" cy="3.5" r="1" fill="currentColor" />
      <circle cx="5" cy="7" r="1" fill="currentColor" />
      <circle cx="9" cy="7" r="1" fill="currentColor" />
      <circle cx="5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="9" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}
