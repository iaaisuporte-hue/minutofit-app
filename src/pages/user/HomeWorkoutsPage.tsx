import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";


type Workout = {
  id: string;
  title: string;
  minutes: 10 | 20 | 30;
  equipment: "com_peso" | "sem_peso";
  level: "iniciante" | "intermediario" | "avancado";
};


function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        // ✅ (P1) TAMANHO DO PILL (chip):
        // 1º valor = topo/baixo | 2º valor = esquerda/direita
        padding: "2px 8px",

        // ✅ (P2) FORMATO (999 = cápsula):
        borderRadius: 999,

        // ✅ (P3) BORDA / COR:
        border: "1px solid rgba(255,255,255,.10)",

        // ✅ (P4) TAMANHO DA FONTE:
        fontSize: 11,

        // ✅ (P5) PESO DA FONTE:
        fontWeight: 800,

        // ✅ (P6) FUNDO DO PILL:
        background: "rgba(255,255,255,.06)",

        // ✅ (P7) COR DO TEXTO:
        color: "rgba(255,255,255,.92)",

        // ✅ (P8) REMOVE “SOBRA” EMBAIXO DO TEXTO:
        lineHeight: "1",

        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function LockedCard({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        // ✅ (L1) BORDA / FUNDO DO CARD PREMIUM:
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 16,
        padding: 14,
        background: "#171717",
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#FFFFFF" }}>🔒 {title}</div>
          <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>{description}</div>
        </div>

        <div style={{ alignSelf: "center" }}>
          <span
            style={{
              // ✅ (L2) BADGE “BLOQUEADO”:
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid rgba(255,183,3,.28)",
              background: "rgba(255,183,3,.14)",
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: 11,
              lineHeight: "1",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "fit-content",
              whiteSpace: "nowrap",
            }}
          >
            Bloqueado
          </span>
        </div>
      </div>

      <div style={{ marginTop: 12, color: "rgba(255,255,255,.92)", fontWeight: 900, fontSize: 13 }}>
        Você precisa assinar o plano <b style={{ color: "#FFB703" }}>Black</b> para liberar essa função.
      </div>
    </div>
  );
}

export default function HomeWorkoutsPage() {
  const navigate = useNavigate();

  // ✅ (DEV) Nesta fase você fixou como basic.
  // (mantive por compatibilidade, mas não mostramos mais o “banner do plano” aqui)

  const workouts: Workout[] = useMemo(
    () => [
      { id: "home-10min", title: "Treino em Casa (Sem peso) — 10min", minutes: 10, equipment: "sem_peso", level: "iniciante" },
      { id: "home-20min", title: "HIIT Sem peso — 20min", minutes: 20, equipment: "sem_peso", level: "intermediario" },
      { id: "home-20min-peso", title: "Treino com Halteres — 20min", minutes: 20, equipment: "com_peso", level: "intermediario" },
      { id: "home-30min-peso", title: "Full Body com peso — 30min", minutes: 30, equipment: "com_peso", level: "avancado" },
      { id: "home-10min-core", title: "Mobilidade + Core — 10min", minutes: 10, equipment: "sem_peso", level: "iniciante" },
      { id: "home-30min-forca", title: "Força com peso (Básico) — 30min", minutes: 30, equipment: "com_peso", level: "iniciante" },
    ],
    []
  );

  const [equipmentFilter, setEquipmentFilter] = useState<"all" | Workout["equipment"]>("all");
  const [minutesFilter, setMinutesFilter] = useState<"all" | Workout["minutes"]>("all");

  const filtered = useMemo(() => {
    return workouts.filter((w) => {
      const okEquip = equipmentFilter === "all" ? true : w.equipment === equipmentFilter;
      const okMin = minutesFilter === "all" ? true : w.minutes === minutesFilter;
      return okEquip && okMin;
    });
  }, [workouts, equipmentFilter, minutesFilter]);

  return (
    <div
      style={{
        display: "grid",
        gap: 16,

        // ✅ (G1) COR PADRÃO DO TEXTO NA PÁGINA:
        color: "#FFFFFF",
      }}
    >
      {/* ✅ TOP BAR (substitui o “plano atual”) */}
      <div
        style={{
          // ✅ (TB1) CARD: BORDA / FUNDO / SOMBRA (mesmo padrão do app)
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 16,
          padding: 16,
          background: "#171717",
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",

          // ✅ (TB2) Layout: 3 áreas (esquerda / centro / direita)
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* ⬅️ VOLTAR */}
        <button
          onClick={() => navigate(-1)}
          style={{
            // ✅ (TB3) Botão ghost (transparente)
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "transparent",
            color: "#FFFFFF",
            cursor: "pointer",
            fontWeight: 1000,
            fontSize: 14,
            width: "fit-content",
          }}
        >
          ← Voltar
        </button>

        {/* TÍTULO CENTRAL */}
        <div
          style={{
            // ✅ (TB4) Centralização perfeita do título
            textAlign: "center",
            fontWeight: 1000,
            fontSize: 18,
            color: "#FFFFFF",
            letterSpacing: 0.2,
          }}
        >
          Treinos em casa
          <div style={{ marginTop: 4, color: "rgba(255,255,255,.65)", fontWeight: 800, fontSize: 12 }}>
            Escolha por tempo e por tipo (com peso / sem peso)
          </div>
        </div>

        {/* AÇÕES (espaço pra botões de treino) */}
        <div
          style={{
            // ✅ (TB5) Agrupamento dos botões à direita
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => {
              // 🔮 futuro: rota real (ex.: /app/user/treinos/evolucao)
              alert("Em breve: Evolução");
            }}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: 14,
              width: "fit-content",
            }}
          >
            📈 Evolução
          </button>

          <button
            onClick={() => {
              // 🔮 futuro: histórico de check-in
              alert("Em breve: Histórico");
            }}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: 14,
              width: "fit-content",
            }}
          >
            🕒 Histórico
          </button>

          <button
            onClick={() => {
              // 🔮 futuro: conquistas / achievements
              alert("Em breve: Conquistas");
            }}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: 14,
              width: "fit-content",
            }}
          >
            🏆 Conquistas
          </button>
        </div>
      </div>

      {/* ✅ Filtros (mantém padrão e “maiores”) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Filtros</div>
          <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>
            Ajuste rápido pra encontrar o treino ideal.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* ✅ Select 1 */}
          <select
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value as any)}
            style={{
              // ✅ (S1) TAMANHO DO SELECT:
              padding: "10px 12px",
              borderRadius: 12,

              // ✅ (S2) FUNDO / BORDA:
              background: "#0F0F0F",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,.12)",

              // ✅ (S3) FONTE:
              fontWeight: 800,
              fontSize: 13,

              outline: "none",
              cursor: "pointer",
              minWidth: 170,
            }}
          >
            <option value="all">Todos</option>
            <option value="sem_peso">Sem peso</option>
            <option value="com_peso">Com peso</option>
          </select>

          {/* ✅ Select 2 */}
          <select
            value={minutesFilter}
            onChange={(e) => setMinutesFilter(e.target.value as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#0F0F0F",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,.12)",
              fontWeight: 800,
              fontSize: 13,
              outline: "none",
              cursor: "pointer",
              minWidth: 190,
            }}
          >
            <option value="all">Qualquer duração</option>
            <option value={10}>10 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
          </select>
        </div>
      </div>

      {/* ✅ Lista de treinos */}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((w) => (
          <div
            key={w.id}
            style={{
              // ✅ (C1) CARD LISTA: BORDA/FUNDO/SOMBRA
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: 16,
              padding: 14,
              background: "#171717",
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",

              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  // ✅ (C2) TÍTULO DO TREINO:
                  fontWeight: 1000,
                  fontSize: 15,
                  color: "#FFFFFF",
                }}
              >
                {w.title}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>{w.minutes} min</Pill>
                <Pill>{w.equipment === "com_peso" ? "Com peso" : "Sem peso"}</Pill>
                <Pill>{w.level}</Pill>
              </div>
            </div>

            <button
              onClick={() => navigate(`/app/user/treinos/player/${w.id}`)}
              style={{
                // ✅ (BTN1) BOTÃO "INICIAR" (CTA laranja):
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,106,0,.35)",
                background: "#FF6A00",
                color: "#0F0F0F",
                cursor: "pointer",
                fontWeight: 1000,
                fontSize: 14,
                boxShadow: "0 10px 24px rgba(0,0,0,.35)",
              }}
            >
              Iniciar
            </button>
          </div>
        ))}
      </div>

      {/* ✅ Itens premium bloqueados */}
      <div style={{ marginTop: 10 }}>
        <h3
          style={{
            marginBottom: 10,

            // ✅ (P0) TÍTULO DO BLOCO PREMIUM:
            fontSize: 16,
            fontWeight: 1000,
            color: "#FFFFFF",
          }}
        >
          Recursos Premium (Black)
        </h3>

        <div style={{ display: "grid", gap: 10 }}>
          <LockedCard
            title="Fichas de treino (academia)"
            description="Acesso a fichas para iniciantes e avançados, montadas pelo treinador."
          />
          <LockedCard
            title="Acompanhamento de personal (consultoria)"
            description="Consultoria exclusiva, ajustes de treino e acompanhamento contínuo."
          />
        </div>

        {/* ✅ (DEV) Mantive PLAN_LABEL/userPlan apenas se você quiser reutilizar depois:
            Ex: mostrar “Plano atual” em outro lugar, ou liberar botão “Upgrade” aqui futuramente. */}
        <div style={{ marginTop: 10, color: "rgba(255,255,255,.50)", fontSize: 12 }}>
          {/* (debug opcional) Plano atual: {PLAN_LABEL[userPlan]} */}
        </div>
      </div>
    </div>
  );
}