import type { CSSProperties } from "react";

type Props = {
  /** Largura em px; altura segue proporção */
  width?: number;
  variant?: "horizontal" | "mark";
  className?: string;
  style?: CSSProperties;
};

const WORDMARK_FONT =
  "'Manrope','Segoe UI',system-ui,-apple-system,Arial,sans-serif";

/**
 * Logomarca S2CORE.
 * - `horizontal`: wordmark inline (SVG) — o texto usa `currentColor`, então
 *   inverte sozinho conforme o tema (escuro no claro, claro no escuro). O "2"
 *   e o slogan ficam sempre oliva. Assets em /public são nomes legados.
 * - `mark`: símbolo (anel + S2) em tile escuro fixo — não inverte de propósito.
 */
export default function CoreFitLogo({ width = 178, variant = "horizontal", className, style }: Props) {
  if (variant === "mark") {
    return (
      <img
        src="/corefit-icon.svg"
        alt="S2CORE"
        width={width}
        height={width}
        className={className}
        style={{ display: "block", ...style }}
        decoding="async"
      />
    );
  }

  const h = Math.round(width * (56 / 264));
  return (
    <svg
      viewBox="0 0 264 56"
      width={width}
      height={h}
      role="img"
      aria-label="s2core — more than training"
      className={className}
      style={{ display: "block", color: "var(--color-text)", ...style }}
    >
      <text
        x="132"
        y="37"
        textAnchor="middle"
        fontFamily={WORDMARK_FONT}
        fontSize="34"
        fontWeight="800"
        letterSpacing="-0.5"
      >
        <tspan fill="currentColor">s</tspan>
        <tspan fill="#7B9919">2</tspan>
        <tspan fill="currentColor">core</tspan>
      </text>
      <text
        x="133"
        y="51"
        textAnchor="middle"
        fontFamily={WORDMARK_FONT}
        fontSize="7.5"
        fontWeight="600"
        fill="#7B9919"
        letterSpacing="3"
      >
        MORE THAN TRAINING
      </text>
    </svg>
  );
}
