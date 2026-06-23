import { GLOSSARY_TERMS } from "./glossario/terms";

export default function GlossarioPage() {
  const sorted = [...GLOSSARY_TERMS].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, "pt-BR")
  );

  return (
    <div style={{ maxWidth: 600, display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gap: 4, paddingBottom: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Glossário
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Termos do S2Core
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
          Todas as palavras que o app usa, explicadas em linguagem simples.
        </p>
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      >
        {sorted.map((term, idx) => (
          <div
            key={term.id}
            id={term.id}
            style={{
              padding: "16px 20px",
              borderTop: idx === 0 ? "none" : "1px solid var(--color-border)",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
              {term.titulo}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              {term.resumo}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-subtle)",
                lineHeight: 1.45,
                paddingTop: 2,
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>
                Para você:{" "}
              </span>
              {term.impacto}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
