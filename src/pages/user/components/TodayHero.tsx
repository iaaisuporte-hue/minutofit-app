import type { TodayPrimary, TodayCtaAction } from "../lib/resolveTodayPrimary";

interface Props {
  primary: TodayPrimary;
  /** Linha de leitura do dia (ex.: "Prontidão alta · estado Ativo"). */
  readingLine?: string | null;
  onAction: (action: TodayCtaAction) => void;
}

/**
 * Hero "Seu dia": o card de topo da Today Page. Responde "o que faço agora?"
 * com UMA ação primária por estado. Apresentacional — a decisão vem de
 * resolveTodayPrimary; os comportamentos do CTA são injetados via onAction.
 */
export function TodayHero({ primary, readingLine, onAction }: Props) {
  return (
    <section
      aria-label="Seu dia"
      style={{
        display: "grid",
        gap: 14,
        padding: 20,
        borderRadius: 18,
        background: "linear-gradient(135deg, rgba(15,61,46,.10), rgba(15,22,18,.03))",
        border: "1px solid var(--color-border, var(--color-border))",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        {readingLine ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              color: "var(--color-text-muted, var(--color-text-muted))",
            }}
          >
            {readingLine}
          </div>
        ) : null}
        <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, margin: 0, color: "var(--color-text, #0A130D)" }}>
          {primary.title}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: "var(--color-text-muted, var(--color-text-muted))" }}>
          {primary.subtitle}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onAction(primary.ctaAction)}
        style={{
          justifySelf: "start",
          padding: "12px 18px",
          borderRadius: 12,
          border: "none",
          background: "var(--action-primary, #5E7412)",
          color: "var(--action-primary-text, #F5F5F5)",
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
          minHeight: 44,
        }}
      >
        {primary.ctaLabel}
      </button>
    </section>
  );
}
