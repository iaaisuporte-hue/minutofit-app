import { useState } from "react";
import { COLORS } from "../../styles/colors";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { deleteIntakeLog, type NutritionIntakeMeal } from "../../services/nutritionIntakeApi";

function formatLoggedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Detalhe de uma REFEIÇÃO já registrada (PLAN P1B corrective — "Agrupamento
 * por Refeição"). STATUS → DETALHE → AÇÃO: a lista compacta só mostra o
 * resumo; este drawer é onde "Editar"/"Excluir" aparecem — nunca nos cards
 * da lista. `meal` já vem AGRUPADO (`groupLogsIntoMeals`) — normalmente 1
 * linha física por trás, mas "Excluir" precisa apagar TODAS as linhas do
 * grupo (`sourceLogIds`) para a refeição sair de fato do dia.
 */
export function IntakeLogDetailSheet({
  meal,
  open,
  onClose,
  onEdit,
  onDeleted,
}: {
  meal: NutritionIntakeMeal | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!meal) return;
    setDeleting(true);
    setError(null);
    try {
      await Promise.all(meal.sourceLogIds.map((id) => deleteIntakeLog(id)));
      setConfirmOpen(false);
      onDeleted();
    } catch {
      setError("Não foi possível excluir. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DrawerShell open={open} onClose={onClose} ariaLabel="Detalhes da refeição">
        {meal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>{formatLoggedTime(meal.loggedAt)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{meal.label}</div>
                {meal.isExtra && <span className="badge badge-neutral">Fora do plano</span>}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {meal.items.map((item, i) => (
                <div
                  key={i}
                  className="card cardPad"
                  style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 8 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{item.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {item.unitLabel && item.unitLabel !== "g" && item.quantity != null
                        ? `${item.quantity} ${item.unitLabel}`
                        : item.grams != null
                        ? `${Math.round(item.grams)} g`
                        : "quantidade informada"}
                      {item.confidence !== "high" && " · origem estimada"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12, color: COLORS.muted }}>
                    <div style={{ fontWeight: 700, color: COLORS.text }}>{Math.round(item.energyKcal)} kcal</div>
                    <div>
                      P {Math.round(item.proteinG)}g · C {Math.round(item.carbohydrateG)}g · G {Math.round(item.fatG)}g
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
              Total: ≈ {Math.round(meal.energyKcal)} kcal · P {Math.round(meal.proteinG)}g · C {Math.round(meal.carbohydrateG)}g · G{" "}
              {Math.round(meal.fatG)}g
            </div>

            {error && <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost hit-target-44" style={{ flex: 1 }} onClick={() => setConfirmOpen(true)}>
                Excluir
              </button>
              <button type="button" className="btn btn-primary hit-target-44" style={{ flex: 1 }} onClick={onEdit}>
                Editar
              </button>
            </div>
          </div>
        )}
      </DrawerShell>

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir esta refeição?"
        message="Ela deixará de contar nos totais de hoje."
        confirmLabel={deleting ? "Excluindo..." : "Excluir"}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
