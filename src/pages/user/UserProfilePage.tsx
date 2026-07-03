import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
import { useProfessionalContext } from "../../features/professionalVoice";
import { COLORS } from "../../styles/colors";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import EssentialProfileModal from "./components/EssentialProfileModal";
import { useToast } from "../../components/Toast";
import { API_URL } from "../../services/apiBase";
import { authFetch } from "../../services/apiClient";
import { formatCpf, formatPhone } from "../../utils/validators";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";

// Painel pesado (~900 linhas + canvas de assinatura) — carregado sob demanda
// para não pesar no chunk da 5ª aba do bottom nav.
const StudentCompliancePanel = lazy(() => import("./studentCompliance/StudentCompliancePanel"));

type Props = {
  onLogout: () => void;
};

function ContactField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: "var(--font-semibold)", fontSize: "var(--text-sm)", color: COLORS.text }}>{label}</div>
        {hint ? <div style={{ color: COLORS.mutedSoft, fontSize: "var(--text-xs)" }}>{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function ContactInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { readOnly, ...rest } = props;
  return (
    <input
      {...rest}
      readOnly={readOnly}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${COLORS.border}`,
        background: readOnly ? COLORS.panelSoft : COLORS.panelDeep,
        color: readOnly ? COLORS.muted : COLORS.text,
        outline: "none",
        fontWeight: 600,
        cursor: readOnly ? "default" : "text",
      }}
    />
  );
}

function Card({
  children,
  style,
  interactive = false,
  enableTilt = false,
  flat = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  interactive?: boolean;
  enableTilt?: boolean;
  /** Sem sombra + padding menor — para os cards secundários (só o card nobre mantém sombra). */
  flat?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    border: `1px solid ${COLORS.border}`,
    borderRadius: "var(--radius-card)",
    background: COLORS.panel,
    boxShadow: flat ? "none" : "var(--shadow-md)",
    padding: flat ? "var(--space-4)" : "var(--space-5)",
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

function DataRow({ label, value, placeholder, onEdit }: { label: string; value: string | null; placeholder: string; onEdit: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panelDeep,
        alignItems: "center",
      }}
    >
      <div style={{ color: COLORS.mutedSoft, fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
      {value ? (
        <div style={{ color: COLORS.text, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", textAlign: "right" }}>{value}</div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: COLORS.primary, fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)" }}
        >
          {placeholder}
        </button>
      )}
    </div>
  );
}

function getInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "A";
}

// Teaser interpretativo (Fase 4) — frase curta a partir de estado/tendência/lacunas.
// Heurística TS pura. Lacuna é sempre enquadrada como ganho ("para uma leitura mais
// precisa"), nunca como cobrança. Nada de diagnóstico.
function deriveProfileTeaser(opts: { band?: "low" | "moderate" | "high"; trend: "up" | "down" | "stable"; missing: string[] }): string {
  const { band, trend, missing } = opts;
  if (missing.length >= 3) return "Complete seu perfil para uma leitura mais precisa.";
  if (missing.length > 0) {
    const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} e ${missing[missing.length - 1]}`;
    return `Complete ${list} para uma leitura mais precisa.`;
  }
  if (band === "low" || trend === "down") return "Seus sinais pedem um ritmo mais leve — priorize recuperação e sono.";
  if (band === "high") return "Seu estado está em alta. Bom momento para manter a consistência.";
  if (trend === "up") return "Sua tendência recente é positiva. Siga no ritmo.";
  return "Seu estado está equilibrado. Pequenos ajustes mantêm a curva subindo.";
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panelDeep,
        color: COLORS.text,
        fontSize: "var(--text-sm)",
        fontWeight: "var(--font-semibold)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
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
    ctx.fillText("S2Core — mais que treino", 72, H - 72);
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
          a.download = "s2core-evolucao.png";
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
          a.download = "s2core-evolucao.png";
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
      a.download = "s2core-evolucao.png";
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

export default function UserProfilePage({ onLogout }: Props) {
  const location = useLocation();
  const { user, branding, academies, accessProfile, getUser } = useAuth();
  const { data: metabolismData } = useMetabolism();
  const { data: gamification } = useGamificationSummary();
  const { planName } = useFeatureFlags();
  const isMobile = useIsMobile(720);
  const { shouldReduceMotion, shouldUseTilt } = useTodayMotionSafe({ isMobile });
  const toast = useToast();
  const isLimitedProfile = accessProfile === "clientes_sb";

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [essentialOpen, setEssentialOpen] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfMasked, setCpfMasked] = useState("—");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name?.trim() || "");
    setEmail(user.email || "");
    setPhone(user.phone ? formatPhone(user.phone) : "");
    setCpfMasked(user.cpf ? formatCpf(user.cpf) : "—");
  }, [user]);

  // Deep-link vindo do redirect de /settings (?focus=compliance ou #compliance).
  // Retry generoso porque o painel de compliance é lazy — o anchor #compliance
  // só existe depois que o chunk carrega.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focusCompliance = params.get("focus") === "compliance";
    const hasComplianceHash = location.hash === "#compliance";
    if (!focusCompliance && !hasComplianceHash) return;
    let attempts = 0;
    const maxAttempts = 25;
    const timer = window.setInterval(() => {
      const target = document.getElementById("compliance");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        window.clearInterval(timer);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) window.clearInterval(timer);
    }, 80);
    return () => window.clearInterval(timer);
  }, [location.hash, location.search]);

  async function refreshFromServer() {
    const latest = await getUser();
    if (latest) {
      setName(latest.name?.trim() || "");
      setEmail(latest.email || "");
      setPhone(latest.phone ? formatPhone(latest.phone) : "");
      setCpfMasked(latest.cpf ? formatCpf(latest.cpf) : "—");
    }
  }

  async function saveProfile() {
    if (!name.trim()) { toast.error("Informe seu nome."); return; }
    setSavingProfile(true);
    try {
      const res = await authFetch(`${API_URL}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Falha ao salvar dados.");
      }
      await refreshFromServer();
      toast.success("Dados salvos com sucesso.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSavingProfile(false);
    }
  }

  function scrollToContact() {
    document.getElementById("dados-contato")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const accountSummary = useMemo(
    () => ({
      name: user?.name || "Aluno",
      plan: mapCanonicalPlanToLabel(normalizeToCanonicalPlanName(planName || user?.subscriptionTier)),
      fitnessGoal: user?.fitnessGoal || null,
      experienceLevel: user?.experienceLevel || null,
      height: user?.heightCm ? `${user.heightCm} cm` : null,
      weight: user?.weightKg ? `${user.weightKg} kg` : null,
    }),
    [
      user?.experienceLevel,
      user?.fitnessGoal,
      user?.heightCm,
      user?.name,
      planName,
      user?.subscriptionTier,
      user?.weightKg,
    ]
  );

  const realAcademyName = branding?.displayName ?? academies?.[0]?.displayName ?? null;
  const derivedEnergy = useMemo(() => deriveEnergyStatus(metabolismData), [metabolismData]);
  const { data: proContext } = useProfessionalContext();
  const personalName = proContext?.personal?.name ?? null;
  const nutriName = proContext?.nutri?.name ?? null;

  const profileTeaser = useMemo(() => {
    if (!metabolismData) return null;
    const missing: string[] = [];
    if (!accountSummary.fitnessGoal) missing.push("seu objetivo");
    if (!accountSummary.experienceLevel) missing.push("seu nível");
    if (!accountSummary.height) missing.push("sua altura");
    if (!accountSummary.weight) missing.push("seu peso");
    return deriveProfileTeaser({ band: derivedEnergy?.band, trend: metabolismData.trend, missing });
  }, [metabolismData, derivedEnergy, accountSummary]);

  return (
    <motion.div
      style={{ display: "grid", gap: "var(--space-4)" }}
      variants={pageStaggerVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
    >
      {isLimitedProfile && (
        <motion.div variants={sectionRevealVariants}>
          <div
            style={{
              borderRadius: "var(--radius-lg)",
              padding: 12,
              border: `1px solid ${COLORS.primaryBorder}`,
              background: COLORS.primarySoft,
              color: COLORS.muted,
              fontSize: "var(--text-sm)",
              lineHeight: 1.4,
            }}
          >
            <b>Plano clientes SB:</b> o app mantém o foco em Hoje e Treinos em casa. Aqui você acompanha e ajusta seus dados básicos de contato.
          </div>
        </motion.div>
      )}

      <motion.div variants={sectionRevealVariants}>
        <Card flat style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "var(--gradient-primary)" }} />
          <motion.div style={{ display: "grid", gap: "var(--space-4)", padding: "var(--space-5)" }}>
            <motion.div
              variants={itemRevealVariants}
              style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
            >
              <div
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panel,
                  color: COLORS.muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--text-xl)",
                  fontWeight: "var(--font-bold)",
                  flex: "0 0 auto",
                }}
              >
                {getInitial(accountSummary.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SectionTitle eyebrow="Meu S2Core" title={accountSummary.name} />
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={scrollToContact}
                style={{ fontSize: "var(--text-sm)", flex: "0 0 auto" }}
              >
                Editar perfil
              </button>
            </motion.div>

            <motion.div variants={itemRevealVariants} style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
              <Chip>{accountSummary.plan}</Chip>
              <Chip>{`${gamification?.streak ?? 0} dias de consistência`}</Chip>
              <Link
                to="/app/user/equipe"
                style={{ marginLeft: "auto", color: COLORS.primary, fontWeight: "var(--font-semibold)", textDecoration: "none", fontSize: "var(--text-sm)" }}
              >
                Minha equipe →
              </Link>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>

      {metabolismData && (
        <motion.div variants={sectionRevealVariants}>
          <Card interactive enableTilt={shouldUseTilt} style={{ borderLeft: "3px solid var(--color-primary)" }}>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)", letterSpacing: "0.07em", textTransform: "uppercase" }}>Como o S2Core te lê hoje</div>
                <Link
                  to="/app/user/estado-metabolico"
                  style={{ color: COLORS.primary, fontWeight: "var(--font-semibold)", textDecoration: "none", fontSize: "var(--text-sm)" }}
                >
                  Ver evolução →
                </Link>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", color: COLORS.text }}>{Math.round(metabolismData.score)}</span>
                <span style={{ color: COLORS.muted, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>
                  {derivedEnergy?.band === "low" ? "pedindo recuperação" : derivedEnergy?.band === "high" ? "em alta" : "equilibrado"}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--font-semibold)",
                    color: metabolismData.trend === "up" ? "var(--color-success-text)" : metabolismData.trend === "down" ? "var(--color-danger)" : COLORS.muted,
                  }}
                >
                  {metabolismData.trend === "up" ? "melhorando ↑" : metabolismData.trend === "down" ? "em queda ↓" : "estável →"}
                </span>
              </div>
              {profileTeaser && (
                <div style={{ color: COLORS.muted, fontSize: "var(--text-base)", lineHeight: 1.5 }}>{profileTeaser}</div>
              )}
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
                    partnerName: branding?.displayName ?? academies?.[0]?.displayName ?? "S2Core",
                    userName: user?.name || accountSummary.name,
                    score: metabolismData.score,
                    trend30Label,
                    streak: gamification?.streak ?? 0,
                    logoUrl: branding?.logoUrl ?? academies?.[0]?.logoUrl ?? null,
                  }).catch(() => {
                    /* ignore */
                  });
                }}
                style={{ justifySelf: "start", fontSize: "var(--text-sm)" }}
              >
                Compartilhar resumo
              </button>
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div variants={sectionRevealVariants}>
        <Card flat>
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: COLORS.text }}>Perfil essencial</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEssentialOpen(true)}
                style={{ fontSize: "var(--text-sm)", flex: "0 0 auto" }}
              >
                Editar
              </button>
            </div>
            <div style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
              <DataRow label="Objetivo" value={accountSummary.fitnessGoal} placeholder="definir" onEdit={() => setEssentialOpen(true)} />
              <DataRow label="Nível" value={accountSummary.experienceLevel} placeholder="definir" onEdit={() => setEssentialOpen(true)} />
              <DataRow label="Altura" value={accountSummary.height} placeholder="informar" onEdit={() => setEssentialOpen(true)} />
              <DataRow label="Peso" value={accountSummary.weight} placeholder="informar" onEdit={() => setEssentialOpen(true)} />
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={sectionRevealVariants}>
        <Card flat>
          <div id="dados-contato" style={{ display: "grid", gap: "var(--space-3)", scrollMarginTop: "min(88px, 18vh)" }}>
            <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: COLORS.text }}>Dados e contato</div>
            <ContactField label="Nome" hint="Como você quer ser chamado">
              <ContactInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
            </ContactField>
            <ContactField label="E-mail" hint="Identificador de login — não alterar aqui">
              <ContactInput value={email} readOnly placeholder="seuemail@dominio.com" autoComplete="email" />
            </ContactField>
            <ContactField label="Telefone" hint="WhatsApp ou celular para contato">
              <ContactInput
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                autoComplete="tel"
                inputMode="tel"
              />
            </ContactField>
            <ContactField label="CPF" hint="Cadastro — somente leitura">
              <ContactInput value={cpfMasked} readOnly placeholder="—" autoComplete="off" />
            </ContactField>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={() => void saveProfile()} disabled={savingProfile} style={{ minHeight: 44 }}>
                {savingProfile ? "Salvando..." : "Salvar dados"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void refreshFromServer()} style={{ minHeight: 44 }}>
                Atualizar da sessão
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {user?.role === "user" && (
        <motion.div variants={sectionRevealVariants}>
          <Card flat>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                  Saúde &amp; compliance
                </div>
                <div style={{ height: 5, borderRadius: 999, background: COLORS.panelDeep, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                  <div
                    style={{
                      height: "100%",
                      width: user.studentComplianceComplete ? "100%" : "0%",
                      borderRadius: 999,
                      background: "var(--gradient-primary)",
                      transition: "width 0.65s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
                <div style={{ color: COLORS.mutedSoft, fontSize: "var(--text-xs)", lineHeight: 1.35 }}>
                  {user.studentComplianceComplete ? "Cadastro de compliance concluído." : "Complete triagem e PAR-Q para liberar o uso completo."}
                </div>
              </div>
              {/* Renderizado direto, SEM card interativo: tilt/whileTap capturavam o
                  toque do bloco inteiro no mobile, deixando checkboxes/assinatura
                  não-clicáveis. O painel já tem borda, fundo e padding próprios. */}
              <Suspense fallback={<LoadingSkeleton />}>
                <StudentCompliancePanel />
              </Suspense>
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div variants={sectionRevealVariants}>
        <Card flat>
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <div style={{ color: COLORS.mutedSoft, fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)", letterSpacing: "0.07em", textTransform: "uppercase" }}>Vínculos</div>
            {personalName || nutriName || realAcademyName ? (
              <div style={{ color: COLORS.text, fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>
                {`Personal: ${personalName ?? "—"}  ·  Nutri: ${nutriName ?? "—"}  ·  Academia: ${realAcademyName ?? "—"}`}
              </div>
            ) : (
              <div style={{ color: COLORS.muted, fontSize: "var(--text-base)" }}>Nenhum profissional vinculado ainda.</div>
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={sectionRevealVariants}>
        <Card flat>
          <SportProfileSection />
        </Card>
      </motion.div>

      <motion.div variants={sectionRevealVariants} style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setConfirmLogout(true)}
        >
          Sair da conta
        </button>
      </motion.div>

      <EssentialProfileModal open={essentialOpen} onClose={() => setEssentialOpen(false)} />
      <ConfirmDialog
        open={confirmLogout}
        title="Sair da conta?"
        confirmLabel="Sair"
        danger
        onConfirm={() => { setConfirmLogout(false); onLogout(); }}
        onCancel={() => setConfirmLogout(false)}
      />
    </motion.div>
  );
}
