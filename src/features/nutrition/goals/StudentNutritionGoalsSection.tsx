import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UtensilsCrossed } from "lucide-react";
import { getMyNutritionGoals, type NutritionGoals } from "../../../services/nutritionGoalsApi";
import { NutritionGoalsAction, NutritionGoalsCard, type NutritionGoalsCardState } from "./NutritionGoalsCard";

const PLAN_ROUTE = "/app/user/plano-alimentar";

/**
 * Metas diárias no perfil do aluno (Spec 039). Somente leitura: quem
 * prescreve é o nutri. Aparece quando há meta OU nutri vinculado — para o
 * aluno B2C sem nutri, um painel "sem metas" seria ruído permanente.
 *
 * Os atalhos usam a rota existente do plano alimentar; "Registrar refeição"
 * abre o MESMO sheet do diário (`NutritionDaySummary`) via estado de
 * navegação — não existe um segundo fluxo de registro.
 */
export function StudentNutritionGoalsSection({
  hasNutri,
  canLogMeals,
}: {
  hasNutri: boolean;
  canLogMeals: boolean;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<NutritionGoalsCardState>("loading");
  const [goals, setGoals] = useState<NutritionGoals | null>(null);

  const fetchGoals = useCallback(() => {
    getMyNutritionGoals()
      .then((g) => {
        setGoals(g);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  function retry() {
    setState("loading");
    fetchGoals();
  }

  if (!hasNutri && !(state === "ready" && goals)) return null;

  return (
    <NutritionGoalsCard
      title="Metas diárias"
      state={state}
      goals={goals}
      emptyMessage="Seu nutricionista ainda não definiu metas diárias. Quando definir, elas aparecem aqui."
      onRetry={retry}
    >
      <NutritionGoalsAction
        icon={<UtensilsCrossed size={20} />}
        title="Ver plano alimentar"
        subtitle="Acesse suas refeições e porções"
        onClick={() => navigate(PLAN_ROUTE)}
      />
      {canLogMeals && (
        <NutritionGoalsAction
          icon={<Plus size={20} />}
          title="Registrar refeição"
          subtitle="Adicione o que você comeu hoje"
          onClick={() => navigate(PLAN_ROUTE, { state: { openIntakeSheet: true } })}
        />
      )}
    </NutritionGoalsCard>
  );
}
