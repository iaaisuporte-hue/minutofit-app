import { useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { searchNutritionFoods, type CatalogFoodSummary, type IntakePreviewItem } from "../../services/nutritionIntakeApi";

const GRAMS_STEP = 10;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Recalcula os macros do item a partir do per100g já conhecido — sem nova chamada de rede. */
export function recomputeItemGrams(item: IntakePreviewItem, grams: number): IntakePreviewItem {
  if (!item.per100g) return item;
  const factor = grams / 100;
  return {
    ...item,
    grams,
    energyKcal: round1(item.per100g.kcal * factor),
    proteinG: round1(item.per100g.p * factor),
    carbohydrateG: round1(item.per100g.c * factor),
    fatG: round1(item.per100g.f * factor),
  };
}

/**
 * Uma linha de item no sheet de registro (PLAN_NUTRITION_QUICK_MACROS P1B).
 * Três estados visuais: resolvido/confirmado (normal), baixa confiança
 * (badge "confirme", exige toque antes do Confirmar geral ficar liberado),
 * e não resolvido ("?", abre busca inline no catálogo ou remove).
 */
export function IntakeItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: IntakePreviewItem;
  onChange: (next: IntakePreviewItem) => void;
  onRemove: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(item.foodQuery);
  const [results, setResults] = useState<CatalogFoodSummary[]>([]);
  const [searching, setSearching] = useState(false);

  async function runSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchNutritionFoods(q));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickFood(food: CatalogFoodSummary) {
    const grams = item.grams && item.grams > 0 ? item.grams : 100;
    const factor = grams / 100;
    onChange({
      ...item,
      resolved: true,
      foodId: food.id,
      name: food.name,
      grams,
      per100g: { kcal: food.energyKcal, p: food.proteinG, c: food.carbohydrateG, f: food.fatG },
      energyKcal: round1(food.energyKcal * factor),
      proteinG: round1(food.proteinG * factor),
      carbohydrateG: round1(food.carbohydrateG * factor),
      fatG: round1(food.fatG * factor),
      resolver: "catalog",
      confidence: "high",
      confirmed: true,
    });
    setSearchOpen(false);
  }

  if (!item.resolved || searchOpen) {
    return (
      <div className="card cardPad" style={{ marginBottom: 8, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: COLORS.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            "{item.rawText}"
          </span>
          <button type="button" className="stepper-btn" aria-label="Remover item" onClick={onRemove}>
            <X size={14} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            className="input"
            style={{ flex: 1 }}
            placeholder="Buscar alimento…"
            value={query}
            onChange={(e) => void runSearch(e.target.value)}
            autoFocus={searchOpen}
          />
        </div>
        {searching && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>Buscando…</div>}
        {!searching && results.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {results.map((f) => (
              <button
                key={f.id}
                type="button"
                className="btn btn-sm hit-target-44"
                style={{ justifyContent: "flex-start", textAlign: "left" }}
                onClick={() => pickFood(f)}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
        {!item.resolved && !searchOpen && (
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setSearchOpen(true)}>
            <Search size={13} style={{ marginRight: 4 }} /> Buscar no catálogo
          </button>
        )}
      </div>
    );
  }

  const needsConfirmation = item.confidence === "low" && !item.confirmed;

  return (
    <div
      className="card cardPad"
      style={{
        marginBottom: 8,
        padding: 12,
        borderColor: needsConfirmation ? "var(--color-warn-border, #F59E0B)" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.name}
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            ≈ {item.energyKcal} kcal · P {item.proteinG}g · C {item.carbohydrateG}g · G {item.fatG}g
          </div>
        </div>
        <button type="button" className="stepper-btn" aria-label="Remover item" onClick={onRemove}>
          <X size={14} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        {/* Item "como no plano" é a quantidade PRESCRITA — o servidor sempre grava o
            snapshot original, então o stepper aqui ficaria enganoso; só exibe o valor. */}
        {item.resolver === "plan" ? (
          <span style={{ fontSize: 12, color: COLORS.muted }}>{item.grams}g (prescrito)</span>
        ) : (
          <div className="stepper" role="group" aria-label={`Gramas de ${item.name}`}>
            <button
              type="button"
              className="stepper-btn"
              aria-label="Diminuir"
              onClick={() => onChange(recomputeItemGrams(item, Math.max(GRAMS_STEP, (item.grams ?? GRAMS_STEP) - GRAMS_STEP)))}
            >
              <Minus size={14} />
            </button>
            <span className="stepper-value">{item.grams}g</span>
            <button
              type="button"
              className="stepper-btn"
              aria-label="Aumentar"
              onClick={() => onChange(recomputeItemGrams(item, (item.grams ?? 0) + GRAMS_STEP))}
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {needsConfirmation && (
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: "var(--color-warn-soft, #FEF3C7)", borderColor: "var(--color-warn-border, #F59E0B)" }}
            onClick={() => onChange({ ...item, confirmed: true })}
          >
            Confirme
          </button>
        )}
      </div>
    </div>
  );
}
