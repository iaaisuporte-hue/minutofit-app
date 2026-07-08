import { useNavigate } from "react-router-dom";
import type { ProfessionalSummary } from "../../../features/professionalVoice";
import type { WorkoutRecommendation } from "../../../features/training/generateDailyWorkout";
import { ActionButton } from "./ActionButton";
import { SURFACE } from "./surface";

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
        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `1px solid ${SURFACE.border}` }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(123,153,25,0.18), rgba(123,153,25,0.18))",
        color: SURFACE.text,
        display: "grid",
        placeItems: "center",
        fontSize: 14,
        fontWeight: 700,
        border: `1px solid ${SURFACE.border}`,
      }}
    >
      {initials || "•"}
    </div>
  );
}

export function PersonalEmptyState({
  personal,
  isMobile,
  fallbackWorkout,
}: {
  personal: ProfessionalSummary;
  isMobile: boolean;
  fallbackWorkout?: WorkoutRecommendation;
}) {
  const navigate = useNavigate();
  const firstName = personal.name.split(" ")[0];
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
        {/* Header: personal + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar photo={personal.photo} name={personal.name} />
          <div style={{ display: "grid", gap: 2 }}>
            <div className="today-eyebrow">Acompanhamento ativo</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: SURFACE.text }}>
              {personal.name} está preparando seu treino
            </div>
          </div>
        </div>

        <div style={{ fontSize: 14, color: SURFACE.muted, lineHeight: 1.55 }}>
          {firstName} lê seus sinais antes de liberar. Mantenha o check-in em dia —
          é o que alimenta a decisão dele.
        </div>

        {/* Treino leve adaptativo enquanto aguarda ficha */}
        {fallbackWorkout && (
          <div style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--color-surface-raised)",
            border: `1px solid ${SURFACE.border}`,
            display: "grid",
            gap: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: SURFACE.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Enquanto isso, sugestão de hoje
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text }}>
                  {fallbackWorkout.title}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: SURFACE.muted,
                padding: "3px 10px", borderRadius: 999,
                border: `1px solid ${SURFACE.border}`, background: SURFACE.page,
                whiteSpace: "nowrap",
              }}>
                {fallbackWorkout.duration} min
              </span>
            </div>
            {fallbackWorkout.exercises.slice(0, 3).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {fallbackWorkout.exercises.slice(0, 3).map((ex) => (
                  <span key={ex} style={{
                    fontSize: 11, color: SURFACE.muted, padding: "2px 8px",
                    borderRadius: 999, border: `1px solid ${SURFACE.border}`, background: SURFACE.page,
                  }}>
                    {ex}
                  </span>
                ))}
                {fallbackWorkout.exercises.length > 3 && (
                  <span style={{ fontSize: 11, color: SURFACE.muted, padding: "2px 8px" }}>
                    +{fallbackWorkout.exercises.length - 3} exercícios
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate("/app/user/suggested-training")}
              style={{
                alignSelf: "start", fontSize: 12, fontWeight: 600,
                color: "var(--color-primary)", background: "none",
                border: "none", cursor: "pointer", padding: 0,
                textDecoration: "underline",
              }}
            >
              Ver treino completo →
            </button>
          </div>
        )}

        <ActionButton variant="secondary" onClick={() => navigate("/app/user/messages")} fullWidth={isMobile}>
          Falar com {firstName}
        </ActionButton>
      </div>
    </div>
  );
}
