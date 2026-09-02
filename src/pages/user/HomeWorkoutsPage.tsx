import { useMemo, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { handleExternal } from "../../lib/externalLink";
import InteractiveSurfaceCard from "../../components/InteractiveSurfaceCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  itemRevealVariants,
  pageStaggerVariants,
  sectionRevealVariants,
  subtleHoverScale,
  subtleTapScale,
  useTodayMotionSafe,
} from "./todayPageMotion";
import "./todayPage.css";
import { getYesterdayMuscleGroups, type MuscleGroup } from "./workoutHistory";
import { homeWorkoutCatalog } from "./homeWorkoutCatalog";
import {
  HOME_EXTRA_YOUTUBE_BY_GROUP,
  type HomeExtraYoutubeGroup,
} from "./homeWorkoutExtraYoutube";
import { COLORS } from "../../styles/colors";

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
        fontWeight: 600,
        background: "var(--color-surface-raised)",
        color: "var(--color-text)",
        lineHeight: "1",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
}

function ExtraYoutubeModal({
  group,
  onClose,
}: {
  group: HomeExtraYoutubeGroup;
  onClose: () => void;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const videos = HOME_EXTRA_YOUTUBE_BY_GROUP[group];
  const title = group === "chest" ? "Treino de peito — mais opções no YouTube" : "Treino de perna — mais opções no YouTube";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          background: "#161916",
          borderRadius: 24,
          padding: 24,
          maxWidth: 700,
          width: "100%",
          maxHeight: "min(80vh, 640px)",
          overflow: "auto",
          border: "1px solid rgba(123,153,25,.16)",
          boxShadow: "0 24px 60px rgba(0,0,0,.4)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="extra-youtube-modal-title"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12 }}>
          <div id="extra-youtube-modal-title" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>
            {title}
          </div>
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            whileHover={shouldReduceMotion ? undefined : subtleHoverScale}
            whileTap={shouldReduceMotion ? undefined : subtleTapScale}
            style={{
              background: "var(--color-surface-subtle)",
              border: "none",
              color: "var(--color-text)",
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            ✕
          </motion.button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {videos.map((video) => (
            <motion.a
              key={video.url}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => handleExternal(e, video.url)}
              whileHover={shouldReduceMotion ? undefined : subtleHoverScale}
              whileTap={shouldReduceMotion ? undefined : subtleTapScale}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                background: "rgba(123,153,25,.08)",
                border: "1px solid rgba(123,153,25,.24)",
                borderRadius: 12,
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "rgba(123,153,25,.16)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
                aria-hidden
              >
                <Play size={18} color="#5E7412" fill="#5E7412" />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{video.title}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{video.duration}</div>
              </div>
            </motion.a>
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,.10)",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          Lista curada de treinos mais longos. Toque em um item para abrir no YouTube.
        </div>
      </motion.div>
    </div>
  );
}

function AccessibilityPill({ label, supported }: { label: string; supported: boolean }) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${supported ? "rgba(123,153,25,.36)" : COLORS.border}`,
        fontSize: 11,
        fontWeight: 600,
        background: supported ? "rgba(123,153,25,.12)" : "var(--color-surface-subtle)",
        color: supported ? "#5E7412" : "var(--color-text-muted)",
        lineHeight: "1",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {label}: {supported ? "suporte" : "parcial"}
    </span>
  );
}

export default function HomeWorkoutsPage() {
  const navigate = useNavigate();
  const yesterdayMuscleGroups = useMemo(() => getYesterdayMuscleGroups(), []);
  const [filter, setFilter] = useState<"all" | MuscleGroup>("all");
  const [extraYoutubeGroup, setExtraYoutubeGroup] = useState<HomeExtraYoutubeGroup | null>(null);
  const isMobile = useIsMobile(720);
  const { shouldReduceMotion, shouldUseParallax, shouldUsePulse, shouldUseTilt } = useTodayMotionSafe({ isMobile });
  const { scrollY } = useScroll();
  const heroMeshY = useTransform(scrollY, [0, 500], [0, shouldUseParallax ? 65 : 0]);
  const heroContentY = useTransform(scrollY, [0, 500], [0, shouldUseParallax ? 24 : 0]);

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
    <>
    <motion.div
      style={{ display: "grid", gap: 16, color: COLORS.text, minWidth: 0, width: "100%" }}
      variants={pageStaggerVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
    >
      <motion.div variants={sectionRevealVariants}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 20,
            padding: 18,
            display: "grid",
            gap: 12,
            background: "var(--color-surface-raised)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              inset: -24,
              y: heroMeshY,
              background:
                "radial-gradient(circle at 18% 24%, rgba(123,153,25,.12), transparent 45%), radial-gradient(circle at 84% 20%, rgba(123,153,25,.12), transparent 42%)",
              pointerEvents: "none",
            }}
          />
          <motion.div style={{ display: "grid", gap: 12, y: heroContentY }}>
            <motion.div variants={itemRevealVariants} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <motion.button
                type="button"
                onClick={() => navigate(-1)}
                whileHover={subtleHoverScale}
                whileTap={subtleTapScale}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: "transparent",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  width: "fit-content",
                }}
              >
                ← Voltar
              </motion.button>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 22 }}>Treinos em casa</div>
                <div style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>
                  Shorts rápidos com regra de recuperação por grupo muscular.
                </div>
              </div>

              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                Shorts ativos
              </div>
            </motion.div>

            <motion.div
              variants={itemRevealVariants}
              style={{
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                background: "var(--color-surface-raised)",
                padding: 14,
                color: COLORS.muted,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Se você treinou determinado grupo ontem, ele aparece aqui mas fica indisponível hoje. Queima de gordura, aquecimento e alongamento continuam liberados todos os dias.
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={itemRevealVariants} style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: "100%", overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
        <motion.button
          type="button"
          onClick={() => setFilter("all")}
          whileHover={subtleHoverScale}
          whileTap={subtleTapScale}
          style={{
            // 44px: filtro de grupo muscular a 40px de altura (SPEC §8).
            minHeight: 44,
            padding: "10px 12px",
            borderRadius: 999,
            border: `1px solid ${filter === "all" ? COLORS.borderStrong : COLORS.border}`,
            background: filter === "all" ? COLORS.primarySoft : "#FAFAFA",
            color: COLORS.text,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Todos
        </motion.button>
        {(["chest", "back", "legs", "arms", "core", "cardio", "mobility"] as MuscleGroup[]).map((group) => (
          <motion.button
            key={group}
            type="button"
            onClick={() => setFilter(group)}
            whileHover={subtleHoverScale}
            whileTap={subtleTapScale}
            style={{
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: 999,
              border: `1px solid ${filter === group ? COLORS.borderStrong : COLORS.border}`,
              background: filter === group ? COLORS.primarySoft : "#FAFAFA",
              color: COLORS.text,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {groupLabelMap[group]}
          </motion.button>
        ))}
      </motion.div>

      <div style={{ display: "grid", gap: 18 }}>
        {grouped.map((section) => (
          <motion.div key={section.key} variants={sectionRevealVariants} whileInView="show" initial={shouldReduceMotion ? false : "hidden"} viewport={{ once: true, amount: 0.12 }} style={{ display: "grid", gap: 12 }}>
            <motion.div variants={itemRevealVariants} style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{section.title}</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{section.description}</div>
            </motion.div>

            <div style={{ display: "grid", gap: 12 }}>
              {section.items.map((workout) => {
                const disabled =
                  !workout.alwaysAvailable && workout.muscleGroups.some((group) => yesterdayMuscleGroups.includes(group));
                const blockedGroups = workout.muscleGroups.filter((group) => yesterdayMuscleGroups.includes(group));

                return (
                  <InteractiveSurfaceCard
                    key={workout.id}
                    disabled={disabled}
                    enableTilt={shouldUseTilt && !disabled}
                    whileHover={disabled ? undefined : subtleHoverScale}
                    whileTap={disabled ? undefined : subtleTapScale}
                    style={{
                      border: `1px solid ${disabled ? "rgba(255,122,122,.22)" : COLORS.border}`,
                      borderRadius: 18,
                      padding: 16,
                      background: disabled ? "#FFFFFF" : COLORS.panelDeep,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
                      opacity: disabled ? 0.72 : 1,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{workout.title}</div>
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
                          background: disabled ? "rgba(255,122,122,.08)" : "#FAFAFA",
                          fontWeight: 600,
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

                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <AccessibilityPill label="Visual" supported={workout.accessibility.visual} />
                        <AccessibilityPill label="Auditiva" supported={workout.accessibility.auditory} />
                        <AccessibilityPill label="Motora" supported={workout.accessibility.motor} />
                      </div>
                      {workout.accessibility.notes.length > 0 ? (
                        <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.45 }}>
                          {workout.accessibility.notes[0]}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <motion.button
                        type="button"
                        onClick={() => {
                          if (disabled) return;
                          navigate(`/app/user/treinos/player/${workout.id}`);
                        }}
                        whileHover={disabled ? undefined : subtleHoverScale}
                        whileTap={disabled ? undefined : subtleTapScale}
                        animate={
                          !disabled && shouldUsePulse
                            ? { boxShadow: ["0 8px 18px rgba(123,153,25,.18)", "0 10px 22px rgba(123,153,25,.28)", "0 8px 18px rgba(123,153,25,.18)"] }
                            : undefined
                        }
                        transition={!disabled && shouldUsePulse ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" } : undefined}
                        className={!disabled ? "today-premium-cta" : undefined}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: `1px solid ${disabled ? "var(--color-surface-subtle)" : COLORS.borderStrong}`,
                          background: disabled ? "#FAFAFA" : "#7B9919",
                          color: disabled ? COLORS.mutedSoft : "#FFFFFF",
                          fontWeight: 700,
                          cursor: disabled ? "not-allowed" : "pointer",
                          width: "fit-content",
                        }}
                      >
                        {disabled ? "Treino não disponível hoje" : "Assistir no app"}
                      </motion.button>

                      {workout.id === "short-peito" ? (
                        <motion.button
                          type="button"
                          onClick={() => setExtraYoutubeGroup("chest")}
                          whileHover={subtleHoverScale}
                          whileTap={subtleTapScale}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 14,
                            border: `1px solid ${COLORS.borderStrong}`,
                            background: "rgba(123,153,25,.10)",
                            color: COLORS.text,
                            fontWeight: 700,
                            cursor: "pointer",
                            width: "fit-content",
                          }}
                        >
                          Mais treinos de peito (lista)
                        </motion.button>
                      ) : null}

                      {workout.id === "short-perna" ? (
                        <motion.button
                          type="button"
                          onClick={() => setExtraYoutubeGroup("leg")}
                          whileHover={subtleHoverScale}
                          whileTap={subtleTapScale}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 14,
                            border: `1px solid ${COLORS.borderStrong}`,
                            background: "rgba(123,153,25,.10)",
                            color: COLORS.text,
                            fontWeight: 700,
                            cursor: "pointer",
                            width: "fit-content",
                          }}
                        >
                          Mais treinos de perna (lista)
                        </motion.button>
                      ) : null}
                    </div>
                  </InteractiveSurfaceCard>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>

    {extraYoutubeGroup ? <ExtraYoutubeModal group={extraYoutubeGroup} onClose={() => setExtraYoutubeGroup(null)} /> : null}
    </>
  );
}
