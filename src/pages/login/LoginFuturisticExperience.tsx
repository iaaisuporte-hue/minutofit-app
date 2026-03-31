import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useLoginMotionSafe } from "./loginPageMotion";
import "./loginFuturistic.css";

/** Posições fixas para evitar mismatch SSR/hidratação. */
const PARTICLE_LAYOUT = [
  { l: 4, t: 8, s: 2.5, delay: 0, dur: 14 },
  { l: 12, t: 22, s: 2, delay: 1.2, dur: 11 },
  { l: 88, t: 14, s: 3, delay: 0.4, dur: 16 },
  { l: 72, t: 35, s: 2, delay: 2.1, dur: 12 },
  { l: 25, t: 45, s: 2.8, delay: 0.8, dur: 13 },
  { l: 55, t: 8, s: 2.2, delay: 1.5, dur: 15 },
  { l: 92, t: 62, s: 2.4, delay: 0.2, dur: 11 },
  { l: 8, t: 68, s: 3.2, delay: 2.8, dur: 17 },
  { l: 38, t: 78, s: 2, delay: 1.1, dur: 12 },
  { l: 65, t: 88, s: 2.6, delay: 0.6, dur: 14 },
  { l: 48, t: 55, s: 2.3, delay: 2.4, dur: 13 },
  { l: 18, t: 38, s: 2.1, delay: 1.8, dur: 16 },
  { l: 78, t: 48, s: 2.7, delay: 0.9, dur: 11 },
  { l: 33, t: 12, s: 2, delay: 2.2, dur: 15 },
  { l: 58, t: 72, s: 3, delay: 0.3, dur: 12 },
  { l: 95, t: 28, s: 2.2, delay: 1.6, dur: 14 },
  { l: 6, t: 52, s: 2.5, delay: 2.5, dur: 13 },
  { l: 44, t: 92, s: 2.4, delay: 0.7, dur: 16 },
  { l: 82, t: 8, s: 2.8, delay: 1.3, dur: 11 },
  { l: 22, t: 62, s: 2, delay: 2, dur: 15 },
  { l: 70, t: 18, s: 2.6, delay: 0.5, dur: 12 },
  { l: 52, t: 38, s: 2.3, delay: 1.9, dur: 14 },
  { l: 14, t: 88, s: 3.1, delay: 0.1, dur: 13 },
  { l: 62, t: 58, s: 2.2, delay: 2.6, dur: 17 },
  { l: 28, t: 28, s: 2.4, delay: 1.4, dur: 11 },
  { l: 90, t: 78, s: 2, delay: 0.8, dur: 16 },
  { l: 40, t: 18, s: 2.7, delay: 2.3, dur: 12 },
  { l: 75, t: 92, s: 2.5, delay: 1, dur: 14 },
  { l: 2, t: 42, s: 2.2, delay: 1.7, dur: 15 },
  { l: 98, t: 52, s: 2.8, delay: 0.4, dur: 13 },
  { l: 32, t: 68, s: 2.1, delay: 2.1, dur: 11 },
  { l: 58, t: 22, s: 3, delay: 0.6, dur: 16 },
  { l: 16, t: 18, s: 2.3, delay: 1.2, dur: 12 },
  { l: 84, t: 38, s: 2.5, delay: 2.7, dur: 14 },
  { l: 46, t: 48, s: 2, delay: 0.9, dur: 15 },
  { l: 68, t: 12, s: 2.6, delay: 1.5, dur: 13 },
];

/** Caps vmax-based orbs so narrow viewports do not force horizontal overflow. */
const ORB_LG = "min(85vmax, 120vmin)";
const ORB_MD = "min(70vmax, 110vmin)";
const ORB_SM = "min(55vmax, 95vmin)";

function AnimatedMeshOrbs({ enableAnimation }: { enableAnimation: boolean }) {
  if (!enableAnimation) {
    return (
      <div className="login-future-mesh login-future-mesh-static" style={{ position: "absolute", inset: 0 }} aria-hidden>
        <div
          style={{
            position: "absolute",
            width: ORB_LG,
            height: ORB_LG,
            borderRadius: "50%",
            left: "-25%",
            top: "-35%",
            background: "radial-gradient(circle, rgba(29,185,84,0.38) 0%, transparent 58%)",
            filter: "blur(72px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: ORB_MD,
            height: ORB_MD,
            borderRadius: "50%",
            right: "-20%",
            bottom: "-25%",
            background: "radial-gradient(circle, rgba(124,255,107,0.2) 0%, transparent 55%)",
            filter: "blur(64px)",
          }}
        />
        <div className="login-future-mesh-gradient-shift login-future-mesh-gradient-static" aria-hidden />
      </div>
    );
  }

  return (
    <div className="login-future-mesh" style={{ position: "absolute", inset: 0 }} aria-hidden>
      <motion.div
        style={{
          position: "absolute",
          width: ORB_LG,
          height: ORB_LG,
          borderRadius: "50%",
          left: "-25%",
          top: "-35%",
          background: "radial-gradient(circle, rgba(29,185,84,0.42) 0%, transparent 58%)",
          filter: "blur(72px)",
        }}
        animate={{
          x: [0, 48, -32, 0],
          y: [0, 36, -24, 0],
          scale: [1, 1.12, 0.94, 1],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        style={{
          position: "absolute",
          width: ORB_MD,
          height: ORB_MD,
          borderRadius: "50%",
          right: "-20%",
          bottom: "-25%",
          background: "radial-gradient(circle, rgba(124,255,107,0.22) 0%, transparent 55%)",
          filter: "blur(64px)",
        }}
        animate={{
          x: [0, -40, 28, 0],
          y: [0, -28, 20, 0],
          scale: [1, 0.92, 1.06, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        style={{
          position: "absolute",
          width: ORB_SM,
          height: ORB_SM,
          borderRadius: "50%",
          left: "35%",
          top: "40%",
          background: "radial-gradient(circle, rgba(0,255,200,0.12) 0%, transparent 50%)",
          filter: "blur(56px)",
        }}
        animate={{
          x: [0, -55, 40, 0],
          y: [0, 45, -30, 0],
          opacity: [0.5, 0.85, 0.55, 0.5],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <div className="login-future-mesh-gradient-shift" aria-hidden />
    </div>
  );
}

function ParticleField() {
  return (
    <div className="login-future-particles" aria-hidden>
      {PARTICLE_LAYOUT.map((p, i) => (
        <span
          key={i}
          className="login-future-particle"
          style={{
            left: `${p.l}%`,
            top: `${p.t}%`,
            width: p.s,
            height: p.s,
            ["--delay" as string]: `${p.delay}s`,
            ["--dur" as string]: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

export function TiltGlassFeatureCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile(720);
  const prefersReduced = useReducedMotion();
  const enableTilt = !prefersReduced && !isMobile;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 380, damping: 38 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 380, damping: 38 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!enableTilt) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div style={{ perspective: enableTilt ? 1100 : undefined }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{
          rotateX: enableTilt ? rotateX : 0,
          rotateY: enableTilt ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
        whileHover={enableTilt ? { scale: 1.02 } : { scale: 1.01 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        <div className="login-future-tilt-inner">{children}</div>
      </motion.div>
    </div>
  );
}

type Props = {
  hero: ReactNode;
  card: ReactNode;
};

export function LoginFuturisticExperience({ hero, card }: Props) {
  const isMobile = useIsMobile(720);
  const prefersReduced = useReducedMotion();
  const { shouldUseParallax, shouldUseAmbientMesh, shouldUseParticles } = useLoginMotionSafe({ isMobile });

  const { scrollY } = useScroll();
  const parallax = shouldUseParallax ? 1 : 0;
  const heroY = useTransform(scrollY, [0, 700], [0, 90 * parallax]);
  const cardY = useTransform(scrollY, [0, 700], [0, -55 * parallax]);
  const meshY = useTransform(scrollY, [0, 700], [0, 100 * parallax]);
  const particleY = useTransform(scrollY, [0, 700], [0, 45 * parallax]);

  const shellTransition = prefersReduced
    ? { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }
    : { type: "spring" as const, stiffness: 220, damping: 26 };

  const cardTransition = prefersReduced
    ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const, delay: 0.06 }
    : { type: "spring" as const, stiffness: 260, damping: 28, delay: 0.12 };

  return (
    <div className="login-future-page">
      <motion.div
        style={{
          position: "fixed",
          inset: 0,
          y: meshY,
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden
      >
        <AnimatedMeshOrbs enableAnimation={shouldUseAmbientMesh} />
      </motion.div>
      {shouldUseParticles ? (
        <motion.div style={{ y: particleY }} className="login-future-particles-motion">
          <ParticleField />
        </motion.div>
      ) : null}
      <div className="login-future-scanline" aria-hidden />

      <div className="authLayout login-future-grid">
        <motion.div
          className="login-future-hero-shell login-future-glass-surface"
          style={{ y: heroY }}
          initial={prefersReduced ? { opacity: 0, y: 16 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shellTransition}
        >
          {hero}
        </motion.div>
        <motion.div
          className="login-future-card-shell login-future-glass-surface"
          style={{ y: cardY }}
          initial={prefersReduced ? { opacity: 0, y: 20 } : { opacity: 0, x: 32 }}
          animate={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
          transition={cardTransition}
          whileHover={
            prefersReduced || isMobile
              ? undefined
              : {
                  scale: 1.008,
                  boxShadow: "0 28px 64px rgba(0,0,0,.52), 0 0 72px rgba(124,255,107,.1)",
                  transition: { duration: 0.28 },
                }
          }
          whileTap={prefersReduced || isMobile ? undefined : { scale: 0.995 }}
        >
          {card}
        </motion.div>
      </div>
    </div>
  );
}
