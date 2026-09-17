import { useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { searchNutritionFoods, type CatalogFoodSummary, type IntakePreviewItem } from "../../services/nutritionIntakeApi";

/** Aceita "12", "12.5" ou "12,5"; string vazia/inválida vira 0. */
function parseMacroInput(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

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
  const [manualOpen, setManualOpen] = useState(false);
  const [query, setQuery] = useState(item.foodQuery);
  const [results, setResults] = useState<CatalogFoodSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualForm, setManualForm] = useState({ name: item.rawText, kcal: "", p: "", c: "", f: "" });

  /**
   * Fallback quando o catálogo TACO não tem correspondência confiável (PLAN
   * P1B corrective §21 — ex.: suplementos como whey, que o TACO nunca
   * cataloga). NUNCA inventa macro — o usuário informa; vira um item
   * `manual`, mesmo caminho já usado/testado no backend para itens
   * digitados manualmente.
   */
  function saveManual() {
    onChange({
      ...item,
      resolved: true,
      name: manualForm.name.trim() || item.rawText,
      grams: item.grams,
      energyKcal: parseMacroInput(manualForm.kcal),
      proteinG: parseMacroInput(manualForm.p),
      carbohydrateG: parseMacroInput(manualForm.c),
      fatG: parseMacroInput(manualForm.f),
      resolver: "manual",
      confidence: "high",
      confirmed: true,
    });
    setManualOpen(false);
  }

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
    if (manualOpen) {
      return (
        <div className="card cardPad" style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 12, flex: 1 }}>Adicionar manualmente</span>
            <button type="button" className="stepper-btn" aria-label="Remover item" onClick={onRemove}>
              <X size={14} />
            </button>
          </div>
          <input
            type="text"
            className="input"
            placeholder="Nome do alimento"
            value={manualForm.name}
            onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value.slice(0, 80) }))}
            autoFocus
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
            <input type="text" inputMode="decimal" className="input" placeholder="kcal" value={manualForm.kcal} onChange={(e) => setManualForm((f) => ({ ...f, kcal: e.target.value }))} />
            <input type="text" inputMode="decimal" className="input" placeholder="Proteína (g)" value={manualForm.p} onChange={(e) => setManualForm((f) => ({ ...f, p: e.target.value }))} />
            <input type="text" inputMode="decimal" className="input" placeholder="Carboidrato (g)" value={manualForm.c} onChange={(e) => setManualForm((f) => ({ ...f, c: e.target.value }))} />
            <input type="text" inputMode="decimal" className="input" placeholder="Gordura (g)" value={manualForm.f} onChange={(e) => setManualForm((f) => ({ ...f, f: e.target.value }))} />
          </div>
          <button type="button" className="btn btn-primary btn-sm hit-target-44" style={{ marginTop: 8, width: "100%" }} disabled={!manualForm.name.trim()} onClick={saveManual}>
            Usar estes valores
          </button>
        </div>
      );
    }
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
        {!searching && query.trim() && results.length === 0 && (
          // Catálogo TACO não tem tudo (suplementos como whey nunca estarão
          // lá, §21) — nunca deixar o usuário travado sem saída.
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Nenhum resultado no catálogo.</div>
        )}
        {!item.resolved && !searchOpen && (
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setSearchOpen(true)}>
            <Search size={13} style={{ marginRight: 4 }} /> Buscar no catálogo
          </button>
        )}
        {!item.resolved && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setManualOpen(true)}>
            Adicionar manualmente
          </button>
        )}
      </div>
    );
  }

  // "medium" (fuzzy plausível, mas não certo) e "low" exigem o mesmo toque
  // explícito antes do Confirmar geral liberar — só a apresentação muda:
  // medium ganha o cartão "Você quis dizer?" (PLAN P1B corrective §14), nunca
  // expondo score/resolver/algoritmo ao usuário. Nem "não" precisa navegar
  // pra fora: "Buscar outro alimento" reaproveita a mesma busca inline do
  // estado não-resolvido.
  const needsConfirmation = item.confidence !== "high" && !item.confirmed;
  const isSuggestion = needsConfirmation && item.confidence === "medium";

  return (
    <div
      className="card cardPad"
      style={{
        marginBottom: 8,
        padding: 12,
        borderColor: needsConfirmation ? "var(--color-warn-border, #F59E0B)" : undefined,
      }}
    >
      {isSuggestion && (
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
          Não encontrei exatamente "{item.rawText}". Você quis dizer?
        </div>
      )}
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
            {isSuggestion ? "Usar este" : "Confirme"}
          </button>
        )}
      </div>

      {isSuggestion && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 8, width: "100%" }}
          onClick={() => {
            setQuery(item.foodQuery);
            setSearchOpen(true);
          }}
        >
          Buscar outro alimento
        </button>
      )}
    </div>
  );
}
