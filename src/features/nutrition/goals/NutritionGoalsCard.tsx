import type { ReactNode } from "react";
import { ChevronRight, Info, Target } from "lucide-react";
import { SkeletonPanelCard } from "../../../components/feedback/Skeleton";
import { OBJECTIVE_LABELS } from "../../../services/nutriApi";
import type { NutritionGoals } from "../../../services/nutritionGoalsApi";
import { formatNumber, formatRange, mlToLiters } from "./formatGoals";

export type NutritionGoalsCardState = "loading" | "error" | "ready";

type Indicator = { key: string; label: string; value: string | null; unit: string };

function indicatorsOf(goals: NutritionGoals): Indicator[] {
  return [
    { key: "kcal", label: "Calorias", value: goals.energyKcal == null ? null : formatNumber(goals.energyKcal, 0), unit: "kcal" },
    { key: "protein", label: "Proteínas", value: formatRange(goals.proteinMinG, goals.proteinMaxG), unit: "g" },
    { key: "fiber", label: "Fibras", value: formatRange(goals.fiberMinG, goals.fiberMaxG), unit: "g" },
    { key: "water", label: "Água", value: formatRange(mlToLiters(goals.waterMinMl), mlToLiters(goals.waterMaxMl), 2), unit: "L" },
  ];
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Painel "Metas diárias" (Spec 039) — o MESMO componente no perfil do aluno
 * e no Resumo do paciente do nutri; só o título e as ações mudam. Puramente
 * apresentacional: quem busca é a seção que o envolve, e o dado é sempre o
 * que o servidor devolveu (nunca um estado local paralelo).
 *
 * Nutriente sem meta aparece como "Não definida" — nunca como 0, que leria
 * como uma prescrição real de zero.
 */
export function NutritionGoalsCard({
  title,
  state,
  goals,
  emptyMessage,
  onRetry,
  children,
}: {
  title: string;
  state: NutritionGoalsCardState;
  goals: NutritionGoals | null;
  emptyMessage: string;
  onRetry?: () => void;
  /** Ações (atalhos) renderizadas sob o painel em qualquer estado pronto. */
  children?: ReactNode;
}) {
  if (state === "loading") return <SkeletonPanelCard />;

  return (
    <section className="card cardPad nutritionGoals" aria-label={title}>
      <div className="nutritionGoals__header">
        <h2 className="nutritionGoals__title">
          <Target size={18} aria-hidden="true" />
          {title}
        </h2>
        {state === "ready" && goals && goals.objectives.length > 0 && (
          <ul className="nutritionGoals__tags" aria-label="Objetivos">
            {goals.objectives.map((o) => (
              <li key={o} className="badge badge-neutral">
                {OBJECTIVE_LABELS[o] ?? o}
              </li>
            ))}
          </ul>
        )}
      </div>

      {state === "error" && (
        <div role="alert" className="nutritionGoals__message">
          <span>Não foi possível carregar as metas agora.</span>
          {onRetry && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry} style={{ minHeight: 44 }}>
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {state === "ready" && !goals && <p className="nutritionGoals__message">{emptyMessage}</p>}

      {state === "ready" && goals && (
        <>
          <dl className="nutritionGoals__grid">
            {indicatorsOf(goals).map((ind) => (
              <div key={ind.key} className="nutritionGoals__cell" data-testid={`goal-${ind.key}`}>
                <dt className="nutritionGoals__label">{ind.label}</dt>
                <dd className="nutritionGoals__value">
                  {ind.value == null ? (
                    <span className="nutritionGoals__value--empty">Não definida</span>
                  ) : (
                    <>
                      {ind.value}
                      <span className="nutritionGoals__unit">{ind.unit}</span>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <p className="nutritionGoals__note">
            <Info size={16} aria-hidden="true" />
            <span>
              {goals.patientNote ?? "Metas definidas pelo seu acompanhamento nutricional."}
              <span className="nutritionGoals__meta">
                {goals.updatedByName ? `${goals.updatedByName} · ` : ""}atualizadas em {formatUpdatedAt(goals.updatedAt)}
              </span>
            </span>
          </p>
        </>
      )}

      {state === "ready" && children && <div className="nutritionGoals__actions">{children}</div>}
    </section>
  );
}

/** Linha de atalho do painel (ícone + título + apoio + chevron), alvo ≥ 44px. */
export function NutritionGoalsAction({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="nutritionGoals__action" onClick={onClick}>
      <span className="nutritionGoals__actionIcon" aria-hidden="true">{icon}</span>
      <span className="nutritionGoals__actionText">
        <span className="nutritionGoals__actionTitle">{title}</span>
        <span className="nutritionGoals__actionSubtitle">{subtitle}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="nutritionGoals__actionChevron" />
    </button>
  );
}
