import { buildTodayNarrative, type NarrativeInput } from "../../../features/training/buildTodayNarrative";

export function WorkoutContextBand(props: NarrativeInput) {
  const { reason, signals, rhythm } = buildTodayNarrative(props);

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      {rhythm && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--font-semibold)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--color-text-muted)",
          }}
        >
          {rhythm}
        </div>
      )}
      <div
        style={{
          fontSize: "var(--text-base)",
          fontWeight: "var(--font-semibold)",
          color: "var(--color-text)",
          lineHeight: 1.55,
        }}
      >
        {reason}
      </div>
      {signals.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {signals.map((signal) => (
            <span
              key={signal}
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-text-muted)",
                padding: "4px 8px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-pill)",
                background: "var(--color-surface-raised)",
              }}
            >
              {signal}
            </span>
          ))}
        </div>
      )}
      <div style={{ borderTop: "1px solid var(--color-border)" }} />
    </div>
  );
}
