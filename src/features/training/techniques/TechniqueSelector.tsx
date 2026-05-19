import {
  TECHNIQUE_REGISTRY,
  buildDefaultTechniqueConfig,
  listTechniques,
} from "./registry";
import type {
  TechniqueConfig,
  TechniqueDefinition,
  TechniqueParamDef,
  TechniqueReadiness,
  TechniqueType,
} from "./technique.types";
import "./technique.css";

export type BiSetPairCandidate = {
  exerciseId: string;
  name: string;
  partnerExerciseId?: string | null;
};

export type TechniqueSelectorProps = {
  value: TechniqueConfig | undefined;
  onChange: (next: TechniqueConfig | undefined) => void;
  readiness?: TechniqueReadiness | null;
  /** Bi-set pairing helpers — only used when type === 'bi_set' */
  exerciseId?: string;
  pairCandidates?: BiSetPairCandidate[];
  /** Current partner exercise id (read-only display) */
  pairedWith?: BiSetPairCandidate | null;
  onPairWith?: (partner: BiSetPairCandidate | null) => void;
};

const ALL_OPTIONS: Array<{ type: TechniqueType; label: string; tagline: string }> = [
  { type: "none", label: "Nenhuma", tagline: "Execução padrão" },
  ...listTechniques().map((t) => ({ type: t.type, label: t.label, tagline: t.tagline })),
];

export function TechniqueSelector({
  value,
  onChange,
  readiness,
  exerciseId,
  pairCandidates,
  pairedWith,
  onPairWith,
}: TechniqueSelectorProps) {
  const currentType: TechniqueType = value?.type ?? "none";
  const definition: TechniqueDefinition | null =
    currentType === "none" ? null : TECHNIQUE_REGISTRY[currentType] ?? null;

  function selectType(type: TechniqueType) {
    if (type === "none") {
      onChange(undefined);
      return;
    }
    if (value && value.type === type) {
      onChange(undefined);
      return;
    }
    onChange(buildDefaultTechniqueConfig(type));
  }

  function updateParam(key: TechniqueParamDef["key"], raw: string) {
    if (!value) return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange({ ...value, [key]: n });
  }

  const showReadiness =
    readiness && readiness.level !== "green" && currentType !== "none";

  return (
    <div className="tech-selector" aria-label="Método de execução">
      <div className="tech-selector__title">Método de execução</div>

      <div className="tech-selector__grid">
        {ALL_OPTIONS.map((opt) => {
          const selected = opt.type === currentType;
          return (
            <button
              key={opt.type}
              type="button"
              className="tech-selector__option"
              aria-pressed={selected}
              onClick={() => selectType(opt.type)}
            >
              <span className="tech-selector__option-label">{opt.label}</span>
              <span className="tech-selector__option-tagline">{opt.tagline}</span>
            </button>
          );
        })}
      </div>

      {showReadiness && (
        <div
          className={`tech-readiness tech-readiness--${readiness!.level}`}
          role="note"
        >
          <span className="tech-readiness__icon" aria-hidden="true">
            {readiness!.level === "red" ? "■" : "▲"}
          </span>
          <span>{readiness!.message}</span>
        </div>
      )}

      {definition && definition.params.length > 0 && (
        <div className="tech-selector__params">
          {definition.params.map((p) => (
            <label key={p.key} className="tech-selector__param">
              {p.label}
              <span className="tech-selector__param-input">
                <input
                  type="number"
                  min={p.min}
                  max={p.max}
                  step={p.step ?? 1}
                  value={(value?.[p.key] ?? p.defaultValue) as number}
                  onChange={(e) => updateParam(p.key, e.target.value)}
                />
                {p.suffix ? <span>{p.suffix}</span> : null}
              </span>
            </label>
          ))}
        </div>
      )}

      {definition && currentType === "bi_set" && (
        <BiSetPairing
          exerciseId={exerciseId}
          pairCandidates={pairCandidates ?? []}
          pairedWith={pairedWith ?? null}
          onPairWith={onPairWith ?? (() => {})}
        />
      )}
    </div>
  );
}

function BiSetPairing({
  exerciseId,
  pairCandidates,
  pairedWith,
  onPairWith,
}: {
  exerciseId?: string;
  pairCandidates: BiSetPairCandidate[];
  pairedWith: BiSetPairCandidate | null;
  onPairWith: (partner: BiSetPairCandidate | null) => void;
}) {
  const available = pairCandidates.filter((c) => c.exerciseId !== exerciseId);

  return (
    <div className="tech-selector__pair">
      <span className="tech-selector__pair-label">Pareie com</span>
      {available.length === 0 ? (
        <span style={{ fontSize: 12, color: "var(--color-text-muted, #64748b)" }}>
          Adicione outro exercício neste dia para parear.
        </span>
      ) : (
        available.map((c) => {
          const selected = pairedWith?.exerciseId === c.exerciseId;
          const takenByOther = !!c.partnerExerciseId && c.partnerExerciseId !== exerciseId;
          return (
            <button
              key={c.exerciseId}
              type="button"
              className="tech-selector__pair-option"
              aria-pressed={selected}
              disabled={takenByOther && !selected}
              onClick={() => onPairWith(selected ? null : c)}
            >
              <span>{c.name}</span>
              <span style={{ fontSize: 10, color: "var(--color-text-muted, #64748b)" }}>
                {takenByOther && !selected ? "pareado" : selected ? "selecionado" : "selecionar"}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
