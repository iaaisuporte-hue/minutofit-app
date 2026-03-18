import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";
import { homeWorkoutCatalog } from "./homeWorkoutCatalog";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  mutedSoft: "rgba(232,236,233,.58)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  primarySoft: "rgba(29,185,84,.18)",
  highlightSoft: "rgba(124,255,107,.12)",
};

const groupLabelMap: Record<MuscleGroup, string> = {
  chest: "Peito",
  back: "Costas",
  legs: "Pernas",
  shoulders: "Ombros",
  arms: "Braços",
  core: "Abdômen",
  full_body: "Corpo inteiro",
  cardio: "Queima gordura",
  mobility: "Aquecimento / alongamento",
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${COLORS.border}`,
        fontSize: 11,
        fontWeight: 800,
        background: "rgba(255,255,255,.05)",
        color: "rgba(255,255,255,.92)",
        lineHeight: "1",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
}

export default function HomeWorkoutsPage() {
  const navigate = useNavigate();
  const yesterdayMuscleGroups = useMemo(() => getYesterdayMuscleGroups(), []);
  const [filter, setFilter] = useState<"all" | MuscleGroup>("all");

  const filtered = useMemo(() => {
    return homeWorkoutCatalog.filter((workout) => (filter === "all" ? true : workout.muscleGroups.includes(filter)));
  }, [filter]);

  const grouped = useMemo(() => {
    const groups = [
      {
        key: "always",
        title: "Sempre liberados",
        description: "Aquecimento, alongamento e queima de gordura continuam disponíveis todos os dias.",
        items: filtered.filter((item) => item.alwaysAvailable),
      },
      {
        key: "upper",
        title: "Superiores",
        description: "Peito, costas, braços e tríceps para trabalhar a parte de cima com segurança.",
        items: filtered.filter((item) => item.muscleGroups.some((group) => ["chest", "back", "arms", "shoulders"].includes(group))),
      },
      {
        key: "lower",
        title: "Inferiores",
        description: "Pernas e glúteos com bloqueio automático quando o grupo foi treinado ontem.",
        items: filtered.filter((item) => item.muscleGroups.some((group) => group === "legs")),
      },
      {
        key: "core-cardio",
        title: "Core e cardio",
        description: "Abdômen, mobilidade e estímulos metabólicos para encaixar em dias de rotina curta.",
        items: filtered.filter((item) => item.muscleGroups.some((group) => group === "core" || group === "cardio" || group === "mobility")),
      },
    ];

    return groups.filter((section) => section.items.length > 0);
  }, [filtered]);

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          padding: 18,
          display: "grid",
          gap: 12,
          background: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
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

          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 22 }}>Treinos em casa</div>
            <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>
              Shorts rápidos com regra de recuperação por grupo muscular.
            </div>
          </div>

          <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
            Shorts ativos
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            background: "rgba(255,255,255,.04)",
            padding: 14,
            color: COLORS.muted,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Se você treinou determinado grupo ontem, ele aparece aqui mas fica indisponível hoje. Queima de gordura, aquecimento e alongamento continuam liberados todos os dias.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setFilter("all")}
          style={{
            padding: "10px 12px",
            borderRadius: 999,
            border: `1px solid ${filter === "all" ? COLORS.borderStrong : COLORS.border}`,
            background: filter === "all" ? COLORS.primarySoft : "rgba(255,255,255,.03)",
            color: COLORS.text,
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Todos
        </button>
        {(["chest", "back", "legs", "arms", "core", "cardio", "mobility"] as MuscleGroup[]).map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => setFilter(group)}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: `1px solid ${filter === group ? COLORS.borderStrong : COLORS.border}`,
              background: filter === group ? COLORS.primarySoft : "rgba(255,255,255,.03)",
              color: COLORS.text,
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            {groupLabelMap[group]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        {grouped.map((section) => (
          <div key={section.key} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 1000 }}>{section.title}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{section.description}</div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {section.items.map((workout) => {
                const disabled =
                  !workout.alwaysAvailable && workout.muscleGroups.some((group) => yesterdayMuscleGroups.includes(group));
                const blockedGroups = workout.muscleGroups.filter((group) => yesterdayMuscleGroups.includes(group));

                return (
                  <div
                    key={workout.id}
                    style={{
                      border: `1px solid ${disabled ? "rgba(255,122,122,.22)" : COLORS.border}`,
                      borderRadius: 18,
                      padding: 16,
                      background: disabled ? "rgba(255,255,255,.02)" : COLORS.panel,
                      boxShadow: "0 18px 44px rgba(0,0,0,.45)",
                      opacity: disabled ? 0.72 : 1,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 1000, fontSize: 18 }}>{workout.title}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {workout.badges.map((badge) => (
                            <Pill key={badge}>{badge}</Pill>
                          ))}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 999,
                          padding: "8px 12px",
                          border: `1px solid ${disabled ? "rgba(255,122,122,.28)" : COLORS.border}`,
                          background: disabled ? "rgba(255,122,122,.08)" : "rgba(255,255,255,.03)",
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        {disabled ? "Indisponível hoje" : "Disponível hoje"}
                      </div>
                    </div>

                    <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                      {disabled
                        ? `Bloqueado hoje porque você treinou ${blockedGroups.map((group) => groupLabelMap[group]).join(", ")} ontem.`
                        : workout.alwaysAvailable
                          ? "Este short pode ser usado todos os dias."
                          : `Grupo principal: ${workout.muscleGroups.map((group) => groupLabelMap[group]).join(", ")}.`}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (disabled) return;
                          navigate(`/app/user/treinos/player/${workout.id}`);
                        }}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: `1px solid ${disabled ? "rgba(255,255,255,.12)" : COLORS.borderStrong}`,
                          background: disabled ? "rgba(255,255,255,.03)" : "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                          color: disabled ? COLORS.mutedSoft : "#082014",
                          fontWeight: 1000,
                          cursor: disabled ? "not-allowed" : "pointer",
                          width: "fit-content",
                        }}
                      >
                        {disabled ? "Treino não disponível hoje" : "Assistir no app"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
