import { TECHNIQUE_REGISTRY } from "./registry";
import type { TechniqueConfig } from "./technique.types";
import "./technique.css";

export type TechniqueCardProps = {
  technique: TechniqueConfig | undefined;
  /** Optional partner exercise name when type === 'bi_set' */
  pairedWithName?: string | null;
};

export function TechniqueCard({ technique, pairedWithName }: TechniqueCardProps) {
  if (!technique || technique.type === "none") return null;
  const def = TECHNIQUE_REGISTRY[technique.type];
  if (!def) return null;

  const params: Array<{ label: string; value: string }> = [];
  if (technique.type === "drop_set") {
    if (technique.drops != null) params.push({ label: "Quedas", value: `${technique.drops}x` });
    if (technique.dropPercent != null) params.push({ label: "Redução", value: `${technique.dropPercent}%` });
  }
  if (technique.type === "rest_pause") {
    if (technique.pauseSeconds != null) params.push({ label: "Pausa", value: `${technique.pauseSeconds}s` });
    if (technique.miniSets != null) params.push({ label: "Mini-séries", value: `${technique.miniSets}x` });
  }

  return (
    <aside className="tech-card" aria-label={`Método ${def.label}`}>
      <header className="tech-card__header">
        <span className="tech-card__title">{def.label}</span>
        {technique.type === "bi_set" && pairedWithName ? (
          <span className="tech-card__scope">com {pairedWithName}</span>
        ) : null}
      </header>
      <p className="tech-card__tagline">{def.tagline}</p>
      <ol className="tech-card__steps">
        {def.instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {params.length > 0 && (
        <div className="tech-card__params">
          {params.map((p) => (
            <span key={p.label}>
              {p.label}: {p.value}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
