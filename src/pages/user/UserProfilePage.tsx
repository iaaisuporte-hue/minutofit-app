import React, { useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import InteractiveSurfaceCard from "../../components/InteractiveSurfaceCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuth } from "../../auth/AuthContext";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { mapCanonicalPlanToLabel, normalizeToCanonicalPlanName } from "../../utils/planNormalization";
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

export default function UserProfilePage({ onLogout: _onLogout }: Props) {
  const { user, email, profileCompleted } = useAuth();
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
    </motion.div>
  );
}
