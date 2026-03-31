import { useReducedMotion, type Variants } from "framer-motion";

type MotionOptions = {
  isMobile: boolean;
};

export function useTodayMotionSafe({ isMobile }: MotionOptions) {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(prefersReducedMotion);
  const shouldUseTilt = !shouldReduceMotion && !isMobile;
  const shouldUseParallax = !shouldReduceMotion;
  const shouldUsePulse = !shouldReduceMotion;

  return {
    shouldReduceMotion,
    shouldUseTilt,
    shouldUseParallax,
    shouldUsePulse,
  };
}

const easeOutSoft: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const todayMotionDurations = {
  hero: 0.55,
  item: 0.5,
  quick: 0.3,
} as const;

export const pageStaggerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06,
    },
  },
};

export const sectionRevealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: todayMotionDurations.hero, ease: easeOutSoft },
  },
};

export const itemRevealVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: todayMotionDurations.item, ease: easeOutSoft },
  },
};

export const subtleTapScale = { scale: 0.98 };
export const subtleHoverScale = { scale: 1.02 };

