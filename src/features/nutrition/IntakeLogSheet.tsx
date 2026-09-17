import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import { IntakeItemRow } from "./IntakeItemRow";
import {
  parseIntakeText,
  submitIntakeLog,
  updateIntakeLog,
  getIntakeShortcuts,
  type IntakePreviewItem,
  type IntakeItemRequest,
  type IntakeShortcuts,
  type IntakeLogRecord,
  type IntakeSource,
  type PersistedIntakeItem,
  type PlanMealItemRef,
} from "../../services/nutritionIntakeApi";

type WorkingItem = IntakePreviewItem & { planMealItemId?: number };

function persistedToWorking(items: PersistedIntakeItem[]): WorkingItem[] {
  return items.map((it) => ({
    resolved: true,
    rawText: it.name,
    foodQuery: it.name,
    foodId: it.foodId,
    name: it.name,
    grams: it.grams ?? undefined,
    per100g: it.per100g,
    energyKcal: it.energyKcal,
    proteinG: it.proteinG,
    carbohydrateG: it.carbohydrateG,
    fatG: it.fatG,
    resolver: it.resolver,
    confidence: "high",
    confirmed: true,
  }));
}

function planToWorking(items: PlanMealItemRef[]): WorkingItem[] {
  return items.map((it) => ({
    resolved: true,
    rawText: it.foodName,
    foodQuery: it.foodName,
    name: it.foodName,
    grams: it.grams,
    energyKcal: it.energyKcal,
    proteinG: it.proteinG,
    carbohydrateG: it.carbohydrateG,
    fatG: it.fatG,
    resolver: "plan",
    confidence: "high",
    confirmed: true,
    planMealItemId: it.id,
  }));
}

function previewToRequest(item: WorkingItem): IntakeItemRequest {
  if (item.resolver === "plan" && item.planMealItemId != null) {
    return { kind: "plan", planMealItemId: item.planMealItemId };
  }
  return {
    kind: "food",
    foodId: item.foodId!,
    quantity: item.grams ?? 0,
    unitType: "grams",
    rawText: item.rawText || undefined,
    confirmed: item.confirmed,
  };
}

function sumTotals(items: WorkingItem[]) {
  return items
    .filter((i) => i.resolved)
    .reduce(
      (acc, i) => ({
        energyKcal: acc.energyKcal + (i.energyKcal ?? 0),
        proteinG: acc.proteinG + (i.proteinG ?? 0),
        carbohydrateG: acc.carbohydrateG + (i.carbohydrateG ?? 0),
        fatG: acc.fatG + (i.fatG ?? 0),
      }),
      { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 }
    );
}

/**
 * Bottom sheet "Registrar refeição" (PLAN_NUTRITION_QUICK_MACROS P1B).
 *
 * Caminho rápido (chip → confirmar): 3 toques no total, contando o toque que
 * abriu o sheet. Caminho de texto: digitar → Estimar → revisar → Confirmar.
 * Confirmar fica desabilitado enquanto existir item não resolvido OU item de
 * baixa confiança sem toque explícito de aceite — a MESMA regra que o
 * backend aplica (§9): isto é UX, não é a garantia.
 *
 * MESMO editor serve para criar e editar (PLAN P1B corrective — "Consulta +
 * Edição"; §3 pede explicitamente reaproveitar, nunca duas implementações).
 * `editingLog` presente = modo edição: os itens já persistidos entram
 * pré-carregados (mesma conversão de `persistedToWorking` já usada para
 * repetir favoritos/ontem), o botão salva via PATCH em vez de POST, e
 * `dateKey`/`loggedAt`/`mealId` originais NUNCA são tocados — o editor só
 * manda `label`/`items`/`source` (§9).
 */
export function IntakeLogSheet({
  open,
  onClose,
  onSaved,
  defaultMealId,
  editingLog,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (log: IntakeLogRecord) => void;
  defaultMealId?: number | null;
  editingLog?: IntakeLogRecord | null;
}) {
  const [shortcuts, setShortcuts] = useState<IntakeShortcuts | null>(null);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [items, setItems] = useState<WorkingItem[]>([]);
  const [source, setSource] = useState<IntakeSource>("manual");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingLog != null;

  useEffect(() => {
    if (!open) return;
    setText("");
    setError(null);
    if (editingLog) {
      setLabel(editingLog.label);
      setItems(persistedToWorking(editingLog.items));
      setSource(editingLog.source as IntakeSource);
    } else {
      setLabel("");
      setItems([]);
      setSource("manual");
    }
    getIntakeShortcuts().then(setShortcuts).catch(() => setShortcuts(null));
  }, [open, editingLog]);

  async function handleEstimate() {
    if (!text.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const preview = await parseIntakeText(text);
      // Com itens já presentes (edição, ou uma segunda estimativa sobre a
      // mesma refeição), o texto novo ACRESCENTA alimento — nunca substitui
      // o que já estava confirmado (PLAN P1B corrective §3, "adicionar
      // alimento" reaproveita o mesmo caminho de texto, não um botão novo).
      setItems((prev) => (prev.length > 0 ? [...prev, ...preview.items] : preview.items));
      if (items.length === 0 && !isEditing) setLabel(text.trim().slice(0, 80));
      setSource("parse");
      setText("");
    } catch {
      setError("Não foi possível interpretar o texto. Tente descrever de outro jeito.");
    } finally {
      setParsing(false);
    }
  }

  function applyShortcut(shortcutLabel: string, working: WorkingItem[], src: IntakeSource) {
    setItems(working);
    setLabel(shortcutLabel);
    setSource(src);
    setText("");
  }

  const totals = sumTotals(items);
  const hasUnresolved = items.some((i) => !i.resolved);
  // "medium" (fuzzy "você quis dizer") exige o mesmo toque explícito de
  // aceite que "low" já exigia — mesma regra do backend (PLAN P1B corrective §15).
  const hasUnconfirmedLow = items.some((i) => i.resolved && i.confidence !== "high" && !i.confirmed);
  const canConfirm = items.length > 0 && !hasUnresolved && !hasUnconfirmedLow && !saving;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    setError(null);
    try {
      const requests: IntakeItemRequest[] = items.map(previewToRequest);
      const log = editingLog
        ? await updateIntakeLog(editingLog.id, { label: label || "Refeição", rawText: text.trim() || null, items: requests, source })
        : await submitIntakeLog({
            label: label || "Refeição",
            rawText: text.trim() || null,
            mealId: defaultMealId ?? null,
            items: requests,
            source,
          });
      onSaved(log);
      onClose();
    } catch {
      setError(isEditing ? "Não foi possível salvar as alterações. Tente novamente." : "Não foi possível registrar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DrawerShell open={open} onClose={onClose} ariaLabel={isEditing ? "Editar refeição" : "Registrar refeição"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "80dvh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
          {isEditing ? "Editar refeição" : "Registrar refeição"}
        </div>

        <input
          ref={inputRef}
          type="text"
          className="input"
          placeholder={items.length > 0 ? "Adicionar outro alimento…" : "Ex.: 200g de frango + 150g de arroz + 2 ovos"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleEstimate();
          }}
        />
        <button type="button" className="btn btn-sm" disabled={!text.trim() || parsing} onClick={() => void handleEstimate()}>
          {parsing ? "Estimando..." : items.length > 0 ? "Adicionar" : "Estimar"}
        </button>

        {/* Atalhos substituem a lista inteira — fazem sentido para começar uma
            refeição do zero, não para editar uma já confirmada (substituiria
            silenciosamente o que o usuário está corrigindo). */}
        {shortcuts && !isEditing && (
          <div role="toolbar" aria-label="Atalhos de refeição" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {shortcuts.planMeals.map((m) => (
              <button
                key={`plan-${m.mealId}`}
                type="button"
                className="btn btn-sm hit-target-44"
                onClick={() => applyShortcut(`Como no plano: ${m.name}`, planToWorking(m.items), "plan")}
              >
                Como no plano: {m.name}
              </button>
            ))}
            {shortcuts.yesterdayMeals.map((m) => (
              <button
                key={`y-${m.logId}`}
                type="button"
                className="btn btn-sm hit-target-44"
                onClick={() => applyShortcut(`Ontem: ${m.label}`, persistedToWorking(m.items), "repeat")}
              >
                Ontem: {m.label}
              </button>
            ))}
            {shortcuts.favorites.map((m) => (
              <button
                key={`f-${m.id}`}
                type="button"
                className="btn btn-sm hit-target-44"
                onClick={() => applyShortcut(m.label, persistedToWorking(m.items), "favorite")}
              >
                <Star size={12} style={{ marginRight: 4 }} />
                {m.label}
              </button>
            ))}
            {shortcuts.recent.map((m, i) => (
              <button
                key={`r-${i}-${m.label}`}
                type="button"
                className="btn btn-sm hit-target-44"
                onClick={() => applyShortcut(m.label, persistedToWorking(m.items), "repeat")}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div>
            {items.map((item, i) => (
              <IntakeItemRow
                key={`${item.rawText}-${i}`}
                item={item}
                onChange={(next) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...next, planMealItemId: it.planMealItemId } : it)))}
                onRemove={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            {hasUnresolved ? (
              // 0 significa "zero calorias", nunca "desconhecido" — enquanto
              // houver item não identificado, não existe total a mostrar
              // (PLAN P1B corrective §13).
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Identifique os alimentos abaixo para calcular o total.
              </div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>
                Total: ≈ {Math.round(totals.energyKcal)} kcal · P {Math.round(totals.proteinG)}g · C {Math.round(totals.carbohydrateG)}g · G{" "}
                {Math.round(totals.fatG)}g
              </div>
            )}
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, position: "sticky", bottom: "var(--kb-inset, 0)", background: "var(--color-surface)", paddingTop: 8 }}>
          <button type="button" className="btn btn-ghost hit-target-44" style={{ flex: 1 }} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary hit-target-44" style={{ flex: 1 }} disabled={!canConfirm} onClick={() => void handleConfirm()}>
            {saving ? "Salvando..." : isEditing ? "Salvar" : "Confirmar"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, textAlign: "center" }}>
          Valores estimados pelo catálogo TACO.
        </div>
      </div>
    </DrawerShell>
  );
}
