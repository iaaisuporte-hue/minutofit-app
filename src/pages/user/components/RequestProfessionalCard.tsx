import { useNavigate } from "react-router-dom";
import { ActionButton } from "./ActionButton";
import { SURFACE } from "./surface";

/**
 * CTA proativo: quando o aluno NÃO tem personal nem nutri vinculado, oferece
 * pedir um profissional. Alimenta o funil `student_professional_requests`
 * (fluxo existente em /app/user/equipe → AddProfessionalSheet).
 *
 * Tom MaaS: o profissional amplifica o acompanhamento — não é "contrate um
 * personal", é "tenha alguém lendo seus sinais com você". Não-bloqueante,
 * dispensável; nunca pressiona.
 */
export function RequestProfessionalCard({ isMobile }: { isMobile: boolean }) {
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
        <div style={{ display: "grid", gap: 3 }}>
          <div className="today-eyebrow">Acompanhamento humano</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: SURFACE.text }}>
            Quer alguém lendo seus sinais com você?
          </div>
        </div>

        <div style={{ fontSize: 14, color: SURFACE.muted, lineHeight: 1.55 }}>
          Um personal ou nutricionista usa seus check-ins, sono e energia para adaptar
          seu treino e sua rotina à sua vida real. Você escolhe quem entra e o que
          ele pode ver.
        </div>

        <ActionButton
          variant="primary"
          onClick={() => navigate("/app/user/equipe")}
          fullWidth={isMobile}
        >
          Encontrar um profissional
        </ActionButton>
      </div>
    </div>
  );
}
