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

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  mutedSoft: "rgba(232,236,233,.58)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
  primarySoft: "rgba(29,185,84,.18)",
  highlightSoft: "rgba(124,255,107,.12)",
  lime: "#7CFF6B",
  green: "#1DB954",
  deep: "#0F3D2E",
  warnSoft: "rgba(255,200,80,.12)",
  warnBorder: "rgba(255,200,80,.28)",
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

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {eyebrow ? (
        <div
          style={{
            display: "inline-flex",
            width: "fit-content",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            background: COLORS.highlightSoft,
            color: COLORS.lime,
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: 30, fontWeight: 1000, color: COLORS.text }}>{title}</div>
      {subtitle ? <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 780 }}>{subtitle}</div> : null}
    </div>
  );
}

function InfoPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${COLORS.border}`,
        background: "rgba(255,255,255,.04)",
        color: COLORS.text,
        fontWeight: 900,
        fontSize: 12,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
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
    padding: "12px 14px",
    borderRadius: 14,
    border: `1px solid ${locked ? "rgba(255,255,255,.10)" : COLORS.borderStrong}`,
    background: locked ? "rgba(255,255,255,.04)" : "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
    color: locked ? COLORS.mutedSoft : "#082014",
    fontWeight: 1000,
    cursor: locked ? "not-allowed" : "pointer",
    textDecoration: "none",
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
  return (
    <div
      style={{
        border: `1px solid ${card.recommended ? COLORS.borderStrong : COLORS.border}`,
        borderRadius: 20,
        padding: 18,
        background: card.recommended ? COLORS.panelDeep : COLORS.panel,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <InfoPill>{card.badge}</InfoPill>
            {card.recommended ? <InfoPill>Melhor escolha hoje</InfoPill> : null}
          </div>
          <div style={{ fontSize: 22, fontWeight: 1000, color: COLORS.text }}>{card.title}</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.55 }}>{card.subtitle}</div>
        </div>

        <div
          style={{
            borderRadius: 999,
            padding: "8px 12px",
            border: `1px solid ${card.locked ? COLORS.warnBorder : COLORS.border}`,
            background: card.locked ? COLORS.warnSoft : COLORS.panelSoft,
            color: card.locked ? "#FFD36C" : COLORS.mutedSoft,
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          {card.locked ? `Disponível no plano ${currentPlan === "black" ? "Black" : "Black"}` : "Disponível agora"}
        </div>
      </div>

      <div style={{ color: COLORS.muted, lineHeight: 1.6, minHeight: 72 }}>{card.description}</div>

      {card.locked && card.lockedText ? (
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${COLORS.warnBorder}`,
            background: COLORS.warnSoft,
            color: "#FFE3A3",
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {card.lockedText}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <CardAction to={card.locked ? undefined : card.route} locked={card.locked}>
          {card.locked ? "Recurso premium" : "Abrir"}
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
          "Aqui o app monta o plano do dia considerando como você acordou, seu contexto de treino, o tempo disponível e os grupos musculares que precisam de recuperação.",
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
          "Vamos usar esta área para sessões de academia mais profundas, com variação por objetivo, experiência e disponibilidade semanal.",
        badge: "Academia",
        locked: currentPlan !== "black",
        lockedText: "Planejado para liberar fichas mais completas e personalizadas quando você evoluir para o plano Black.",
      },
      {
        id: "consulting",
        title: "Consultoria",
        subtitle: "Espaço para ajustes humanos, revisão de rotina e acompanhamento mais próximo.",
        description:
          "Aqui entra a camada de acompanhamento premium: revisões de treino, correções e decisões mais finas sobre sua semana.",
        badge: "Humano + IA",
        locked: currentPlan !== "black",
        lockedText: "Esta área vai concentrar acompanhamento mais próximo e revisão personalizada dentro dos planos mais completos.",
      },
    ],
    [currentPlan]
  );

  const recoveryMessage = useMemo(() => {
    if (!yesterdayGroups.length) {
      return "Nenhum grupo muscular registrado ontem. Hoje você pode começar pelo treino sugerido ou por um short em casa.";
    }
    return `Ontem você treinou ${yesterdayGroups
      .map((group) => groupLabelMap[group] ?? group)
      .join(", ")}. Hoje vale variar o estímulo para recuperar melhor.`;
  }, [yesterdayGroups]);

  return (
    <div style={{ display: "grid", gap: 18, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 24,
          padding: 22,
          background: COLORS.panelDeep,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontWeight: 1000,
              width: "fit-content",
            }}
          >
            ← Voltar
          </button>

          <InfoPill>Plano {PLAN_LABEL[currentPlan]}</InfoPill>
        </div>

        <SectionTitle
          eyebrow="Hub de treino"
          title="Escolha o melhor formato para hoje"
          subtitle="A área de treinos agora funciona como ponto de entrada do dia: IA para decidir a sessão, casa para execução rápida e, mais adiante, academia e consultoria para os planos mais completos."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              borderRadius: 18,
              padding: 14,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,.05)",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.mutedSoft, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
              Melhor ponto de partida
            </div>
            <div style={{ fontSize: 18, fontWeight: 1000 }}>Treino sugerido com IA</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.5 }}>
              Ideal para montar o treino do dia antes de abrir vídeos, shorts ou tracker.
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              padding: 14,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,.05)",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.mutedSoft, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
              Recuperação
            </div>
            <div style={{ fontSize: 18, fontWeight: 1000 }}>Regra diária ativa</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.5 }}>{recoveryMessage}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {cards.map((card) => (
          <HubCard key={card.id} card={card} currentPlan={currentPlan} />
        ))}
      </div>

      {currentPlan !== "black" ? (
        <div
          style={{
            borderRadius: 18,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.panel,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
            padding: 18,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 6, maxWidth: 700 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Quer liberar experiências mais profundas?</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
              Quando você evoluir de plano, esta área pode destravar fichas de academia, ajustes mais personalizados e consultoria mais próxima.
            </div>
          </div>

          <Link
            to="/app/user/upgrade"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.borderStrong}`,
              background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
              color: "#082014",
              fontWeight: 1000,
              textDecoration: "none",
              width: "fit-content",
            }}
          >
            Evoluir plano
          </Link>
        </div>
      ) : null}
    </div>
  );
}
