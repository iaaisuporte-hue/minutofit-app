import { useEffect, useState } from "react";
import { ClipboardList, Calculator, Minus, Plus } from "lucide-react";
import { COLORS } from "../../styles/colors";
import {
  estimateNutritionTarget,
  getMyNutritionTarget,
  saveMyNutritionTarget,
  NutritionIntakeApiError,
  type ActivityLevel,
  type EstimatedTarget,
  type NutritionObjective,
  type ResolvedNutritionTarget,
} from "../../services/nutritionIntakeApi";

const OBJECTIVE_CHIPS: Array<{ value: NutritionObjective; label: string }> = [
  { value: "weight_loss", label: "Emagrecer" },
  { value: "maintenance", label: "Manter" },
  { value: "muscle_gain", label: "Ganhar massa" },
];

const ACTIVITY_CHIPS: Array<{ value: ActivityLevel; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "moderate", label: "Moderada" },
  { value: "high", label: "Alta" },
];

const MEALS_PER_DAY_OPTIONS = [3, 4, 5, 6];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="btn btn-sm hit-target-44"
      style={
        active
          ? { background: "var(--color-primary-soft)", borderColor: "var(--color-primary)", color: COLORS.primary }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function WeightStepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="stepper" role="group" aria-label="Peso em quilos">
      <button
        type="button"
        className="stepper-btn"
        aria-label="Diminuir peso"
        onClick={() => onChange(Math.max(30, value - 1))}
      >
        <Minus size={16} />
      </button>
      <span className="stepper-value">{value} kg</span>
      <button
        type="button"
        className="stepper-btn"
        aria-label="Aumentar peso"
        onClick={() => onChange(Math.min(300, value + 1))}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

function MacroRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ fontWeight: 700, color: COLORS.text, fontVariantNumeric: "tabular-nums" }}>
        {value} {unit}
      </span>
    </div>
  );
}

/**
 * "Meta do plano" e "Estimativa própria" são visualmente distintas em toda
 * superfície — nunca podem se confundir aos olhos do aluno OU do nutri
 * (PLAN_NUTRITION_QUICK_MACROS §3). Card compacto pensado para o topo de
 * `NutritionPlanViewPage`.
 */
export default function NutritionTargetCard() {
  const [loaded, setLoaded] = useState(false);
  const [resolved, setResolved] = useState<ResolvedNutritionTarget | null>(null);
  const [nutriName, setNutriName] = useState<string | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const [objective, setObjective] = useState<NutritionObjective>("maintenance");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [preview, setPreview] = useState<EstimatedTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMyNutritionTarget()
      .then((data) => {
        if (!alive) return;
        setResolved(data.target);
        setNutriName(data.nutriName);
        if (data.selfEstimateInputs) {
          setObjective(data.selfEstimateInputs.objective);
          setActivity(data.selfEstimateInputs.activity);
          setWeightKg(data.selfEstimateInputs.weightKg);
        }
        // Sem estimativa salva ainda → calculadora começa expandida (primeira
        // configuração). Estimativa própria já salva → começa COMPACTA (só
        // "Editar" expande) — UX_UI_NUTRITION_PREMIUM_REDESIGN.md §4.
        if (!data.target) {
          setCalculatorOpen(true);
        }
        if (data.target?.mealsPerDay) setMealsPerDay(data.target.mealsPerDay);
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!calculatorOpen) return;
    let alive = true;
    setError(null);
    estimateNutritionTarget({ weightKg: weightKg ?? undefined, objective, activity, mealsPerDay })
      .then((data) => {
        if (!alive) return;
        setPreview(data);
        setWeightKg(data.weightKgUsed);
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof NutritionIntakeApiError && weightKg == null) {
          setWeightKg(70);
          setError("Não encontramos seu peso — ajuste abaixo para calcular.");
        }
      });
    return () => {
      alive = false;
    };
  }, [calculatorOpen, objective, activity, mealsPerDay, weightKg]);

  async function handleSave() {
    if (weightKg == null) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveMyNutritionTarget({ weightKg, objective, activity, mealsPerDay });
      setResolved(result.target);
      setSaved(true);
      setCalculatorOpen(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  const isPlanTarget = resolved?.source === "plan_items";
  const hasSavedSelfEstimate = resolved?.source === "self_estimate";
  const objectiveLabel = OBJECTIVE_CHIPS.find((c) => c.value === objective)?.label ?? objective;
  const activityLabel = ACTIVITY_CHIPS.find((c) => c.value === activity)?.label ?? activity;

  return (
    <div
      className="card cardPad"
      style={{ marginBottom: 20 }}
    >
      {isPlanTarget ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="badge badge-brand" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ClipboardList size={13} /> Meta do plano
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
            Definida por {nutriName ?? "seu nutricionista"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <MacroRow label="Calorias" value={resolved!.energyKcal} unit="kcal" />
            <MacroRow label="Proteína" value={resolved!.proteinG} unit="g" />
            <MacroRow label="Carboidrato" value={resolved!.carbohydrateG} unit="g" />
            <MacroRow label="Gordura" value={resolved!.fatG} unit="g" />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            aria-expanded={calculatorOpen}
            aria-controls="nutrition-target-editor"
            onClick={() => setCalculatorOpen((o) => !o)}
          >
            {calculatorOpen ? "Ocultar estimativa própria" : "Ver estimativa própria"}
          </button>
        </>
      ) : hasSavedSelfEstimate && !calculatorOpen ? (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <span className="badge badge-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Calculator size={13} /> Estimativa diária
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={calculatorOpen}
              aria-controls="nutrition-target-editor"
              onClick={() => setCalculatorOpen(true)}
            >
              Editar
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: "var(--text-xl)", fontWeight: 700, color: COLORS.text }}>
            ≈ {resolved!.energyKcal} kcal
          </div>
          <div className="muted" style={{ marginTop: 4, fontSize: "var(--text-sm)" }}>
            {resolved!.proteinG}g P · {resolved!.carbohydrateG}g C · {resolved!.fatG}g G
          </div>
          <div className="muted" style={{ marginTop: 4, fontSize: "var(--text-xs)" }}>
            {objectiveLabel} · Atividade {activityLabel.toLowerCase()} · {resolved!.mealsPerDay} refeições
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="badge badge-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Calculator size={13} /> Estimativa própria
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
            Orientativa — não substitui prescrição
          </div>
        </>
      )}

      <div
        id="nutrition-target-editor"
        className="collapsePanel"
        data-open={calculatorOpen}
        aria-hidden={!calculatorOpen}
        inert={!calculatorOpen}
      >
        <div style={{ marginTop: isPlanTarget ? 14 : 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Peso
            </div>
            {weightKg != null && <WeightStepper value={weightKg} onChange={setWeightKg} />}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Objetivo
            </div>
            <div role="toolbar" aria-label="Objetivo" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {OBJECTIVE_CHIPS.map((c) => (
                <Chip key={c.value} active={objective === c.value} onClick={() => setObjective(c.value)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Atividade
            </div>
            <div role="toolbar" aria-label="Nível de atividade" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ACTIVITY_CHIPS.map((c) => (
                <Chip key={c.value} active={activity === c.value} onClick={() => setActivity(c.value)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Refeições por dia
            </div>
            <div role="toolbar" aria-label="Refeições por dia" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {MEALS_PER_DAY_OPTIONS.map((n) => (
                <Chip key={n} active={mealsPerDay === n} onClick={() => setMealsPerDay(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          {preview && (
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <MacroRow label="≈ Calorias" value={preview.energyKcal} unit="kcal" />
              <MacroRow label="≈ Proteína" value={preview.proteinG} unit="g" />
              <MacroRow label="≈ Carboidrato" value={preview.carbohydrateG} unit="g" />
              <MacroRow label="≈ Gordura" value={preview.fatG} unit="g" />
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</div>}

          <button
            type="button"
            className="btn btn-primary hit-target-44"
            disabled={saving || weightKg == null}
            onClick={handleSave}
          >
            {saving ? "Salvando..." : saved ? "Salvo" : "Salvar minha estimativa"}
          </button>
        </div>
      </div>
    </div>
  );
}
