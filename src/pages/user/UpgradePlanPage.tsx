import { Link } from "react-router-dom";

type Plan = "basic" | "silver" | "gold" | "black";

const PLANS: Array<{
  id: Plan;
  name: string;
  priceHint: string;
  highlights: string[];
  includes: string[];
}> = [
  {
    id: "basic",
    name: "Básico",
    priceHint: "R$ XX,90/mês",
    highlights: ["Treinos em casa (Netflix)"],
    includes: [
      "Catálogo de treinos em casa",
      "Variações: com peso / sem peso",
      "Durações: 10, 20 e 30 minutos",
      "Acesso pelo app com player e organização",
    ],
  },
  {
    id: "silver",
    name: "Silver",
    priceHint: "R$ XX,90/mês",
    highlights: ["Básico + fichas iniciante"],
    includes: [
      "Tudo do Básico",
      "Fichas de treino para iniciantes na academia",
      "Rotina orientada por objetivos (ex.: emagrecer, força)",
    ],
  },
  {
    id: "gold",
    name: "Gold",
    priceHint: "R$ XX,90/mês",
    highlights: ["Silver + fichas avançado"],
    includes: ["Tudo do Silver", "Fichas de treino avançadas", "Progressões e variações mais completas"],
  },
  {
    id: "black",
    name: "Black",
    priceHint: "R$ XX,90/mês",
    highlights: ["Acesso total + consultoria exclusiva"],
    includes: [
      "Tudo do Gold (e portanto Silver + Básico)",
      "Planos focados em corrida / preparo",
      "Consultoria personalizada com acompanhamento",
      "Atualização de treino a cada 30 dias (ou conforme política)",
      "Prioridade no suporte e ajustes de treino",
    ],
  },
];

/** ====== IDENTIDADE VISUAL (TREINAí) ====== */
const COLORS = {
  bg: "#0F0F0F",
  panel: "#171717",
  card: "#141414",
  border: "rgba(255,255,255,.10)",
  borderStrong: "rgba(255,255,255,.14)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.70)",
  muted2: "rgba(255,255,255,.55)",
  orange: "#FF6A00",
  orangeSoft: "rgba(255,106,0,.16)",
  orangeBorder: "rgba(255,106,0,.35)",
  warnBg: "rgba(255,183,3,.14)",
  warnBorder: "rgba(255,183,3,.28)",
  green: "#22C55E",
};

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "orange" | "warn" }) {
  const map = {
    neutral: { bg: "rgba(255,255,255,.06)", bd: "rgba(255,255,255,.12)", color: COLORS.text },
    orange: { bg: COLORS.orangeSoft, bd: COLORS.orangeBorder, color: COLORS.text },
    warn: { bg: COLORS.warnBg, bd: COLORS.warnBorder, color: COLORS.text },
  } as const;

  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${map[tone].bd}`,
        background: map[tone].bg,
        color: map[tone].color,
        fontSize: 12,
        fontWeight: 900,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function PlanCard({
  planId,
  name,
  priceHint,
  highlights,
  includes,
  isRecommended,
  onSelect,
}: {
  planId: Plan;
  name: string;
  priceHint: string;
  highlights: string[];
  includes: string[];
  isRecommended?: boolean;
  onSelect: () => void;
}) {
  const accent =
    planId === "black"
      ? { top: "linear-gradient(90deg, rgba(255,106,0,.65), rgba(255,106,0,.08))", badge: "orange" as const }
      : planId === "gold"
      ? { top: "linear-gradient(90deg, rgba(255,183,3,.55), rgba(255,183,3,.07))", badge: "warn" as const }
      : { top: "linear-gradient(90deg, rgba(255,255,255,.14), rgba(255,255,255,.05))", badge: "neutral" as const };

  return (
    <div
      style={{
        border: `1px solid ${isRecommended ? COLORS.orangeBorder : COLORS.border}`,
        borderRadius: 16,
        overflow: "hidden",
        background: COLORS.card,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
      }}
    >
      {/* Top accent */}
      <div style={{ height: 6, background: accent.top }} />

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 1000, color: COLORS.text }}>{name}</div>
            <div style={{ color: COLORS.muted, fontWeight: 900, fontSize: 13 }}>{priceHint}</div>
          </div>

          {isRecommended ? <Pill tone="orange">⭐ Recomendado</Pill> : <Pill tone={accent.badge}>Plano</Pill>}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {highlights.map((h) => (
            <Pill key={h} tone={isRecommended ? "orange" : "neutral"}>
              {h}
            </Pill>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
          <div style={{ fontWeight: 1000, marginBottom: 8, color: COLORS.text }}>O que inclui</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: COLORS.muted, lineHeight: 1.5 }}>
            {includes.map((item) => (
              <li key={item} style={{ marginBottom: 6 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={onSelect}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${isRecommended ? COLORS.orangeBorder : "rgba(255,255,255,.12)"}`,
              background: isRecommended ? COLORS.orange : "transparent",
              color: isRecommended ? COLORS.bg : COLORS.text,
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: 14,
              boxShadow: isRecommended ? "0 10px 24px rgba(0,0,0,.35)" : "none",
            }}
            title="Placeholder: nesta fase ainda não há checkout real"
          >
            Escolher {name}
          </button>

          {planId === "black" ? (
            <div style={{ color: "rgba(255,255,255,.75)", fontSize: 12, fontWeight: 900 }}>
              ✅ Melhor custo-benefício
            </div>
          ) : null}
        </div>

        <div style={{ color: COLORS.muted2, fontSize: 12, lineHeight: 1.35 }}>
          Nesta fase é simulado. Próximo passo: checkout/pagamento e atualização real do plano.
        </div>
      </div>
    </div>
  );
}

export default function UpgradePlanPage() {
  function handleSelect(planId: Plan) {
    alert(`Placeholder: iniciar pagamento/upgrade para o plano ${planId.toUpperCase()}.`);
  }

  return (
    <div style={{ display: "grid", gap: 14, color: COLORS.text }}>
      {/* Topbar */}
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 16,
          background: COLORS.panel,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/app/user/treinos"
          style={{
            textDecoration: "none",
            color: COLORS.text,
            fontWeight: 1000,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "transparent",
          }}
        >
          ← Voltar
        </Link>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 1000, fontSize: 18, letterSpacing: 0.2 }}>Evoluir plano</div>
          <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 900 }}>Escolha o plano ideal para seu objetivo</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Pill>🔒 Cancelar quando quiser</Pill>
          <Pill>⚡ Ativa na hora (futuro)</Pill>
        </div>
      </div>

      {/* Copy */}
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 1000 }}>Compare os planos</div>
        <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45 }}>
          Quanto maior o plano, mais recursos (fichas de academia, consultoria, corrida e suporte prioritário).
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {PLANS.map((p) => (
          <PlanCard
            key={p.id}
            planId={p.id}
            name={p.name}
            priceHint={p.priceHint}
            highlights={p.highlights}
            includes={p.includes}
            isRecommended={p.id === "black"}
            onSelect={() => handleSelect(p.id)}
          />
        ))}
      </div>

      {/* Footnote */}
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 14,
          background: COLORS.panel,
          color: COLORS.muted,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        💡 Dica: quando você migrar pro checkout real, aqui pode virar: cupom, pagamento (Pix/Cartão), renovação automática,
        e “comparação lado a lado” por recurso.
      </div>
    </div>
  );
}