import type { CSSProperties } from "react";

type Props = {
  /** Largura em px; altura segue proporção */
  width?: number;
  variant?: "horizontal" | "mark";
  className?: string;
  style?: CSSProperties;
};

/**
 * Logomarca CoreFit — assets em /corefit-logo.svg e /corefit-icon.svg (nomes legados de arquivo).
 */
export default function CoreFitLogo({ width = 200, variant = "horizontal", className, style }: Props) {
  const src = variant === "mark" ? "/corefit-icon.svg" : "/corefit-logo.svg";
  const aspect = variant === "mark" ? 1 : 280 / 56;
  const h = Math.round(width / aspect);

  return (
    <img
      src={src}
      alt="S2Core"
      width={width}
      height={h}
      className={className}
      style={{ display: "block", height: "auto", ...style }}
      decoding="async"
    />
  );
}
