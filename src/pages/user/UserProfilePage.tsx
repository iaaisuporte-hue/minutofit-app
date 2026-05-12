import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import InteractiveSurfaceCard from "../../components/InteractiveSurfaceCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuth } from "../../auth/AuthContext";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { mapCanonicalPlanToLabel, normalizeToCanonicalPlanName } from "../../utils/planNormalization";
import { useMetabolism } from "../../features/metabolism/useMetabolism";
import { useGamificationSummary } from "../../features/gamification/useGamificationSummary";
import {
  itemRevealVariants,
  pageStaggerVariants,
  sectionRevealVariants,
  subtleHoverScale,
  subtleTapScale,
  useTodayMotionSafe,
} from "./todayPageMotion";
import "./todayPage.css";
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
    borderRadius: 20,
    background: COLORS.panel,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
    padding: 18,
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
            borderRadius: 999,
            background: COLORS.highlightSoft,
            color: "#22C55E",
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.text }}>{title}</div>
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
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panelSoft,
        alignItems: "center",
      }}
    >
      <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.1 }}>
        {label}
      </div>
      <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 600, textAlign: "right" }}>{value}</div>
    </div>
  );
}

function maskCpf(cpf?: string) {
  const digits = (cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return cpf || "Nao informado";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskPhone(phone?: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone || "Nao informado";
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
    ctx.fillText("MinutoFit — evolução que importa", 72, H - 72);
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
          a.download = "minutofit-evolucao.png";
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
          a.download = "minutofit-evolucao.png";
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
      a.download = "minutofit-evolucao.png";
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

export default function UserProfilePage({ onLogout: _onLogout }: Props) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const { user, email, profileCompleted, branding, academies } = useAuth();
  const { data: metabolismData } = useMetabolism();
  const { data: gamification } = useGamificationSummary();
  const { planName } = useFeatureFlags();
  const isMobile = useIsMobile(720);
  const { shouldReduceMotion, shouldUseParallax, shouldUseTilt } = useTodayMotionSafe({ isMobile });
  const { scrollY } = useScroll();
  const heroMeshY = useTransform(scrollY, [0, 500], [0, shouldUseParallax ? 55 : 0]);
  const heroContentY = useTransform(scrollY, [0, 500], [0, shouldUseParallax ? 20 : 0]);

  const accountSummary = useMemo(
    () => ({
      name: user?.name || "Aluno",
      accountEmail: user?.email || email || "Nao informado",
      cpf: maskCpf(user?.cpf),
      phone: maskPhone(user?.phone),
      plan: mapCanonicalPlanToLabel(normalizeToCanonicalPlanName(planName || user?.subscriptionTier)),
      profileStatus: profileCompleted ? "Completo" : "Pendente",
      fitnessGoal: user?.fitnessGoal || "Nao definido",
      experienceLevel: user?.experienceLevel || "Nao definido",
      height: user?.heightCm ? `${user.heightCm} cm` : "Nao informado",
      weight: user?.weightKg ? `${user.weightKg} kg` : "Nao informado",
      dietaryRestrictions: user?.dietaryRestrictions || "Nenhuma informada",
    }),
    [
      email,
      profileCompleted,
      user?.cpf,
      user?.dietaryRestrictions,
      user?.email,
      user?.experienceLevel,
      user?.fitnessGoal,
      user?.heightCm,
      user?.name,
      user?.phone,
      planName,
      user?.subscriptionTier,
      user?.weightKg,
    ]
  );

  return (
    <motion.div
      style={{ display: "grid", gap: 18 }}
      variants={pageStaggerVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
    >
      <motion.div variants={sectionRevealVariants}>
        <Card
          interactive
          enableTilt={shouldUseTilt}
          style={{
            background: COLORS.panelDeep,
            borderColor: COLORS.borderStrong,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              inset: -20,
              y: heroMeshY,
              background:
                "radial-gradient(circle at 18% 24%, rgba(34,197,94,.12), transparent 45%), radial-gradient(circle at 84% 20%, rgba(34,197,94,.12), transparent 42%)",
              pointerEvents: "none",
            }}
          />
          <motion.div style={{ display: "grid", gap: 18, y: heroContentY }}>
            <motion.div variants={itemRevealVariants} style={{ display: "grid", gap: 18 }}>
              <SectionTitle
                eyebrow="Minha conta"
                title={accountSummary.name}
                subtitle="Aqui ficam seus dados principais de conta, assinatura e perfil fitness. A ideia é concentrar o que realmente define sua experiência no app."
              />

              <motion.div variants={itemRevealVariants} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    padding: "10px 12px",
                    color: COLORS.text,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Plano {accountSummary.plan}
                </div>
                <div
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${profileCompleted ? COLORS.borderStrong : COLORS.border}`,
                    background: profileCompleted ? COLORS.primarySoft : COLORS.panelSoft,
                    padding: "10px 12px",
                    color: COLORS.text,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Perfil {accountSummary.profileStatus}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>

      <motion.div
        variants={sectionRevealVariants}
        style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 16 }}
      >
        <motion.div variants={itemRevealVariants} whileInView="show" initial={shouldReduceMotion ? false : "hidden"} viewport={{ once: true, amount: 0.15 }}>
          <Card interactive enableTilt={shouldUseTilt} style={{ background: COLORS.panelDeep, borderColor: COLORS.borderStrong }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>Dados da conta</div>
              <div style={{ display: "grid", gap: 10 }}>
                <DataRow label="Nome" value={accountSummary.name} />
                <DataRow label="E-mail" value={accountSummary.accountEmail} />
                <DataRow label="CPF" value={accountSummary.cpf} />
                <DataRow label="Telefone" value={accountSummary.phone} />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemRevealVariants} whileInView="show" initial={shouldReduceMotion ? false : "hidden"} viewport={{ once: true, amount: 0.15 }}>
          <Card interactive enableTilt={shouldUseTilt} style={{ background: COLORS.panelDeep, borderColor: COLORS.borderStrong }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>Assinatura e status</div>
              <div style={{ display: "grid", gap: 10 }}>
                <DataRow label="Plano atual" value={accountSummary.plan} />
                <DataRow label="Perfil concluido" value={accountSummary.profileStatus} />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          variants={itemRevealVariants}
          whileInView="show"
          initial={shouldReduceMotion ? false : "hidden"}
          viewport={{ once: true, amount: 0.15 }}
          style={isMobile ? undefined : { gridColumn: "1 / -1" }}
        >
          <Card interactive enableTilt={shouldUseTilt} style={{ background: COLORS.panelDeep, borderColor: COLORS.borderStrong }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>Perfil fitness</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                <DataRow label="Objetivo" value={accountSummary.fitnessGoal} />
                <DataRow label="Nivel" value={accountSummary.experienceLevel} />
                <DataRow label="Altura" value={accountSummary.height} />
                <DataRow label="Peso" value={accountSummary.weight} />
                <DataRow label="Restricoes alimentares" value={accountSummary.dietaryRestrictions} />
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {metabolismData && (
        <motion.div variants={sectionRevealVariants}>
          <Card interactive enableTilt={shouldUseTilt} style={{ background: COLORS.panelDeep, borderColor: COLORS.borderStrong }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>Estado metabólico</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const t30 = metabolismData.trend30d;
                      const trend30Label =
                        !t30 || t30.direction === "stable"
                          ? "estável"
                          : `${t30.delta >= 0 ? "+" : ""}${t30.delta} pts`;
                      void drawEvolutionShareCard({
                        partnerName: branding?.displayName ?? academies?.[0]?.displayName ?? "MinutoFit",
                        userName: user?.name || accountSummary.name,
                        score: metabolismData.score,
                        trend30Label,
                        streak: gamification?.streak ?? 0,
                        logoUrl: branding?.logoUrl ?? academies?.[0]?.logoUrl ?? null,
                      }).catch(() => {
                        /* ignore */
                      });
                    }}
                    style={{
                      border: `1px solid ${COLORS.borderStrong}`,
                      background: COLORS.panelSoft,
                      color: COLORS.text,
                      fontWeight: 600,
                      fontSize: 13,
                      padding: "8px 14px",
                      borderRadius: 999,
                      cursor: "pointer",
                    }}
                  >
                    Baixar card para compartilhar
                  </button>
                  <Link
                    to="/app/user/today"
                    style={{ color: "#22C55E", fontWeight: 600, textDecoration: "none", fontSize: 13 }}
                  >
                    Ver evolução →
                  </Link>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <div
                  style={{
                    padding: "14px",
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Score</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{Math.round(metabolismData.score)}</div>
                </div>
                <div
                  style={{
                    padding: "14px",
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Nível</div>
                  <div style={{ fontSize: 16, fontWeight: 700, textTransform: "capitalize" }}>{metabolismData.status}</div>
                </div>
                <div
                  style={{
                    padding: "14px",
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Tendência</div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color:
                        metabolismData.trend === "up"
                          ? "#22C55E"
                          : metabolismData.trend === "down"
                            ? "#EF4444"
                            : COLORS.text,
                    }}
                  >
                    {metabolismData.trend === "up" ? "↑ Subindo" : metabolismData.trend === "down" ? "↓ Caindo" : "→ Estável"}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
