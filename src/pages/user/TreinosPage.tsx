import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";

type UserPlan = "basic" | "silver" | "gold" | "black";

type TrainingHubCard = {
  id: "ai" | "home" | "gym" | "consulting";
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  route?: string;
  recommended?: boolean;
  locked?: boolean;
  lockedText?: string;
};

const PLAN_LABEL: Record<UserPlan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

const groupLabelMap: Partial<Record<MuscleGroup, string>> = {
  chest: "peito",
  back: "costas",
  legs: "pernas",
  shoulders: "ombros",
  arms: "braços",
  core: "core",
};

function normalizePlan(tier?: string): UserPlan {
  const normalized = (tier ?? "").trim().toLowerCase();
  if (normalized === "black") return "black";
  if (normalized === "gold") return "gold";
  if (normalized === "silver") return "silver";
  return "basic";
}

function CardAction({
  to,
  locked,
  children,
  onClick,
}: {
  to?: string;
  locked?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "9px 16px",
    borderRadius: 10,
    border: locked ? "1px solid #E5E7EB" : "none",
    background: locked ? "#FFFFFF" : "#22C55E",
    color: locked ? "#9CA3AF" : "#FFFFFF",
    fontWeight: 600,
    fontSize: 13,
    cursor: locked ? "not-allowed" : "pointer",
    textDecoration: "none",
    transition: "background 0.15s ease, transform 0.15s ease",
  };

  if (locked) return <span style={style}>{children}</span>;
  if (to) return <Link to={to} style={style}>{children}</Link>;
  return (
    <button type="button" onClick={onClick} style={style}>
      {children}
    </button>
  );
}

function HubCard({
  card,
  currentPlan,
}: {
  card: TrainingHubCard;
  currentPlan: UserPlan;
}) {
  void currentPlan;
  return (
    <div
      style={{
        border: `1px solid ${card.recommended ? "rgba(34,197,94,0.3)" : "#E5E7EB"}`,
        borderRadius: 16,
        padding: 20,
        background: card.recommended ? "rgba(34,197,94,0.04)" : "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
        display: "grid",
        gap: 14,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "3px 10px", borderRadius: 999, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 12, fontWeight: 500, color: "#6B7280" }}>
              {card.badge}
            </span>
            {card.recommended && (
              <span style={{ padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", fontSize: 12, fontWeight: 600, color: "#16A34A" }}>
                ✨ Melhor escolha hoje
              </span>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1F2937" }}>{card.title}</div>
          <div style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.5 }}>{card.subtitle}</div>
        </div>

        <span style={{
          borderRadius: 999,
          padding: "4px 10px",
          border: `1px solid ${card.locked ? "rgba(245,158,11,0.3)" : "#E5E7EB"}`,
          background: card.locked ? "rgba(245,158,11,0.08)" : "#F9FAFB",
          color: card.locked ? "#B45309" : "#9CA3AF",
          fontWeight: 500,
          fontSize: 12,
          whiteSpace: "nowrap",
        }}>
          {card.locked ? "Disponível no plano Black" : "Disponível agora"}
        </span>
      </div>

      <div style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>{card.description}</div>

      {card.locked && card.lockedText && (
        <div style={{
          borderRadius: 12,
          border: "1px solid rgba(245,158,11,0.25)",
          background: "rgba(245,158,11,0.06)",
          color: "#92400E",
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          {card.lockedText}
        </div>
      )}

      <div>
        <CardAction to={card.locked ? undefined : card.route} locked={card.locked}>
          {card.locked ? "Recurso premium" : "Abrir →"}
        </CardAction>
      </div>
    </div>
  );
}

export default function TreinosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentPlan = normalizePlan(user?.subscriptionTier);
  const yesterdayGroups = useMemo(() => getYesterdayMuscleGroups(), []);

  const cards: TrainingHubCard[] = useMemo(
    () => [
      {
        id: "ai",
        title: "Treino sugerido com IA",
        subtitle: "Seu treino do dia com leitura de contexto, tempo disponível e recuperação muscular.",
        description:
          "O app monta o plano do dia considerando como você acordou, seu contexto de treino, o tempo disponível e os grupos musculares que precisam de recuperação.",
        badge: "Plano do dia",
        route: "/app/user/suggested-training",
        recommended: true,
      },
      {
        id: "home",
        title: "Treinos em casa",
        subtitle: "Shorts rápidos, player interno e bloqueio automático para grupos treinados ontem.",
        description:
          "Fluxo ideal para dias curtos. Você encontra aquecimento, mobilidade, cardio e treinos por grupo muscular já adaptados para casa.",
        badge: "Casa",
        route: "/app/user/treinos/em-casa",
      },
      {
        id: "gym",
        title: "Academia",
        subtitle: "Fichas mais completas para aparelhos, pesos livres e progressão estruturada.",
        description:
          "Sessões de academia mais profundas, com variação por objetivo, experiência e disponibilidade semanal.",
        badge: "Academia",
        locked: currentPlan !== "black",
        lockedText: "Disponível no plano Black com fichas completas e personalizadas.",
      },
      {
        id: "consulting",
        title: "Consultoria",
        subtitle: "Espaço para ajustes humanos, revisão de rotina e acompanhamento mais próximo.",
        description:
          "Acompanhamento premium: revisões de treino, correções e decisões mais finas sobre sua semana.",
        badge: "Humano + IA",
        locked: currentPlan !== "black",
        lockedText: "Esta área vai concentrar acompanhamento mais próximo e revisão personalizada.",
      },
    ],
    [currentPlan]
  );

  const recoveryMessage = useMemo(() => {
    if (!yesterdayGroups.length) {
      return "Nenhum grupo registrado ontem. Comece pelo treino sugerido ou um short em casa.";
    }
    return `Ontem você treinou ${yesterdayGroups
      .map((group) => groupLabelMap[group] ?? group)
      .join(", ")}. Hoje vale variar o estímulo.`;
  }, [yesterdayGroups]);

  return (
    <div style={{ display: "grid", gap: 20, color: "#1F2937" }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#6B7280",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14,
              transition: "border-color 0.15s ease",
            }}
          >
            ← Voltar
          </button>
          <span style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 12, fontWeight: 500, color: "#6B7280" }}>
            Plano {PLAN_LABEL[currentPlan]}
          </span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1F2937", margin: 0, letterSpacing: "-0.02em" }}>
          Hub de treino
        </h1>
        <p style={{ color: "#6B7280", fontSize: 15, margin: "8px 0 0", lineHeight: 1.6, maxWidth: 680 }}>
          Escolha o melhor formato para hoje. A IA decide a sessão, casa para execução rápida — academia e consultoria nos planos mais completos.
        </p>
      </div>

      {/* Context cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <div style={{ borderRadius: 14, padding: 16, border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.04)", display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Melhor ponto de partida
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>Treino sugerido com IA</div>
          <div style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5 }}>
            Monte o treino antes de abrir vídeos ou o tracker.
          </div>
        </div>

        <div style={{ borderRadius: 14, padding: 16, border: "1px solid #E5E7EB", background: "#F9FAFB", display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recuperação
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>Regra diária</div>
          <div style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.5 }}>{recoveryMessage}</div>
        </div>
      </div>

      {/* Hub cards */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {cards.map((card) => (
          <HubCard key={card.id} card={card} currentPlan={currentPlan} />
        ))}
      </div>
    </div>
  );
}
