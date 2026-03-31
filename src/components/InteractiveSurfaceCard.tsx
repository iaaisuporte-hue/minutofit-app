import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  disabled?: boolean;
  enableTilt?: boolean;
  whileHover?: { scale: number };
  whileTap?: { scale: number };
};

export default function InteractiveSurfaceCard({
  children,
  style,
  disabled = false,
  enableTilt = true,
  whileHover,
  whileTap,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 300, damping: 30 });
  const glowX = useTransform(mx, [-0.5, 0.5], [30, 70]);
  const glowY = useTransform(my, [-0.5, 0.5], [30, 70]);
  const glowXPercent = useTransform(glowX, (v) => `${v}%`);
  const glowYPercent = useTransform(glowY, (v) => `${v}%`);
  const dynamicShadow = useTransform([mx, my], (latest) => {
    const [x, y] = latest as number[];
    return `${-x * 18}px ${-y * 18}px 30px rgba(29,185,84,.18)`;
  });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!enableTilt || disabled) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      whileHover={disabled ? undefined : whileHover}
      whileTap={disabled ? undefined : whileTap}
      style={{
        position: "relative",
        transformStyle: "preserve-3d",
        rotateX: enableTilt ? rotateX : 0,
        rotateY: enableTilt ? rotateY : 0,
        boxShadow: enableTilt ? dynamicShadow : undefined,
        willChange: "transform",
        ...style,
      }}
    >
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          background:
            "radial-gradient(circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(124,255,107,.15) 0%, rgba(124,255,107,0) 55%)",
          ["--glow-x" as string]: enableTilt ? glowXPercent : "50%",
          ["--glow-y" as string]: enableTilt ? glowYPercent : "50%",
        }}
      />
      {children}
    </motion.div>
  );
}

