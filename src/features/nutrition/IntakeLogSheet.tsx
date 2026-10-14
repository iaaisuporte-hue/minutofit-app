import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { IntakeItemRow, displayTitle } from "./IntakeItemRow";
import { persistedToWorking, planToWorking, sumTotals, type WorkingItem } from "./intakeWorking";
import { useMealWorkspace } from "./useMealWorkspace";
import {
  parseIntakeText,
  getIntakeShortcuts,
  type IntakeShortcuts,
  type IntakeLogRecord,
  type NutritionIntakeMeal,
  type IntakeSource,
  type PersistedIntakeItem,
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

function quantityText(item: PersistedIntakeItem): string {
  if (item.quantity != null && item.unitLabel) return `${item.quantity} ${item.unitLabel}`;
  if (item.grams != null) return `${Math.round(item.grams)} g`;
  return "";
}

/**
 * Folha "Registrar refeição" — ESPAÇO DE TRABALHO da refeição (registro alimentar incremental).
 *
 * Cada alimento confirmado é gravado NA HORA (ver `useMealWorkspace`) e a folha continua aberta: o aluno lança
 * pão, depois ovo, depois leite, vendo a lista e o total acumulado, e só toca em "Pronto" quando terminar — "Pronto"
 * encerra a SESSÃO DE LANÇAMENTO, não cria status de refeição nem mexe em adesão. Abrir uma refeição que já tem
 * registro hoje retoma a lista (esqueceu a bebida? abre e adiciona).
 *
 * - Leitura de ALTA confiança entra direto, com "Desfazer"; média/baixa/não resolvida continua pedindo o toque de
 *   confirmação (mesma regra do backend, PLAN P1B corrective §15) e fica em "Falta confirmar" até ser adicionada.
 * - Itens salvos podem ser editados (quantidade/alimento) ou removidos (com "Desfazer"); remover o último apaga a
 *   refeição (pede confirmação).
 * - Sem "Cancelar" depois que algo foi salvo: cada item tem o seu remover.
 * - MESMO editor serve para criar e editar (`editingMeal`): os itens já persistidos entram como salvos.
 * - `defaultMealId` fixa o rótulo da refeição do plano; sem ele (CTA genérico) o momento é sugerido pelo horário e a
 *   refeição nasce SEM `mealId` (extra, fora do plano, §7).
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
  /** Depois de CADA gravação (adicionar/editar/remover) — o pai atualiza totais sem fechar a folha. `null` = refeição apagada. */
  onSaved: (log: IntakeLogRecord | null) => void;
  defaultMealId?: number | null;
  defaultMealLabel?: string | null;
  editingMeal?: NutritionIntakeMeal | null;
}) {
  const [shortcuts, setShortcuts] = useState<IntakeShortcuts | null>(null);
  const [text, setText] = useState("");
  const [shortcutLabel, setShortcutLabel] = useState("");
  const [pending, setPending] = useState<WorkingItem[]>([]);
  const [pendingSource, setPendingSource] = useState<IntakeSource>("manual");
  const [mealType, setMealType] = useState(suggestMealType());
  const [customMealType, setCustomMealType] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<WorkingItem | null>(null);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = editingMeal != null;
  const isExtraFlow = !isEditing && defaultMealId == null;
  const mealId = isEditing ? editingMeal.mealId : defaultMealId ?? null;
  const ws = useMealWorkspace({ open, mealId, editingMeal, onChanged: onSaved });

  useEffect(() => {
    if (!open) return;
    setText("");
    setShortcutLabel("");
    setPending([]);
    setPendingSource("manual");
    setMealType(suggestMealType());
    setCustomMealType("");
    setError(null);
    setEditIndex(null);
    setEditDraft(null);
    setConfirmRemoveAll(false);
    setCloseBlocked(false);
    getIntakeShortcuts().then(setShortcuts).catch(() => setShortcuts(null));
  }, [open, editingMeal]);

  const hasAnything = ws.saved.length > 0 || ws.inflight.length > 0;

  // Rótulo da refeição ainda NÃO gravada: refeição do plano usa o nome fixo; atalho traz rótulo próprio; texto livre
  // usa o momento escolhido/sugerido (§9). Depois da 1ª gravação o rótulo é o do servidor e não muda mais.
  const firstLabel = isEditing
    ? editingMeal.label
    : defaultMealId != null
    ? defaultMealLabel || "Refeição"
    : shortcutLabel
    ? shortcutLabel
    : mealType === "Outro"
    ? customMealType.trim().slice(0, 80) || "Refeição"
    : mealType;
  const title = ws.label ?? firstLabel;
  const showMealTypePicker = isExtraFlow && !hasAnything && ws.logId == null && !shortcutLabel;

  const hasUnresolved = pending.some((i) => !i.resolved);
  const hasUnconfirmed = pending.some((i) => i.resolved && i.confidence !== "high" && !i.confirmed);
  const canAddPending = pending.length > 0 && !hasUnresolved && !hasUnconfirmed;
  const pendingTotals = sumTotals(pending);

  async function handleSubmitText() {
    const value = text.trim();
    if (!value || parsing) return;
    setParsing(true);
    setError(null);
    try {
      const preview = await parseIntakeText(value);
      const source: IntakeSource = preview.aiUsed ? "parse_ai" : "parse";
      // Alta confiança entra direto (com "Desfazer"); o resto fica em "Falta confirmar" — nunca salva palpite.
      const direct = preview.items.filter((i) => i.resolved && i.confidence === "high");
      const rest = preview.items.filter((i) => !(i.resolved && i.confidence === "high"));
      if (direct.length > 0) ws.addItems(direct, { label: firstLabel, source, rawText: value });
      if (rest.length > 0) {
        setPending((prev) => [...prev, ...rest]);
        setPendingSource(source);
      }
      setText("");
      inputRef.current?.focus();
    } catch {
      setError("Não foi possível interpretar o texto. Tente descrever de outro jeito.");
    } finally {
      setParsing(false);
    }
  }

  function addPending() {
    if (!canAddPending) return;
    ws.addItems(pending, { label: firstLabel, source: pendingSource, rawText: null });
    setPending([]);
    setShortcutLabel("");
    inputRef.current?.focus();
  }

  function applyShortcut(label: string, working: WorkingItem[], src: IntakeSource) {
    setPending(working);
    setPendingSource(src);
    setShortcutLabel(label);
    setText("");
  }

  async function requestClose() {
    const { ok } = await ws.flush();
    if (ok) onClose();
    else setCloseBlocked(true);
  }

  function requestRemove(index: number) {
    if (ws.saved.length <= 1) setConfirmRemoveAll(true);
    else ws.removeItem(index);
  }

  const showUndoAdd = ws.lastAdded != null && ws.pendingRemoval == null;

  return (
    <DrawerShell open={open} onClose={() => void requestClose()} ariaLabel={isEditing ? "Editar refeição" : "Registrar refeição"}>
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "80dvh" }}>
        {/* Cabeçalho + conteúdo rolável */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, flex: "1 1 auto", minHeight: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{title}</div>
            <div className="muted" style={{ fontSize: 12 }} data-testid="workspace-count">
              {ws.loading
                ? "Carregando…"
                : ws.saved.length === 0
                ? "Nenhum alimento salvo ainda"
                : `${ws.saved.length} ${ws.saved.length === 1 ? "alimento salvo" : "alimentos salvos"}`}
            </div>
          </div>

          {/* Itens SALVOS (vêm do servidor) */}
          {ws.saved.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }} aria-label="Alimentos salvos">
              {ws.saved.map(({ item, index }) =>
                editIndex === index && editDraft ? (
                  <li key={`edit-${index}`}>
                    <IntakeItemRow item={editDraft} onChange={setEditDraft} onRemove={() => { setEditIndex(null); setEditDraft(null); }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button type="button" className="btn btn-ghost btn-sm hit-target-44" onClick={() => { setEditIndex(null); setEditDraft(null); }}>
                        Cancelar edição
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm hit-target-44"
                        disabled={!editDraft.resolved || (editDraft.confidence !== "high" && !editDraft.confirmed)}
                        onClick={() => {
                          void ws.replaceItem(index, editDraft);
                          setEditIndex(null);
                          setEditDraft(null);
                        }}
                      >
                        Salvar item
                      </button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={`saved-${index}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 10 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, overflowWrap: "anywhere" }}>
                        {displayTitle(item.canonicalFood ?? undefined, item.name)}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {quantityText(item)} · {Math.round(item.energyKcal)} kcal
                      </div>
                    </div>
                    {item.resolver !== "plan" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm hit-target-44"
                        aria-label={`Editar ${item.name}`}
                        onClick={() => {
                          setEditIndex(index);
                          setEditDraft(persistedToWorking([item])[0]);
                        }}
                      >
                        Editar
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm hit-target-44"
                      aria-label={`Remover ${item.name}`}
                      onClick={() => requestRemove(index)}
                    >
                      Remover
                    </button>
                  </li>
                )
              )}
            </ul>
          )}

          {/* Em gravação / falhou */}
          {ws.inflight.map((op) => (
            <div
              key={op.key}
              role={op.status === "failed" ? "alert" : "status"}
              style={{ padding: "8px 10px", border: `1px dashed ${op.status === "failed" ? "var(--color-danger)" : COLORS.border}`, borderRadius: 10, fontSize: 13 }}
            >
              <div style={{ fontWeight: 600 }}>{op.items.map((i) => i.name || i.rawText).join(", ")}</div>
              {op.status === "saving" ? (
                <span className="muted">Salvando…</span>
              ) : (
                <>
                  <div style={{ color: "var(--color-danger)" }}>{op.error}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button type="button" className="btn btn-sm hit-target-44" onClick={() => ws.retry(op.key)}>Tentar de novo</button>
                    <button type="button" className="btn btn-ghost btn-sm hit-target-44" onClick={() => ws.discard(op.key)}>Descartar</button>
                  </div>
                </>
              )}
            </div>
          ))}

          {ws.saved.length > 0 && (
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }} data-testid="workspace-totals">
              Total salvo: ≈ {Math.round(ws.totals.energyKcal)} kcal · P {Math.round(ws.totals.proteinG)}g · C {Math.round(ws.totals.carbohydrateG)}g · G{" "}
              {Math.round(ws.totals.fatG)}g
            </div>
          )}

          {/* Falta confirmar: nunca entra na refeição nem no total até o aluno aceitar */}
          {pending.length > 0 && (
            <div aria-label="Falta confirmar" style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted }}>Falta confirmar</div>
              {pending.map((item, i) => (
                <IntakeItemRow
                  key={`${item.rawText}-${i}`}
                  item={item}
                  onChange={(next) => setPending((prev) => prev.map((it, idx) => (idx === i ? { ...next, planMealItemId: it.planMealItemId } : it)))}
                  onRemove={() => setPending((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
              {hasUnresolved ? (
                <div className="muted" style={{ fontSize: 13 }}>Identifique os alimentos acima para adicionar à refeição.</div>
              ) : (
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  A adicionar: ≈ {Math.round(pendingTotals.energyKcal)} kcal · P {Math.round(pendingTotals.proteinG)}g
                </div>
              )}
              <button type="button" className="btn btn-primary hit-target-44" disabled={!canAddPending} onClick={addPending}>
                Adicionar à refeição
              </button>
            </div>
          )}

          {/* Atalhos: só para COMEÇAR uma refeição vazia; acrescentam, nunca substituem o que já foi salvo */}
          {shortcuts && !hasAnything && pending.length === 0 && !ws.loading && (
            <div role="toolbar" aria-label="Atalhos de refeição" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {shortcuts.planMeals.map((m) => (
                <button key={`plan-${m.mealId}`} type="button" className="btn btn-sm hit-target-44" onClick={() => applyShortcut(`Como no plano: ${m.name}`, planToWorking(m.items), "plan")}>
                  Como no plano: {m.name}
                </button>
              ))}
              {shortcuts.yesterdayMeals.map((m) => (
                <button key={`y-${m.logId}`} type="button" className="btn btn-sm hit-target-44" onClick={() => applyShortcut(`Ontem: ${m.label}`, persistedToWorking(m.items), "repeat")}>
                  Ontem: {m.label}
                </button>
              ))}
              {shortcuts.favorites.map((m) => (
                <button key={`f-${m.id}`} type="button" className="btn btn-sm hit-target-44" onClick={() => applyShortcut(m.label, persistedToWorking(m.items), "favorite")}>
                  <Star size={12} style={{ marginRight: 4 }} />
                  {m.label}
                </button>
              ))}
              {shortcuts.recent.map((m, i) => (
                <button key={`r-${i}-${m.label}`} type="button" className="btn btn-sm hit-target-44" onClick={() => applyShortcut(m.label, persistedToWorking(m.items), "repeat")}>
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
              <select id="intake-meal-type" className="input" value={mealType} onChange={(e) => setMealType(e.target.value)}>
                {MEAL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {mealType === "Outro" && (
                <input type="text" className="input" style={{ marginTop: 6 }} placeholder="Ex.: Pré-treino" value={customMealType} onChange={(e) => setCustomMealType(e.target.value.slice(0, 80))} />
              )}
            </div>
          )}

          {ws.notice && <div role="alert" style={{ fontSize: 12, color: "var(--color-danger)" }}>{ws.notice}</div>}
          {error && <div role="alert" style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</div>}
        </div>

        {/* Rodapé fixo acima do teclado: campo + Adicionar + Pronto */}
        <div style={{ flex: "none", display: "grid", gap: 8, position: "sticky", bottom: "var(--kb-inset, 0)", background: "var(--color-surface)", paddingTop: 8 }}>
          {(showUndoAdd || ws.pendingRemoval != null) && (
            <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "6px 10px", borderRadius: 10, background: "var(--color-surface-raised)" }}>
              <span>{ws.pendingRemoval != null ? "Item removido" : "Adicionado"}</span>
              <button type="button" className="btn btn-ghost btn-sm hit-target-44" onClick={() => (ws.pendingRemoval != null ? ws.undoRemoval() : ws.undoLastAdd())}>
                Desfazer
              </button>
            </div>
          )}
          {closeBlocked && (
            <div role="alert" style={{ fontSize: 13, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-danger)" }}>
              Um alimento não foi salvo. Tente de novo ou descarte para sair.
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="button" className="btn btn-sm hit-target-44" onClick={() => setCloseBlocked(false)}>Voltar</button>
                <button type="button" className="btn btn-ghost btn-sm hit-target-44" onClick={onClose}>Descartar e sair</button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              aria-label="Adicionar alimento"
              placeholder={hasAnything ? "Adicionar outro alimento…" : "Ex.: 1 pão francês, 2 ovos e 200 ml de leite"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmitText();
              }}
            />
            <button type="button" className="btn btn-sm hit-target-44" disabled={!text.trim() || parsing} onClick={() => void handleSubmitText()}>
              {parsing ? "Lendo…" : "Adicionar"}
            </button>
          </div>
          <button type="button" className={`btn hit-target-44 ${hasAnything ? "btn-primary" : "btn-ghost"}`} onClick={() => void requestClose()}>
            {hasAnything ? "Pronto" : "Cancelar"}
          </button>
          <div style={{ fontSize: 11, color: COLORS.muted, textAlign: "center" }}>
            {/* Nunca nomear a fonte específica (TACO/USDA/...) — PLAN CANONICAL_FOOD_MODEL_SPIKE §23. */}
            Valores nutricionais estimados a partir de composição de alimentos.
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemoveAll}
        title="Remover a refeição inteira?"
        message="Este é o último alimento salvo: a refeição será removida."
        confirmLabel="Remover"
        danger
        onCancel={() => setConfirmRemoveAll(false)}
        onConfirm={() => {
          setConfirmRemoveAll(false);
          ws.removeItem(ws.saved[0]?.index ?? 0);
        }}
      />
    </DrawerShell>
  );
}
