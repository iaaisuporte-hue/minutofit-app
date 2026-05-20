import { useNavigate } from "react-router-dom";
import type { ProfessionalSummary } from "../../../features/professionalVoice";
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
        background: "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(6,182,212,0.18))",
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
}: {
  personal: ProfessionalSummary;
  isMobile: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div
      className="today-card"
      style={{
        borderColor: SURFACE.border,
        boxShadow: SURFACE.shadow,
        padding: isMobile ? 18 : 22,
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar photo={personal.photo} name={personal.name} />
          <div style={{ display: "grid", gap: 2 }}>
            <div className="today-eyebrow">Acompanhamento ativo</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: SURFACE.text }}>
              {personal.name} ainda não liberou um treino
            </div>
          </div>
        </div>

        <div style={{ fontSize: 14, color: SURFACE.muted, lineHeight: 1.55 }}>
          Seu personal está lendo seus sinais e libera o treino quando fizer sentido pra hoje.
          Enquanto isso, mantenha o check-in em dia — é o que alimenta a decisão dele.
        </div>

        <ActionButton variant="secondary" onClick={() => navigate("/app/user/messages")} fullWidth={isMobile}>
          Falar com {personal.name.split(" ")[0]}
        </ActionButton>
      </div>
    </div>
  );
}
