import { useEffect, useRef, useState } from "react";
import { COLORS } from "../../styles/colors";
import {
  fetchMealTimeline,
  recordMealCheckin,
  OBJECTIVE_LABELS,
  METABOLIC_GOAL_LABELS,
  WORKOUT_RELATION_LABELS,
  type MealTimeline,
  type MealTimelineEntry,
  type MealCheckinStatus,
  type MealStatus,
} from "../../services/nutriApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoStr: string) {
  return new Date(isoStr + "T00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return null;
  return timeStr.slice(0, 5);
}

function minutesUntil(mealTime: string | null): number | null {
  if (!mealTime) return null;
  const [h, m] = mealTime.split(":").map(Number);
  const now = new Date();
  return (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
}

function formatCountdown(mins: number): string {
  if (mins <= 0) return "agora";
  if (mins < 60) return `em ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `em ${h}h ${m}min` : `em ${h}h`;
}

const STATUS_COLORS: Record<MealStatus, string> = {
  upcoming:      "var(--color-border)",
  due_now:       COLORS.primary,
  done:          "var(--color-success, #22C55E)",
  partial:       "var(--color-warn, #F59E0B)",
  skipped:       "var(--color-border)",
  substituted:   "var(--color-success, #22C55E)",
  delayed:       "var(--color-warn, #F59E0B)",
  missed_window: "var(--color-border)",
  no_time:       "var(--color-border)",
};

const STATUS_LABELS: Record<MealStatus, string> = {
  upcoming:      "Próxima",
  due_now:       "Agora",
  done:          "Feito",
  partial:       "Parcial",
  skipped:       "Pulado",
  substituted:   "Substituído",
  delayed:       "Atrasado",
  missed_window: "Passou",
  no_time:       "",
};

const CHECKIN_OPTIONS: Array<{ status: MealCheckinStatus; label: string }> = [
  { status: "done",       label: "Segui" },
  { status: "partial",    label: "Parcial" },
  { status: "skipped",    label: "Pulei" },
  { status: "substituted", label: "Substituí" },
];

// ---------------------------------------------------------------------------
// Meal drawer
// ---------------------------------------------------------------------------

function MealDrawer({
  meal,
  onClose,
  onCheckin,
}: {
  meal: MealTimelineEntry;
  onClose: () => void;
  onCheckin: (mealId: number, status: MealCheckinStatus) => void;
}) {
  const [selected, setSelected] = useState<MealCheckinStatus | null>(
    meal.checkin?.status ?? null
  );
  const [note, setNote] = useState(meal.checkin?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  async function handleCheckin(status: MealCheckinStatus) {
    setSelected(status);
    setSubmitting(true);
    setError(null);
    try {
      await recordMealCheckin(meal.id, {
        status,
        note: note.trim() || null,
      });
      onCheckin(meal.id, status);
      onClose();
    } catch {
      setError("Não foi possível registrar. Tente novamente.");
      setSubmitting(false);
    }
  }

  const isChecked = ["done", "partial", "substituted", "delayed"].includes(
    meal.status
  );
  const timeLabel = formatTime(meal.meal_time);
  const minsUntil = minutesUntil(meal.meal_time);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 32px",
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 99,
            background: "var(--color-border)",
            margin: "0 auto 20px",
          }}
        />

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>
                {meal.name}
              </div>
              {timeLabel && (
                <div style={{ fontSize: 13, color: COLORS.muted }}>
                  {timeLabel}
                  {minsUntil !== null && minsUntil > 0 && (
                    <span style={{ marginLeft: 6, color: COLORS.primary, fontWeight: 600 }}>
                      · {formatCountdown(minsUntil)}
                    </span>
                  )}
                  {meal.tolerance_minutes && (
                    <span style={{ marginLeft: 4, color: COLORS.muted }}>
                      (±{meal.tolerance_minutes}min)
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: COLORS.muted,
                fontSize: 20,
                padding: 4,
                lineHeight: 1,
              }}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          {meal.metabolic_goal && (
            <div
              style={{
                marginTop: 8,
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 99,
                background: "var(--color-surface-raised)",
                fontSize: 12,
                color: COLORS.muted,
                fontWeight: 600,
              }}
            >
              {METABOLIC_GOAL_LABELS[meal.metabolic_goal]}
            </div>
          )}
          {meal.workout_relation && meal.workout_relation !== "none" && (
            <div
              style={{
                marginTop: 4,
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 99,
                background: "var(--color-primary-soft)",
                fontSize: 12,
                color: COLORS.primary,
                fontWeight: 600,
                marginLeft: 6,
              }}
            >
              {WORKOUT_RELATION_LABELS[meal.workout_relation]}
            </div>
          )}
        </div>

        {/* Orientation */}
        <div
          style={{
            background: "var(--color-surface-raised)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.muted,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 6,
            }}
          >
            O que comer
          </div>
          <div
            style={{
              fontSize: 14,
              color: COLORS.text,
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}
          >
            {meal.orientation}
          </div>
        </div>

        {/* Alternatives */}
        {meal.alternatives && meal.alternatives.length > 0 && (
          <div
            style={{
              background: "var(--color-surface-raised)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: COLORS.muted,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 6,
              }}
            >
              Pode substituir por
            </div>
            <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
              {meal.alternatives.map((alt) => (
                <li key={alt.id} style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
                  {alt.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Hydration / supplement */}
        {(meal.hydration_note || meal.supplement_note) && (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {meal.hydration_note && (
              <div style={{ fontSize: 13, color: COLORS.muted }}>
                Hidratação: {meal.hydration_note}
              </div>
            )}
            {meal.supplement_note && (
              <div style={{ fontSize: 13, color: COLORS.muted }}>
                Suplemento: {meal.supplement_note}
              </div>
            )}
          </div>
        )}

        {/* Check-in */}
        {!isChecked && (
          <>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.text,
                marginBottom: 8,
              }}
            >
              Como foi esta refeição?
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {CHECKIN_OPTIONS.map(({ status, label }) => (
                <button
                  key={status}
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleCheckin(status)}
                  style={{
                    flex: "1 1 auto",
                    minWidth: 80,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border:
                      selected === status
                        ? `2px solid ${COLORS.primary}`
                        : "1.5px solid var(--color-border)",
                    background:
                      selected === status
                        ? "var(--color-primary-soft)"
                        : "var(--color-surface)",
                    color: selected === status ? COLORS.primary : COLORS.text,
                    fontWeight: selected === status ? 700 : 500,
                    fontSize: 13,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting && selected !== status ? 0.5 : 1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observação opcional..."
              rows={2}
              maxLength={500}
              style={{
                width: "100%",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                color: COLORS.text,
                background: "var(--color-surface)",
                resize: "none",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>
                {error}
              </div>
            )}
          </>
        )}

        {isChecked && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--color-success-soft, rgba(34,197,94,.08))",
              border: "1px solid var(--color-success, #22C55E)",
              color: "var(--color-success, #22C55E)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Registrado — {STATUS_LABELS[meal.status]}
            {meal.checkin?.note && (
              <span style={{ fontWeight: 400, color: COLORS.muted, marginLeft: 4 }}>
                · {meal.checkin.note}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meal card
// ---------------------------------------------------------------------------

function MealCard({
  meal,
  onOpen,
}: {
  meal: MealTimelineEntry;
  onOpen: () => void;
}) {
  const isDueNow = meal.status === "due_now";
  const isChecked = ["done", "partial", "substituted", "delayed"].includes(meal.status);
  const isPassed = meal.status === "missed_window" || meal.status === "skipped";
  const timeLabel = formatTime(meal.meal_time);
  const minsUntil = meal.status === "upcoming" ? minutesUntil(meal.meal_time) : null;
  const statusColor = STATUS_COLORS[meal.status];

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        cursor: "pointer",
        opacity: isPassed ? 0.55 : 1,
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {/* Timeline dot + line */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
          paddingTop: 4,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: isChecked ? statusColor : "transparent",
            border: `2px solid ${statusColor}`,
            boxShadow: isDueNow ? `0 0 0 3px ${COLORS.primarySoft}` : "none",
            flexShrink: 0,
          }}
        />
        <div
          style={{
            width: 1.5,
            flex: 1,
            minHeight: 32,
            background: "var(--color-border)",
            marginTop: 4,
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          paddingBottom: 20,
          minWidth: 0,
        }}
      >
        {/* Time + status */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          {timeLabel && (
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>
              {timeLabel}
            </span>
          )}
          {meal.status !== "no_time" && meal.status !== "upcoming" && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: statusColor,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {STATUS_LABELS[meal.status]}
            </span>
          )}
          {minsUntil !== null && minsUntil > 0 && (
            <span style={{ fontSize: 12, color: COLORS.muted }}>
              {formatCountdown(minsUntil)}
            </span>
          )}
        </div>

        {/* Card body */}
        <div
          style={{
            background: isDueNow
              ? "var(--color-primary-soft)"
              : "var(--color-surface-raised)",
            borderRadius: 12,
            padding: "12px 14px",
            border: isDueNow ? `1.5px solid ${COLORS.primary}` : "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.text,
                  marginBottom: 3,
                }}
              >
                {meal.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  lineHeight: 1.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  whiteSpace: "pre-wrap",
                }}
              >
                {meal.orientation}
              </div>
              {meal.alternatives && meal.alternatives.length > 0 && (
                <div
                  style={{ fontSize: 11, color: COLORS.muted, marginTop: 3 }}
                >
                  {meal.alternatives.length} substituição
                  {meal.alternatives.length > 1 ? "ões" : ""} disponível
                  {meal.alternatives.length > 1 ? "eis" : ""}
                </div>
              )}
            </div>
            {isDueNow && !isChecked && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                style={{
                  flexShrink: 0,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: COLORS.primary,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Marcar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NutritionPlanViewPage() {
  const [timeline, setTimeline] = useState<MealTimeline | null | undefined>(
    undefined
  );
  const [error, setError] = useState(false);
  const [openMeal, setOpenMeal] = useState<MealTimelineEntry | null>(null);

  useEffect(() => {
    fetchMealTimeline()
      .then(setTimeline)
      .catch(() => setError(true));
  }, []);

  function handleCheckin(mealId: number, status: MealCheckinStatus) {
    setTimeline((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((m) =>
          m.id === mealId
            ? {
                ...m,
                status: status as MealStatus,
                checkin: {
                  ...(m.checkin ?? {}),
                  status,
                  meal_id: mealId,
                } as MealTimelineEntry["checkin"],
              }
            : m
        ),
      };
    });
  }

  if (timeline === undefined && !error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
        }}
      >
        <div style={{ color: COLORS.muted, fontSize: 14 }}>
          Carregando plano alimentar...
        </div>
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "40px auto",
          padding: "0 16px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: COLORS.text,
            marginBottom: 8,
          }}
        >
          Nenhum plano alimentar ativo
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted }}>
          Quando sua nutricionista prescrever um plano, ele aparecerá aqui.
        </div>
      </div>
    );
  }

  const checkedCount = timeline.meals.filter((m) =>
    ["done", "partial", "substituted", "delayed"].includes(m.status)
  ).length;
  const totalMeals = timeline.meals.length;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.text,
            margin: "0 0 4px",
            letterSpacing: "-0.02em",
          }}
        >
          {timeline.title}
        </h1>
        <div style={{ fontSize: 13, color: COLORS.muted }}>
          {OBJECTIVE_LABELS[timeline.objective]} · por {timeline.nutri_name}
        </div>

        {/* Progress bar */}
        {totalMeals > 0 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: COLORS.muted,
                marginBottom: 4,
              }}
            >
              <span>
                {checkedCount} de {totalMeals} refeições hoje
              </span>
              <span style={{ color: COLORS.primary, fontWeight: 600 }}>
                {formatDate(timeline.today)}
              </span>
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 99,
                background: "var(--color-border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(checkedCount / totalMeals) * 100}%`,
                  background: COLORS.primary,
                  borderRadius: 99,
                  transition: "width 0.4s",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      {timeline.meals.length > 0 ? (
        <div>
          {timeline.meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onOpen={() => setOpenMeal(meal)}
            />
          ))}
        </div>
      ) : (
        <div style={{ color: COLORS.muted, fontSize: 14, textAlign: "center", padding: "24px 0" }}>
          Nenhuma refeição cadastrada no plano.
        </div>
      )}

      {/* General notes */}
      {timeline.general_notes && (
        <div
          className="card cardPad"
          style={{ marginTop: 16 }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.muted,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 8,
            }}
          >
            Orientações gerais
          </div>
          <div
            style={{
              fontSize: 14,
              color: COLORS.text,
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}
          >
            {timeline.general_notes}
          </div>
        </div>
      )}

      {/* Drawer */}
      {openMeal && (
        <MealDrawer
          meal={openMeal}
          onClose={() => setOpenMeal(null)}
          onCheckin={(mealId, status) => {
            handleCheckin(mealId, status);
            setOpenMeal(null);
          }}
        />
      )}
    </div>
  );
}
