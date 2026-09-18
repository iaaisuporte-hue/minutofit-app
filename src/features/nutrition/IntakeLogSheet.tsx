import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import { IntakeItemRow } from "./IntakeItemRow";
import {
  parseIntakeText,
  submitIntakeLog,
  updateIntakeLog,
  deleteIntakeLog,
  getIntakeShortcuts,
  type IntakePreviewItem,
  type IntakeItemRequest,
  type IntakeShortcuts,
  type IntakeLogRecord,
  type NutritionIntakeMeal,
  type IntakeSource,
  type PersistedIntakeItem,
  type PlanMealItemRef,
} from "../../services/nutritionIntakeApi";

/** Opções fixas de "momento da refeição" para o registro extra (PLAN P1B corrective §9/§10). */
const MEAL_TYPE_OPTIONS = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia", "Outro"];

/**
 * Sugestão de momento pelo horário atual — só UX, o usuário troca livremente
 * (§9: "a sugestão de horário é apenas UX"). Faixas largas de propósito.
 */
function suggestMealType(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 9) return "Café da manhã";
  if (h < 11) return "Lanche da manhã";
  if (h < 14) return "Almoço";
  if (h < 17) return "Lanche da tarde";
  if (h < 21) return "Jantar";
  return "Ceia";
}

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
    quantity: it.quantity ?? undefined,
    unitLabel: it.unitLabel ?? undefined,
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
  // Sem correspondência confiável no catálogo (ex.: whey — PLAN P1B
  // corrective §21) — o usuário informou os macros diretamente; nunca
  // inventados pelo servidor, mesmo item `manual` já validado no backend.
  if (item.resolver === "manual" || item.resolver === "history") {
    // "history" (P1B.1 — reaproveitado do próprio histórico do usuário, ex.:
    // whey na 2ª vez) persiste como `manual`: o backend já recalculou os
    // macros a partir do histórico no preview; não há um `foodId` de
    // catálogo para referenciar de volta.
    return {
      kind: "manual",
      name: item.name || item.rawText,
      grams: item.grams ?? null,
      energyKcal: item.energyKcal ?? 0,
      proteinG: item.proteinG ?? 0,
      carbohydrateG: item.carbohydrateG ?? 0,
      fatG: item.fatG ?? 0,
      displayQuantity: item.quantity ?? null,
      displayUnitLabel: item.unitLabel ?? null,
    };
  }
  return {
    kind: "food",
    foodId: item.foodId!,
    quantity: item.grams ?? 0,
    unitType: "grams",
    rawText: item.rawText || undefined,
    confirmed: item.confirmed,
    displayQuantity: item.quantity ?? null,
    displayUnitLabel: item.unitLabel ?? null,
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
 * `editingMeal` presente = modo edição: os itens já persistidos entram
 * pré-carregados (mesma conversão de `persistedToWorking` já usada para
 * repetir favoritos/ontem), o botão salva via PATCH em vez de POST, e
 * `dateKey`/`loggedAt`/`mealId` originais NUNCA são tocados — o editor só
 * manda `label`/`items`/`source` (§9). `editingMeal` é a refeição JÁ
 * AGRUPADA (PLAN P1B corrective "Agrupamento por Refeição") — normalmente 1
 * linha física (`sourceLogIds.length === 1`); no raro caso legado de >1,
 * salvar consolida tudo na primeira e apaga as demais (nunca deixa 2 linhas
 * representando a mesma refeição).
 *
 * `defaultMealId` (vindo de uma refeição ESPECÍFICA do plano) fixa o rótulo
 * como o nome dessa refeição (`defaultMealLabel`) — não há o que perguntar.
 * Sem `defaultMealId` (CTA genérico "+ Registrar refeição"), o momento é
 * sugerido pelo horário e o usuário pode trocar (§9/§10) — a refeição
 * resultante nasce SEM `mealId` (extra, fora do plano, §7).
 */
export function IntakeLogSheet({
  open,
  onClose,
  onSaved,
  defaultMealId,
  defaultMealLabel,
  editingMeal,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (log: IntakeLogRecord) => void;
  defaultMealId?: number | null;
  defaultMealLabel?: string | null;
  editingMeal?: NutritionIntakeMeal | null;
}) {
  const [shortcuts, setShortcuts] = useState<IntakeShortcuts | null>(null);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [items, setItems] = useState<WorkingItem[]>([]);
  const [source, setSource] = useState<IntakeSource>("manual");
  const [mealType, setMealType] = useState(suggestMealType());
  const [customMealType, setCustomMealType] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingMeal != null;
  const isExtraFlow = !isEditing && defaultMealId == null;

  useEffect(() => {
    if (!open) return;
    setText("");
    setError(null);
    setMealType(suggestMealType());
    setCustomMealType("");
    if (editingMeal) {
      setLabel(editingMeal.label);
      setItems(persistedToWorking(editingMeal.items));
      setSource("manual");
    } else {
      setLabel("");
      setItems([]);
      setSource("manual");
    }
    getIntakeShortcuts().then(setShortcuts).catch(() => setShortcuts(null));
  }, [open, editingMeal]);

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
      // `aiUsed` só reflete se a IA (opcional, ROLLOUT_ONLY) interpretou o
      // texto — a confiança de cada item já vem do Resolver de qualquer
      // forma; isto é só telemetria de origem (P1B.1 "Smart Food Logging").
      setSource(preview.aiUsed ? "parse_ai" : "parse");
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

  // Rótulo final: refeição do plano usa o nome fixo dela; editar preserva o
  // que já existia; um atalho (chip) já traz rótulo próprio e específico
  // ("Como no plano: Almoço") — nunca sobrescrito pelo momento sugerido; só
  // quando NADA disso se aplica (texto livre puro, sem chip) o momento
  // escolhido/sugerido decide o rótulo (§9).
  const effectiveLabel = isEditing
    ? label
    : defaultMealId != null
    ? defaultMealLabel || "Refeição"
    : label
    ? label
    : mealType === "Outro"
    ? customMealType.trim().slice(0, 80) || "Refeição"
    : mealType;

  // O seletor de momento só faz sentido quando NENHUM atalho definiu um
  // rótulo próprio — mostrá-lo depois de um chip ("Como no plano: Almoço")
  // seria redundante e daria a impressão de que ele pode ser trocado.
  const showMealTypePicker = isExtraFlow && items.length > 0 && !label;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    setError(null);
    try {
      const requests: IntakeItemRequest[] = items.map(previewToRequest);
      let log: IntakeLogRecord;
      if (editingMeal) {
        const [primaryId, ...extraIds] = editingMeal.sourceLogIds;
        log = await updateIntakeLog(primaryId, { label: effectiveLabel, rawText: text.trim() || null, items: requests, source });
        // Caso raro de refeição legada agregando >1 linha física — consolida
        // tudo na primeira e apaga as demais (nunca deixa 2 linhas para a
        // mesma refeição depois de uma edição).
        if (extraIds.length > 0) await Promise.all(extraIds.map((id) => deleteIntakeLog(id)));
      } else {
        log = await submitIntakeLog({
          label: effectiveLabel,
          rawText: text.trim() || null,
          mealId: defaultMealId ?? null,
          items: requests,
          source,
        });
      }
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

        {showMealTypePicker && (
          <div>
            <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }} htmlFor="intake-meal-type">
              Refeição
            </label>
            <select
              id="intake-meal-type"
              className="input"
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
            >
              {MEAL_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {mealType === "Outro" && (
              <input
                type="text"
                className="input"
                style={{ marginTop: 6 }}
                placeholder="Ex.: Pré-treino"
                value={customMealType}
                onChange={(e) => setCustomMealType(e.target.value.slice(0, 80))}
              />
            )}
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
