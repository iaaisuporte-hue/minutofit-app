import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { useProfessionalContext, type ProfessionalContext } from "../../../features/professionalVoice";
import { fetchMyWorkoutPlans, type UserWorkoutPlan } from "../../../services/userWorkoutPlansApi";
import { TODAY_SCENARIOS, isValidScenario, type ScenarioKey } from "../today.scenarios";

export type TrainingMode = "personal_led" | "academy_led" | "self_guided";

export interface TodayUserState {
  hasActivePersonal: boolean;
  hasActiveNutri: boolean;
  hasActiveAcademy: boolean;
  hasActiveWorkoutPlan: boolean;
  hasAppAccess: boolean;
  hasProfessionalObservation: boolean;
  trainingMode: TrainingMode;
  activePlan: UserWorkoutPlan | null;
  personal: ProfessionalContext["personal"];
  nutri: ProfessionalContext["nutri"];
  scenario: ScenarioKey | null;
  loading: boolean;
}

function deriveTrainingMode(opts: {
  hasActivePersonal: boolean;
  hasActiveAcademy: boolean;
}): TrainingMode {
  if (opts.hasActivePersonal) return "personal_led";
  if (opts.hasActiveAcademy) return "academy_led";
  return "self_guided";
}

function buildState(opts: {
  professionalContext: ProfessionalContext | null;
  activePlan: UserWorkoutPlan | null;
  hasProduct: (key: string) => boolean;
  scenario: ScenarioKey | null;
  loading: boolean;
}): TodayUserState {
  const personal = opts.professionalContext?.personal ?? null;
  const nutri = opts.professionalContext?.nutri ?? null;

  const hasActivePersonal = personal !== null;
  const hasActiveNutri = nutri !== null;
  const hasActiveAcademy = opts.hasProduct("academia");
  const hasAppAccess = opts.hasProduct("app");
  const hasActiveWorkoutPlan = opts.activePlan !== null;

  const personalObs = personal?.lastObservation?.text?.trim();
  const nutriObs = nutri?.lastObservation?.text?.trim();
  const hasProfessionalObservation = Boolean(personalObs || nutriObs);

  return {
    hasActivePersonal,
    hasActiveNutri,
    hasActiveAcademy,
    hasActiveWorkoutPlan,
    hasAppAccess,
    hasProfessionalObservation,
    trainingMode: deriveTrainingMode({ hasActivePersonal, hasActiveAcademy }),
    activePlan: opts.activePlan,
    personal,
    nutri,
    scenario: opts.scenario,
    loading: opts.loading,
  };
}

export function useTodayUserState(): TodayUserState {
  const { hasProduct } = useAuth();
  const location = useLocation();

  const scenarioParam =
    import.meta.env.DEV ? new URLSearchParams(location.search).get("scenario") : null;
  const scenario: ScenarioKey | null = isValidScenario(scenarioParam) ? scenarioParam : null;

  const { data: professionalContext, loading: ctxLoading } = useProfessionalContext();

  const [activePlan, setActivePlan] = useState<UserWorkoutPlan | null>(null);
  const [plansLoading, setPlansLoading] = useState<boolean>(() => !scenario);

  useEffect(() => {
    if (scenario) return;
    let cancelled = false;
    void fetchMyWorkoutPlans(1)
      .then((rows) => {
        if (cancelled) return;
        setActivePlan(rows[0] ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setActivePlan(null);
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  return useMemo<TodayUserState>(() => {
    if (scenario) {
      const fixture = TODAY_SCENARIOS[scenario];
      const fixtureHasProduct = (key: string) =>
        (fixture.products as readonly string[]).includes(key);
      return buildState({
        professionalContext: fixture.professionalContext,
        activePlan: fixture.activePlan,
        hasProduct: fixtureHasProduct,
        scenario,
        loading: false,
      });
    }
    return buildState({
      professionalContext,
      activePlan,
      hasProduct,
      scenario: null,
      loading: ctxLoading || plansLoading,
    });
  }, [scenario, professionalContext, activePlan, hasProduct, ctxLoading, plansLoading]);
}
