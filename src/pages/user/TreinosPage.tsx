import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

type UserPlan = "basic" | "silver" | "gold" | "black";

type TrainingCategory = {
  id: "home" | "gym" | "consulting";
  title: string;
  subtitle: string;
  route?: string;
  requiresBlack?: boolean;
  defaultImage: string;
};

const PLAN_LABEL: Record<UserPlan, string> = {
  basic: "Básico",
  silver: "Silver",
  gold: "Gold",
  black: "Black",
};

const CURRENT_PLAN: UserPlan = "basic";

function loadCardImages(): Partial<Record<TrainingCategory["id"], string>> {
  try {
    const raw = localStorage.getItem("treinos_images_v1");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function NetflixCard({
  title,
  subtitle,
  imageUrl,
  locked,
  lockedText,
  to,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  locked: boolean;
  lockedText?: string;
  to?: string;
}) {
  const CardInner = (
    <div
      style={{
        position: "relative",

        // ✅ (1) TAMANHO DO CARD (altura):
        // Aumente/diminua este número para deixar o card mais alto/baixo.
        height: 200,

        // ✅ (2) BORDA / ARREDONDAMENTO DO CARD:
        // Quanto maior, mais arredondado.
        borderRadius: 8, // <- estava 3.5, deixei consistente com o resto

        overflow: "hidden",

        // ✅ (3) BORDA DO CARD (cor/espessura):
        border: "1px solid rgba(255,255,255,.10)",

        // ✅ (4) COR DE FUNDO DO CARD (caso a imagem não carregue):
        background: "#171717",

        cursor: locked ? "not-allowed" : "pointer",

        // ✅ (5) SOMBRA DO CARD:
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
      }}
      title={locked ? lockedText : undefined}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,

          // ✅ (6) IMAGEM DE FUNDO DO CARD:
          // Ela vem de imageUrl (override do localStorage ou defaultImage).
          backgroundImage: `url(${imageUrl})`,

          // ✅ (7) COMO A IMAGEM PREENCHE O CARD:
          backgroundSize: "cover",
          backgroundPosition: "center",

          // ✅ (8) OPACIDADE DA IMAGEM:
          opacity: 0.55,

          // ✅ (9) ZOOM DA IMAGEM:
          transform: "scale(1.02)",

          // ✅ (10) FILTRO DA IMAGEM:
          filter: locked ? "grayscale(0.4) contrast(1.05)" : "contrast(1.05)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,

          // ✅ (11) GRADIENTE ESCURO POR CIMA DA IMAGEM:
          background:
            "linear-gradient(90deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.38) 60%, rgba(0,0,0,.18) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",

          // ✅ (12) ESPAÇAMENTO INTERNO DO CARD (padding):
          padding: 4,

          // ✅ (13) COR DO TEXTO DENTRO DO CARD:
          color: "#FFFFFF",

          height: "100%",
        }}
      >
        {/* ✅ Layout vertical:
            - Título em cima (centralizado)
            - Subtítulo abaixo (centralizado)
            - Botão embaixo (centralizado)
        */}
        <div
          style={{
            height: "190px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* 🔝 TOPO */}
          <div style={{ paddingTop: 8 }}>
            <div
              style={{
                // ✅ TAMANHO DA FONTE DO TÍTULO DE TODOS OS CARDS:
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: 0.1,
              }}
            >
              {title}
            </div>

            <div
              style={{
                marginTop: 6,
                // ✅ TAMANHO DA FONTE DO SUBTÍTULO DE TODOS OS CARDS:
                fontSize: 11,
                color: "rgba(255,255,255,.80)",
                lineHeight: 1.35,
              }}
            >
              {subtitle}
            </div>
          </div>

          {/* empurra o botão pro fundo */}
          <div style={{ flex: 1 }} />

          {/* 🔽 BASE (badge/botão) */}
          {locked ? (
            <div
              style={{
                // ✅ tamanho do badge
                padding: "7px 35px",

                // ✅ cápsula
                borderRadius: 3.5,

                // ✅ cores do locked
                background: "rgba(255,183,3,.14)",
                border: "1px solid rgba(255,183,3,.28)",

                // ✅ tipografia
                fontSize: 11,
                fontWeight: 700,
                color: "#FFFFFF",

                // ✅ remove sobra vertical
                lineHeight: "1",

                // ✅ evita “esticar”
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "fit-content",

                // ✅ margem do fundo do card
                marginBottom: 10,

                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 12, marginRight: 6, lineHeight: 1 }}>🔒</span>
              Black
            </div>
          ) : (
            <div
              style={{
                // ✅ badge compacto
                padding: "9px 35px",
                borderRadius: 3.5,

                background: "rgba(255,106,0,.16)",
                border: "1px solid rgba(255,106,0,.30)",

                fontSize: 11,
                fontWeight: 700,
                color: "#FFFFFF",

                // ✅ um pouquinho maior pra duas linhas ficarem legíveis
                lineHeight: "1.1",

                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "fit-content",
                marginBottom: 10,

                // ✅ permite quebra em 2 linhas
                whiteSpace: "normal",
                textAlign: "center",
              }}
            >
              <span style={{ display: "block" }}>Começar o treino</span>
            </div>
          )}
        </div>

        {/* ✅ Texto extra de bloqueio (se quiser manter):
            Eu recomendo NÃO mostrar isso dentro do card se o layout estiver muito cheio.
            Se quiser manter, ele aparece no meio (não no fundo).
        */}
        {locked ? (
          <div
            style={{
              // mantém o texto sem quebrar o layout
              position: "absolute",
              left: 10,
              right: 10,
              bottom: 42, // fica acima do badge
              fontWeight: 700,
              fontSize: 12,
              color: "rgba(255,255,255,.90)",
              textAlign: "center",
            }}
          >
            {lockedText}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (locked || !to) return CardInner;

  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      {CardInner}
    </Link>
  );
}

export default function TreinosPage() {
  const navigate = useNavigate();
  const imagesOverride = useMemo(() => loadCardImages(), []);

  const categories: TrainingCategory[] = useMemo(
    () => [
      {
        id: "home",
        title: "Treinos em casa",
        subtitle: "Com peso • Sem peso • 10–30 min • Estilo Netflix",
        route: "/app/user/treinos/em-casa",
        defaultImage:
          "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=1600&q=80",
      },
      {
        id: "gym",
        title: "Fichas de treino (academia)",
        subtitle: "Iniciantes e avançados • Treinos por objetivo",
        requiresBlack: true,
        defaultImage:
          "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=1600&q=80",
      },
      {
        id: "consulting",
        title: "Acompanhamento (consultoria)",
        subtitle: "Ajustes personalizados • acompanhamento contínuo",
        requiresBlack: true,
        defaultImage:
          "https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&w=1600&q=80",
      },
    ],
    []
  );

  const isBlack = CURRENT_PLAN === "black";

  function handleUpgrade() {
    navigate("/app/user/upgrade");
  }

  return (
    <div style={{ display: "grid", gap: 16, color: "#FFFFFF" }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          background: "#171717",
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 1000 }}>Seu plano atual</div>

          <div style={{ color: "rgba(255, 255, 255, 0.89)" }}>
            Plano: <b style={{ color: "#FFFFFF" }}>{PLAN_LABEL[CURRENT_PLAN]}</b>
          </div>

          <div style={{ color: "rgba(255, 255, 255, 0.77)", fontSize: 13 }}>
            Deseja liberar mais recursos? Clique no botão para verificar os planos disponíveis
          </div>
        </div>

        {!isBlack ? (
          <button
            onClick={handleUpgrade}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,106,0,.35)",
              background: "#FF6A00",
              color: "#0F0F0F",
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: 14,
            }}
          >
            Evoluir plano
          </button>
        ) : (
          <div style={{ fontWeight: 1000, color: "#22C55E" }}>✅ Você já está no Black</div>
        )}
      </div>

      <div>
        <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: 22 }}>Meus Treinos</h2>

        <div style={{ marginTop: 6, color: "rgba(255,255,255,.70)", fontSize: 16 }}>
          Selecione abaixo qual treino você irá realizar hoje!
        </div>

        <div style={{ marginTop: 6, color: "rgba(255, 255, 255, 0.54)", fontSize: 13 }}>
          * As imagens dos cards podem ser alteradas pelo treinador <b style={{ color: "#FFFFFF" }}>ADM</b> (vamos
          configurar isso no painel).
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {categories.map((c) => {
          const locked = !!c.requiresBlack && !isBlack;
          const imageUrl = imagesOverride[c.id] || c.defaultImage;

          return (
            <NetflixCard
              key={c.id}
              title={c.title}
              subtitle={c.subtitle}
              imageUrl={imageUrl}
              locked={locked}
              lockedText="Você precisa evoluir para o plano black para liberar essa função."
              to={locked ? undefined : c.route}
            />
          );
        })}
      </div>
    </div>
  );
}