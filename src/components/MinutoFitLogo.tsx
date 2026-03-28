import type { CSSProperties } from "react";

type Props = {
  /** Largura em px; altura segue proporção */
  width?: number;
  variant?: "horizontal" | "mark";
  className?: string;
  style?: CSSProperties;
};

/**
 * Logomarca MinutoFit — anel (tempo) + pulso (energia) + wordmark.
 * Arquivos estáticos: /minutofit-logo.svg, /minutofit-icon.svg
 */
export default function MinutoFitLogo({ width = 200, variant = "horizontal", className, style }: Props) {
  const src = variant === "mark" ? "/minutofit-icon.svg" : "/minutofit-logo.svg";
  const aspect = variant === "mark" ? 1 : 280 / 56;
  const h = Math.round(width / aspect);

  return (
    <img
      src={src}
      alt="MinutoFit"
      width={width}
      height={h}
      className={className}
      style={{ display: "block", height: "auto", ...style }}
      decoding="async"
    />
  );
}
