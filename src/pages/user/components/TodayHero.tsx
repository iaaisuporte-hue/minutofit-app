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
        border: "1px solid var(--color-border, #E5E7EB)",
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
              color: "var(--color-text-muted, #6B7280)",
            }}
          >
            {readingLine}
          </div>
        ) : null}
        <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, margin: 0, color: "var(--color-text, #0A130D)" }}>
          {primary.title}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: "var(--color-text-muted, #6B7280)" }}>
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
          background: "var(--color-primary, #16A34A)",
          color: "var(--color-cta-text, #FFFFFF)",
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
