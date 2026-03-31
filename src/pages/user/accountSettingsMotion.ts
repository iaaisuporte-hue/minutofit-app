import { useReducedMotion, type Variants } from "framer-motion";

type MotionOptions = {
  isMobile: boolean;
};

export function useSettingsMotionSafe({ isMobile }: MotionOptions) {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(prefersReducedMotion);
  const shouldUseParallax = !shouldReduceMotion && !isMobile;
  const shouldUseTilt = !shouldReduceMotion && !isMobile;
  const shouldUsePulse = !shouldReduceMotion;

  return {
    shouldReduceMotion,
    shouldUseParallax,
    shouldUseTilt,
    shouldUsePulse,
  };
}

const easeOutSoft: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const settingsMotionDurations = {
  section: 0.55,
  item: 0.48,
} as const;

export const settingsPageStaggerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.05,
    },
  },
};

export const settingsSectionRevealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: settingsMotionDurations.section, ease: easeOutSoft },
  },
};

export const settingsItemRevealVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: settingsMotionDurations.item, ease: easeOutSoft },
  },
};

export const settingsTextStaggerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const settingsSubtleTap = { scale: 0.98 };
export const settingsSubtleHover = { scale: 1.02 };
