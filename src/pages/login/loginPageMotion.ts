import { useReducedMotion, type Variants } from "framer-motion";

type Options = { isMobile: boolean };

export function useLoginMotionSafe({ isMobile }: Options) {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(prefersReducedMotion);
  const shouldUseParallax = !shouldReduceMotion && !isMobile;
  const shouldUseTilt = !shouldReduceMotion && !isMobile;
  const shouldUseAmbientMesh = !shouldReduceMotion;
  const shouldUseParticles = !shouldReduceMotion;
  const shouldUsePulse = !shouldReduceMotion;

  return {
    shouldReduceMotion,
    shouldUseParallax,
    shouldUseTilt,
    shouldUseAmbientMesh,
    shouldUseParticles,
    shouldUsePulse,
  };
}

const easeOutSoft: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const loginPageStaggerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
};

export const loginSectionRevealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutSoft },
  },
};

export const loginItemRevealVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: easeOutSoft },
  },
};

export const loginCardInnerStagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const loginSubtleHover = { scale: 1.02 };
export const loginSubtleTap = { scale: 0.98 };
