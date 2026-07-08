import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ProfessionalSummary } from "../../../features/professionalVoice";
import type { UserWorkoutPlan, UserWorkoutPlanDay } from "../../../services/userWorkoutPlansApi";
import { ActionButton } from "./ActionButton";
import { SURFACE } from "./surface";

const AVG_SECONDS_PER_ITEM = 200; // ~3min com aquecimento e descanso curto

function pickTodayDay(plan: UserWorkoutPlan): UserWorkoutPlanDay | null {
  if (plan.days.length === 0) return null;
  const idx = new Date().getDay() % plan.days.length;
  return plan.days[idx] ?? plan.days[0];
}

function formatRelativeDays(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Liberada hoje";
  if (days === 1) return "Liberada ontem";
  return `Liberada há ${days} dias`;
}

function estimateMinutes(itemCount: number): number {
  if (itemCount <= 0) return 25;
  return Math.max(20, Math.round((itemCount * AVG_SECONDS_PER_ITEM) / 60));
}

function Avatar({ photo, name }: { photo: string | null; name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `1px solid ${SURFACE.border}` }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(123,153,25,0.18), rgba(123,153,25,0.18))",
        color: SURFACE.text,
        display: "grid",
        placeItems: "center",
        fontSize: 13,
        fontWeight: 700,
        border: `1px solid ${SURFACE.border}`,
      }}
    >
      {initials || "•"}
    </div>
  );
}

export function PersonalWorkoutCard({
  personal,
  plan,
  isMobile,
}: {
  personal: ProfessionalSummary;
  plan: UserWorkoutPlan;
  isMobile: boolean;
}) {
  const navigate = useNavigate();
  const today = useMemo(() => pickTodayDay(plan), [plan]);
  const itemCount = today?.items.length ?? 0;
  const minutes = useMemo(() => estimateMinutes(itemCount), [itemCount]);
  const status = useMemo(() => formatRelativeDays(plan.updated_at), [plan.updated_at]);

  return (
    <div
      className="today-card"
      style={{
        borderColor: SURFACE.border,
        boxShadow: SURFACE.shadow,
        padding: isMobile ? 18 : 22,
      }}
    >
      <div style={{ display: "grid", gap: 16 }}>
        {/* Header — o treino a fazer ("Treino B") em destaque. O personal segue
            presente pelo avatar + nome discreto, sem o eyebrow verboso anterior. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar photo={personal.photo} name={personal.name} />
          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: SURFACE.text, lineHeight: 1.15 }}>
              {today?.name ?? plan.title}
            </div>
            {today?.focus ? (
              <div style={{ fontSize: 13, color: SURFACE.muted, lineHeight: 1.4 }}>
                {today.focus}
              </div>
            ) : null}
            <div style={{ fontSize: 12, color: SURFACE.muted }}>
              {personal.name}
            </div>
          </div>
        </div>

        {/* Chips: duração, exercícios, status */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: SURFACE.muted,
              padding: "3px 10px",
              borderRadius: 999,
              border: `1px solid ${SURFACE.border}`,
              background: SURFACE.page,
            }}
          >
            {minutes} min
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: SURFACE.muted,
              padding: "3px 10px",
              borderRadius: 999,
              border: `1px solid ${SURFACE.border}`,
              background: SURFACE.page,
            }}
          >
            {itemCount} exercício{itemCount === 1 ? "" : "s"}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: SURFACE.info,
              padding: "3px 10px",
              borderRadius: 999,
              border: "1px solid rgba(8,145,178,0.2)",
              background: "rgba(8,145,178,0.05)",
            }}
          >
            {status}
          </span>
        </div>

        {/* Prévia de exercícios removida — a lista completa aparece ao iniciar
            o treino. Mantém o card limpo e focado na ação (decisão UX). */}

        <ActionButton onClick={() => navigate("/app/user/ficha")} fullWidth={isMobile}>
          Iniciar treino →
        </ActionButton>
      </div>
    </div>
  );
}
