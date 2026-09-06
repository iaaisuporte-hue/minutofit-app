import { useEffect, useId, useRef, useState } from "react";
import { Plus, X, Search } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { searchFoods, fetchFoodMeasures, fetchCustomFoodMeasures, type Food, type FoodMeasure } from "../../services/nutriApi";
import { resolveGrams, calculateNutrition, sumNutrients, type NutrientsPer100g } from "./lib/nutritionCalculation";

export interface MealItemDraft {
  id?: number;
  foodId?: number;
  customFoodId?: number;
  foodName: string;
  per100g: NutrientsPer100g;
  quantity: number;
  unitType: "grams" | "measure";
  measureId?: number;
  customMeasureId?: number;
  measureName?: string;
  measureGrams?: number;
  orderIndex: number;
}

function foodToPer100g(f: Food): NutrientsPer100g {
  return { energyKcal: f.energyKcal, proteinG: f.proteinG, carbohydrateG: f.carbohydrateG, fatG: f.fatG, fiberG: f.fiberG, sodiumMg: f.sodiumMg };
}

/** Preview otimista de UX — o backend sempre recalcula na persistência (SPEC 038 §33). */
export function previewItem(item: MealItemDraft) {
  const grams = resolveGrams(item.quantity, item.unitType, item.unitType === "measure" ? item.measureGrams : undefined);
  return { grams, ...calculateNutrition(item.per100g, grams) };
}

export function previewMealTotal(items: MealItemDraft[]) {
  return sumNutrients(items.map((it) => calculateNutrition(it.per100g, resolveGrams(it.quantity, it.unitType, it.unitType === "measure" ? it.measureGrams : undefined))));
}

/**
 * SPEC 038 / §58: combobox acessível (role=combobox + aria-expanded +
 * aria-controls + aria-activedescendant) para buscar alimento do catálogo.
 * Fluxo de adição em UMA superfície (busca → seleciona → quantidade),
 * evitando o "modal de 5 etapas" que a spec pede para não fazer (§52).
 */
export function AddFoodItemControl({ onAdd }: { onAdd: (item: MealItemDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<Food | null>(null);
  const [measures, setMeasures] = useState<FoodMeasure[]>([]);
  const [quantity, setQuantity] = useState("100");
  const [unitType, setUnitType] = useState<"grams" | "measure">("grams");
  const [measureId, setMeasureId] = useState<number | null>(null);
  const inputId = useId();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || selected) return;
    const t = setTimeout(() => {
      searchFoods(query, 15).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, selected]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function reset() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setSelected(null);
    setMeasures([]);
    setQuantity("100");
    setUnitType("grams");
    setMeasureId(null);
  }

  async function selectFood(food: Food) {
    setSelected(food);
    setOpen(false);
    setUnitType("grams");
    setMeasureId(null);
    const fetchMeasures = food.kind === "custom" ? fetchCustomFoodMeasures : fetchFoodMeasures;
    try {
      const m = await fetchMeasures(food.id);
      setMeasures(m);
    } catch {
      setMeasures([]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (activeIndex >= 0) void selectFood(results[activeIndex]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  function handleConfirmAdd() {
    if (!selected) return;
    const q = Number(quantity);
    if (!(q > 0)) return;
    const measure = measures.find((m) => m.id === measureId);
    onAdd({
      foodId: selected.kind === "catalog" ? selected.id : undefined,
      customFoodId: selected.kind === "custom" ? selected.id : undefined,
      foodName: selected.name,
      per100g: foodToPer100g(selected),
      quantity: q,
      unitType,
      measureId: selected.kind === "catalog" ? (measureId ?? undefined) : undefined,
      customMeasureId: selected.kind === "custom" ? (measureId ?? undefined) : undefined,
      measureName: measure?.name,
      measureGrams: measure?.grams,
      orderIndex: 0,
    });
    reset();
  }

  if (!open && !selected) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} style={{ width: "100%", border: "1px dashed var(--color-border)" }}>
        <Plus size={14} aria-hidden="true" /> Adicionar alimento
      </button>
    );
  }

  return (
    <div ref={containerRef} className="card cardPad" style={{ background: "var(--color-surface-raised)" }}>
      {!selected ? (
        <div style={{ position: "relative" }}>
          <label className="label" htmlFor={inputId}>Buscar alimento</label>
          <div style={{ position: "relative" }}>
            <Search size={14} aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }} />
            <input
              id={inputId}
              className="input"
              style={{ paddingLeft: 30 }}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
              autoComplete="off"
              placeholder="Ex: arroz, frango, banana..."
              value={query}
              autoFocus
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
            />
          </div>
          {open && results.length > 0 && (
            <ul id={listId} role="listbox" className="card" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, marginTop: 4, maxHeight: 240, overflowY: "auto", padding: "var(--space-1)", listStyle: "none" }}>
              {results.map((f, i) => (
                <li
                  key={`${f.kind}-${f.id}`}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => { e.preventDefault(); void selectFood(f); }}
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: i === activeIndex ? "var(--color-primary-soft)" : "transparent",
                  }}
                >
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: COLORS.text }}>
                    {f.name} {f.kind === "custom" && <span className="badge badge-info" style={{ marginLeft: 4 }}>meu</span>}
                  </div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                    {f.category ?? "Alimento customizado"} · {f.energyKcal} kcal / 100g
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: "var(--space-2)" }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: COLORS.text }}>{selected.name}</div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ gap: 0, width: 90 }}>
              <label className="label" style={{ fontSize: "var(--text-xs)" }} htmlFor={`${inputId}-qty`}>Quantidade</label>
              <input id={`${inputId}-qty`} className="input" type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="field" style={{ gap: 0, minWidth: 140 }}>
              <label className="label" style={{ fontSize: "var(--text-xs)" }} htmlFor={`${inputId}-unit`}>Unidade</label>
              <select
                id={`${inputId}-unit`}
                className="input"
                value={unitType === "grams" ? "grams" : `measure:${measureId ?? ""}`}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "grams") { setUnitType("grams"); setMeasureId(null); }
                  else { setUnitType("measure"); setMeasureId(Number(v.split(":")[1])); }
                }}
              >
                <option value="grams">gramas (g)</option>
                {measures.map((m) => (
                  <option key={m.id} value={`measure:${m.id}`}>{m.name} ({m.grams}g)</option>
                ))}
              </select>
            </div>
            {unitType === "measure" && measureId != null && Number(quantity) > 0 && (
              <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                ≈ {resolveGrams(Number(quantity), "measure", measures.find((m) => m.id === measureId)?.grams)}g
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancelar</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirmAdd} disabled={!(Number(quantity) > 0)}>
              Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Linha de item já adicionado — mostra kcal/macros calculados (preview) e permite remover. */
export function MealItemRow({ item, onRemove }: { item: MealItemDraft; onRemove: () => void }) {
  const calc = previewItem(item);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: COLORS.text }}>
          {item.foodName}
          <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
            {item.unitType === "measure" && item.measureName ? `${item.quantity} ${item.measureName} (≈${calc.grams}g)` : `${calc.grams}g`}
          </span>
        </div>
        <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
          {calc.energyKcal} kcal · P {calc.proteinG}g · C {calc.carbohydrateG}g · G {calc.fatG}g
          {calc.fiberG != null && ` · F ${calc.fiberG}g`}
        </div>
      </div>
      <button type="button" className="btn btn-ghost" style={{ minWidth: 36, padding: "var(--space-1)" }} onClick={onRemove} aria-label={`Remover ${item.foodName}`}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
