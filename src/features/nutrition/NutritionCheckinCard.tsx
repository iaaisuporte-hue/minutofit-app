import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Utensils } from "lucide-react";
import { COLORS } from "../../styles/colors";
import {
  fetchMealTimeline,
  recordMealCheckin,
  type MealTimeline,
  type MealTimelineEntry,
  type MealCheckinStatus,
  type MealStatus,
} from "../../services/nutriApi";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { getDayIntake, type DayIntakeResponse } from "../../services/nutritionIntakeApi";
import { IntakeLogSheet } from "./IntakeLogSheet";
import { IntakeDayStrip } from "./IntakeDayStrip";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(t: string | null) {
  return t ? t.slice(0, 5) : null;
}

function minutesUntil(mealTime: string | null): number | null {
  if (!mealTime) return null;
  const [h, m] = mealTime.split(":").map(Number);
  const now = new Date();
  return h * 60 + m - (now.getHours() * 60 + now.getMinutes());
}

function formatCountdown(mins: number): string {
  if (mins <= 0) return "agora";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rm = mins % 60;
  return rm > 0 ? `${h}h ${rm}min` : `${h}h`;
}

function getNextMeal(meals: MealTimelineEntry[]): MealTimelineEntry | null {
  // Priority: due_now first, then upcoming soonest, then no_time unchecked
  const dueNow = meals.find((m) => m.status === "due_now");
  if (dueNow) return dueNow;

  const upcoming = meals
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => {
      const ma = minutesUntil(a.meal_time) ?? Infinity;
      const mb = minutesUntil(b.meal_time) ?? Infinity;
      return ma - mb;
    });
  if (upcoming.length > 0) return upcoming[0];

  // Fallback: first unchecked meal without time
  const noTime = meals.find(
    (m) =>
      m.status === "no_time" &&
      !["done", "partial", "substituted", "delayed"].includes(m.status)
  );
  return noTime ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type CardState = "loading" | "no_plan" | "idle" | "all_done" | "submitting";

const CHECKIN_OPTIONS: Array<{ status: MealCheckinStatus; label: string }> = [
  { status: "done",       label: "Segui" },
  { status: "partial",    label: "Parcial" },
  { status: "skipped",    label: "Pulei" },
  { status: "substituted", label: "Substituí" },
];

export function NutritionCheckinCard() {
  const { hasFeature } = useFeatureFlags();
  const intakeEnabled = hasFeature("nutrition_intake");
  const [cardState, setCardState] = useState<CardState>("loading");
  const [timeline, setTimeline] = useState<MealTimeline | null>(null);
  const [nextMeal, setNextMeal] = useState<MealTimelineEntry | null>(null);
  const [submitting, setSubmitting] = useState<MealCheckinStatus | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [intakeSheetOpen, setIntakeSheetOpen] = useState(false);
  const [dayIntake, setDayIntake] = useState<DayIntakeResponse | null>(null);

  useEffect(() => {
    if (!intakeEnabled) return;
    getDayIntake().then(setDayIntake).catch(() => setDayIntake(null));
  }, [intakeEnabled]);

  useEffect(() => {
    fetchMealTimeline()
      .then((t) => {
        if (!t || t.meals.length === 0) {
          setCardState("no_plan");
          return;
        }
        setTimeline(t);
        const next = getNextMeal(t.meals);
        if (!next) {
          setCardState("all_done");
        } else {
          setNextMeal(next);
          setCardState("idle");
        }
      })
      .catch(() => setCardState("no_plan"));
  }, []);

  async function handleCheckin(status: MealCheckinStatus) {
    if (!nextMeal) return;
    setSubmitting(status);
    setSubmitError(null);
    try {
      await recordMealCheckin(nextMeal.id, { status });

      // Update local state and recalculate next meal
      setTimeline((prev) => {
        if (!prev) return prev;
        const updated = prev.meals.map((m) =>
          m.id === nextMeal.id
            ? {
                ...m,
                status: status as MealStatus,
                checkin: { ...m.checkin, status, meal_id: m.id } as MealTimelineEntry["checkin"],
              }
            : m
        );
        const next2 = getNextMeal(updated as MealTimelineEntry[]);
        if (!next2) {
          setCardState("all_done");
        } else {
          setNextMeal(next2 as MealTimelineEntry);
        }
        return { ...prev, meals: updated as MealTimelineEntry[] };
      });
      setSubmitting(null);
    } catch {
      setSubmitError("Não foi possível registrar. Tente novamente.");
      setSubmitting(null);
    }
  }

  if (cardState === "loading" || cardState === "no_plan") return null;

  // ---------------------------------------------------------------------------
  // All done for the day
  // ---------------------------------------------------------------------------
  if (cardState === "all_done") {
    const meals = timeline?.meals ?? [];
    const checkedCount = meals.filter((m) =>
      ["done", "partial", "substituted", "delayed"].includes(m.status)
    ).length;
    return (
      <div
        className="today-card"
        style={{
          background: "var(--color-success-soft, rgba(123,153,25,.08))",
          borderRadius: 16,
          padding: "16px 20px",
          border: "1.5px solid var(--color-success, #7B9919)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-success, #7B9919)",
                marginBottom: 2,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Alimentação
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
              {checkedCount} de {meals.length} refeições registradas
            </div>
          </div>
          <Link
            to="/app/user/ficha"
            style={{
              fontSize: 13,
              color: COLORS.primary,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Ver plano →
          </Link>
        </div>

        {intakeEnabled && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-success-border, rgba(123,153,25,.2))" }}>
            {dayIntake && dayIntake.logs.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <IntakeDayStrip totals={dayIntake.totals} target={dayIntake.target} />
              </div>
            )}
            <button type="button" className="btn btn-sm hit-target-44" onClick={() => setIntakeSheetOpen(true)}>
              <Utensils size={13} style={{ marginRight: 6 }} />
              Registrar refeição
            </button>
            <IntakeLogSheet
              open={intakeSheetOpen}
              onClose={() => setIntakeSheetOpen(false)}
              defaultMealId={null}
              onSaved={() => {
                getDayIntake().then(setDayIntake).catch(() => {});
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Idle — show next meal with CTA
  // ---------------------------------------------------------------------------
  if (!nextMeal) return null;

  const isDueNow = nextMeal.status === "due_now";
  const timeLabel = formatTime(nextMeal.meal_time);
  const minsUntil = minutesUntil(nextMeal.meal_time);
  const checkedCount = (timeline?.meals ?? []).filter((m) =>
    ["done", "partial", "substituted", "delayed"].includes(m.status)
  ).length;
  const totalMeals = timeline?.meals.length ?? 0;

  // Integração MaaS (dieta↔treino): se há treino hoje e a refeição pré-treino
  // ainda não foi feita, conectamos os dois sinais.
  const preWorkoutMeal = (timeline?.meals ?? []).find(
    (m) => m.workout_relation === "pre" && ["upcoming", "due_now", "no_time", "skipped"].includes(m.status)
  );
  const showPreWorkoutNudge = Boolean(timeline?.workoutToday && preWorkoutMeal);

  return (
    <div
      className="today-card"
      style={{
        background: COLORS.card,
        borderRadius: 16,
        padding: "16px 20px",
        border: isDueNow
          ? `1.5px solid ${COLORS.primary}`
          : "1px solid var(--color-border)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.muted,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 1,
            }}
          >
            {isDueNow ? "Refeição agora" : "Próxima refeição"}
            {timeLabel && (
              <span style={{ marginLeft: 6 }}>· {timeLabel}</span>
            )}
            {!isDueNow && minsUntil !== null && minsUntil > 0 && (
              <span
                style={{ marginLeft: 4, color: COLORS.primary }}
              >
                · em {formatCountdown(minsUntil)}
              </span>
            )}
          </div>
          <div
            style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}
          >
            {nextMeal.name}
          </div>
        </div>
        <Link
          to="/app/user/ficha"
          style={{
            fontSize: 12,
            color: COLORS.muted,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          {checkedCount}/{totalMeals}
        </Link>
      </div>

      {/* Nudge dieta↔treino (MaaS): refeição pré-treino pendente + treino hoje */}
      {showPreWorkoutNudge && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(123,153,25,.08)",
            border: "1px solid rgba(123,153,25,.2)",
            fontSize: 12,
            color: COLORS.text,
            lineHeight: 1.45,
            marginBottom: 10,
          }}
        >
          <span aria-hidden="true">⚡</span>
          <span>Você treina hoje — a refeição <strong>pré-treino</strong> reforça energia e recuperação.</span>
        </div>
      )}

      {/* Orientation preview */}
      <div
        style={{
          fontSize: 12,
          color: COLORS.muted,
          lineHeight: 1.5,
          marginBottom: 12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          whiteSpace: "pre-wrap",
        }}
      >
        {nextMeal.orientation}
      </div>

      {/* Check-in buttons */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {CHECKIN_OPTIONS.map(({ status, label }) => (
          <button
            key={status}
            type="button"
            disabled={submitting !== null}
            onClick={() => void handleCheckin(status)}
            style={{
              flex: "1 1 auto",
              minWidth: 70,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1.5px solid var(--color-border)",
              background:
                isDueNow && status === "done"
                  ? COLORS.primary
                  : "var(--color-surface)",
              color:
                isDueNow && status === "done" ? "#fff" : COLORS.text,
              fontWeight: 600,
              fontSize: 12,
              cursor: submitting !== null ? "not-allowed" : "pointer",
              opacity: submitting !== null && submitting !== status ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            {submitting === status ? "..." : label}
          </button>
        ))}
      </div>

      {submitError && (
        <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 6 }}>
          {submitError}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <Link
          to="/app/user/ficha"
          style={{
            fontSize: 12,
            color: COLORS.primary,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Ver plano completo →
        </Link>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
        Sua alimentação alimenta sua leitura de hoje. Este plano apoia seu
        acompanhamento — não substitui avaliação nutricional presencial.
      </div>

      {intakeEnabled && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          {dayIntake && dayIntake.logs.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <IntakeDayStrip totals={dayIntake.totals} target={dayIntake.target} />
            </div>
          )}
          <button
            type="button"
            className="btn btn-sm hit-target-44"
            onClick={() => setIntakeSheetOpen(true)}
          >
            <Utensils size={13} style={{ marginRight: 6 }} />
            Registrar refeição
          </button>
          <IntakeLogSheet
            open={intakeSheetOpen}
            onClose={() => setIntakeSheetOpen(false)}
            defaultMealId={nextMeal?.id ?? null}
            onSaved={() => {
              getDayIntake().then(setDayIntake).catch(() => {});
            }}
          />
        </div>
      )}
    </div>
  );
}
