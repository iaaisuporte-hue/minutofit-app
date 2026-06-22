import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import InteractiveSurfaceCard from "../../components/InteractiveSurfaceCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuth } from "../../auth/AuthContext";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { mapCanonicalPlanToLabel, normalizeToCanonicalPlanName } from "../../utils/planNormalization";
import { useMetabolism } from "../../features/metabolism/useMetabolism";
import { useGamificationSummary } from "../../features/gamification/useGamificationSummary";
import { deriveEnergyStatus } from "../../features/metabolism/metabolismDerivations";
import {
  itemRevealVariants,
  pageStaggerVariants,
  sectionRevealVariants,
  subtleHoverScale,
  subtleTapScale,
  useTodayMotionSafe,
} from "./todayPageMotion";
import "./todayPage.css";
import { SportProfileSection } from "../../features/sport/components/SportProfileSection";
import { COLORS } from "../../styles/colors";

type Props = {
  onLogout: () => void;
};

function Card({
  children,
  style,
  interactive = false,
  enableTilt = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  interactive?: boolean;
  enableTilt?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    border: `1px solid ${COLORS.border}`,
    borderRadius: "var(--radius-card)",
    background: COLORS.panel,
    boxShadow: "var(--shadow-md)",
    padding: "var(--space-5)",
    ...style,
  };

  if (interactive) {
    return (
      <InteractiveSurfaceCard style={baseStyle} enableTilt={enableTilt} whileHover={subtleHoverScale} whileTap={subtleTapScale}>
        {children}
      </InteractiveSurfaceCard>
    );
  }

  return <div style={baseStyle}>{children}</div>;
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
            color: COLORS.mutedSoft,
            fontSize: "var(--text-xs)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", color: COLORS.text }}>{title}</div>
      {subtitle ? <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>{subtitle}</div> : null}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--radius-card)",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panelDeep,
        alignItems: "center",
      }}
    >
      <div style={{ color: COLORS.mutedSoft, fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
      <div style={{ color: COLORS.text, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", textAlign: "right" }}>{value}</div>
    </div>
  );
}

function getInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "A";
}

function formatCurrentDate() {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date());
}

function ProfileSignal({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-1)",
        minWidth: 150,
        flex: "1 1 150px",
        padding: "var(--space-3)",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panel,
      }}
    >
      <span style={{ color: COLORS.mutedSoft, fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ color: COLORS.text, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", lineHeight: 1.35 }}>
        {value}
      </span>
    </div>
  );
}

function MetabolicMetric({ label, value, tone }: { label: string; value: string | number; tone?: "up" | "down" }) {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        borderRadius: "var(--radius-card)",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panelDeep,
        display: "grid",
        gap: "var(--space-2)",
      }}
    >
      <div style={{ color: COLORS.muted, fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
      <div
        style={{
          fontSize: typeof value === "number" ? "var(--text-3xl)" : "var(--text-lg)",
          fontWeight: "var(--font-bold)",
          color: tone === "up" ? "var(--color-success-text)" : tone === "down" ? "var(--color-danger)" : COLORS.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function drawEvolutionShareCard(opts: {
  partnerName: string;
  userName: string;
  score: number;
  trend30Label: string;
  streak: number;
  logoUrl?: string | null;
}): Promise<void> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas não suportado"));

  const paint = () => {
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, "#0f172a");
    grd.addColorStop(1, "#1e293b");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(248,250,252,0.88)";
    ctx.font = "600 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(opts.partnerName.slice(0, 40), 72, 100);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 28px system-ui, -apple-system, sans-serif";
    ctx.fillText(opts.userName.slice(0, 42), 72, 160);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 120px system-ui, -apple-system, sans-serif";
    ctx.fillText(String(Math.round(opts.score)), 72, 340);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 32px system-ui, -apple-system, sans-serif";
    ctx.fillText("Score metabólico", 72, 400);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 34px system-ui, -apple-system, sans-serif";
    ctx.fillText(`30 dias: ${opts.trend30Label}`, 72, 520);

    const weeks = Math.max(1, Math.floor(opts.streak / 7));
    const streakLine =
      weeks >= 4 ? `${weeks} semanas de consistência` : `${weeks} semana${weeks !== 1 ? "s" : ""} de consistência`;

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "500 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(`Streak ${opts.streak} dias · ${streakLine}`, 72, 620);

    ctx.fillStyle = "rgba(148,163,184,0.9)";
    ctx.font = "500 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("CoreFit — evolução que importa", 72, H - 72);
  };

  return new Promise((resolve, reject) => {
    if (opts.logoUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        paint();
        try {
          const s = 140;
          ctx.drawImage(img, W - s - 80, 60, s, s);
        } catch {
          /* CORS or draw failure */
        }
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("PNG"));
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "corefit-evolucao.png";
          a.click();
          URL.revokeObjectURL(url);
          resolve();
        }, "image/png");
      };
      img.onerror = () => {
        paint();
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("PNG"));
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "corefit-evolucao.png";
          a.click();
          URL.revokeObjectURL(url);
          resolve();
        }, "image/png");
      };
      img.src = opts.logoUrl;
      return;
    }
    paint();
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "corefit-evolucao.png";
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

export default function UserProfilePage({ onLogout }: Props) {
  const navigate = useNavigate();
  const { user, branding, academies } = useAuth();
  const { data: metabolismData } = useMetabolism();
  const { data: gamification } = useGamificationSummary();
  const { planName } = useFeatureFlags();
  const isMobile = useIsMobile(720);
  const { shouldReduceMotion, shouldUseTilt } = useTodayMotionSafe({ isMobile });

  const accountSummary = useMemo(
    () => ({
      name: user?.name || "Aluno",
      plan: mapCanonicalPlanToLabel(normalizeToCanonicalPlanName(planName || user?.subscriptionTier)),
      fitnessGoal: user?.fitnessGoal || "Não definido",
      experienceLevel: user?.experienceLevel || "Não definido",
      height: user?.heightCm ? `${user.heightCm} cm` : "Não informado",
      weight: user?.weightKg ? `${user.weightKg} kg` : "Não informado",
      dietaryRestrictions: user?.dietaryRestrictions || "Nenhuma informada",
    }),
    [
      user?.dietaryRestrictions,
      user?.experienceLevel,
      user?.fitnessGoal,
      user?.heightCm,
      user?.name,
      planName,
      user?.subscriptionTier,
      user?.weightKg,
    ]
  );

  const academyName = branding?.displayName ?? academies?.[0]?.displayName ?? "CoreFit";
  const derivedEnergy = useMemo(() => deriveEnergyStatus(metabolismData), [metabolismData]);
  const metabolicUpdatedLabel = useMemo(() => formatCurrentDate(), []);

  return (
    <motion.div
      style={{ display: "grid", gap: "var(--space-4)" }}
      variants={pageStaggerVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
    >
      <motion.div variants={sectionRevealVariants}>
        <Card
          interactive
          enableTilt={shouldUseTilt}
          style={{ padding: 0, overflow: "hidden" }}
        >
          <div style={{ height: 4, background: "var(--gradient-primary)" }} />
          <motion.div style={{ display: "grid", gap: "var(--space-5)", padding: "var(--space-5)" }}>
            <motion.div
              variants={itemRevealVariants}
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                gap: "var(--space-4)",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panel,
                  color: COLORS.muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--text-3xl)",
                  fontWeight: "var(--font-bold)",
                  flex: "0 0 auto",
                }}
              >
                {getInitial(accountSummary.name)}
              </div>
              <SectionTitle
                eyebrow="Minha conta"
                title={accountSummary.name}
                subtitle="Como o CoreFit te conhece hoje: seus dados, sinais de consistência e acompanhamento reunidos em uma leitura simples."
              />
            </motion.div>

            <motion.div variants={itemRevealVariants} style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <ProfileSignal label="Plano" value={accountSummary.plan} />
              <ProfileSignal label="Consistência" value={`${gamification?.streak ?? 0} dias`} />
              <ProfileSignal label="Academia" value={academyName} />
            </motion.div>

            <motion.div variants={itemRevealVariants} style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Link
                to="/app/user/equipe"
                className="btn btn-ghost"
                style={{ fontSize: "var(--text-sm)", textDecoration: "none" }}
              >
                Ver minha equipe →
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate("/app/user/settings")}
                style={{ fontSize: "var(--text-sm)" }}
              >
                Editar conta →
              </button>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>

      <motion.div variants={sectionRevealVariants} style={{ display: "grid", gap: "var(--space-4)" }}>
        <motion.div variants={itemRevealVariants} whileInView="show" initial={shouldReduceMotion ? false : "hidden"} viewport={{ once: true, amount: 0.15 }}>
          <Card interactive enableTilt={shouldUseTilt}>
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: COLORS.text }}>Perfil fitness</div>
                <button type="button" className="btn btn-ghost" onClick={() => navigate("/app/user/settings")} style={{ fontSize: "var(--text-sm)" }}>
                  Editar →
                </button>
              </div>
              <div style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                <DataRow label="Objetivo" value={accountSummary.fitnessGoal} />
                <DataRow label="Nível" value={accountSummary.experienceLevel} />
                <DataRow label="Altura" value={accountSummary.height} />
                <DataRow label="Peso" value={accountSummary.weight} />
                <DataRow label="Restrições alimentares" value={accountSummary.dietaryRestrictions} />
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {metabolismData && (
        <motion.div variants={sectionRevealVariants}>
          <Card interactive enableTilt={shouldUseTilt}>
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
                <div style={{ display: "grid", gap: "var(--space-1)", maxWidth: 520 }}>
                  <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: COLORS.text }}>Estado metabólico</div>
                  <div style={{ color: COLORS.muted, fontSize: "var(--text-base)", lineHeight: 1.55 }}>
                    Sua leitura metabólica atual, recalculada com os sinais disponíveis. Atualizado em {metabolicUpdatedLabel}.
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      const t30 = metabolismData.trend30d;
                      const trend30Label =
                        !t30 || t30.direction === "stable"
                          ? "estável"
                          : `${t30.delta >= 0 ? "+" : ""}${t30.delta} pts`;
                      void drawEvolutionShareCard({
                        partnerName: branding?.displayName ?? academies?.[0]?.displayName ?? "CoreFit",
                        userName: user?.name || accountSummary.name,
                        score: metabolismData.score,
                        trend30Label,
                        streak: gamification?.streak ?? 0,
                        logoUrl: branding?.logoUrl ?? academies?.[0]?.logoUrl ?? null,
                      }).catch(() => {
                        /* ignore */
                      });
                    }}
                  >
                    Compartilhar evolução de 30 dias
                  </button>
                  <Link
                    to="/app/user/today"
                    style={{ color: COLORS.primary, fontWeight: "var(--font-semibold)", textDecoration: "none", fontSize: "var(--text-sm)" }}
                  >
                    Ver evolução →
                  </Link>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
                <MetabolicMetric label="Score" value={Math.round(metabolismData.score)} />
                <MetabolicMetric
                  label="Estado"
                  value={
                    derivedEnergy?.band === "low" ? "Pedindo recuperação"
                    : derivedEnergy?.band === "high" ? "Em alta"
                    : "Equilibrado"
                  }
                />
                <MetabolicMetric
                  label="Tendência"
                  value={metabolismData.trend === "up" ? "↑ melhorando" : metabolismData.trend === "down" ? "↓ em queda" : "→ estável"}
                  tone={metabolismData.trend === "up" ? "up" : metabolismData.trend === "down" ? "down" : undefined}
                />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div variants={sectionRevealVariants}>
        <Card interactive enableTilt={shouldUseTilt}>
          <SportProfileSection />
        </Card>
      </motion.div>

      <motion.div variants={sectionRevealVariants} style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (window.confirm("Sair da conta?")) onLogout();
          }}
        >
          Sair da conta
        </button>
      </motion.div>
    </motion.div>
  );
}
