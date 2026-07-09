import { useEffect, useState } from "react";

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

export type NeonTheme = {
  primary: string;
  highlight: string;
  primaryDeep: string;
  stroke: string;
  strokeStrong: string;
  muted: string;
  muted2: string;
  white: string;
  bg: string;
  panel: string;
  card: string;
  accentSoft: string;
  accentBorder: string;
  accentBorderStrong: string;
  ctaText: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  ctaGradient: string;
  border: string;
  border2: string;
  panel2: string;
  text: string;
  primarySoft: string;
  highlightSoft: string;
};

const NEON_FALLBACK: NeonTheme = {
  primary: "#7B9919",
  highlight: "#5E7412",
  primaryDeep: "#14532D",
  stroke: "#E5E7EB",
  strokeStrong: "rgba(123,153,25,0.35)",
  muted: "#6B7280",
  muted2: "#9CA3AF",
  white: "#FFFFFF",
  bg: "#F7F9F8",
  panel: "#FFFFFF",
  card: "#FFFFFF",
  accentSoft: "rgba(123,153,25,0.08)",
  accentBorder: "rgba(123,153,25,0.3)",
  accentBorderStrong: "rgba(123,153,25,0.4)",
  ctaText: "#FFFFFF",
  danger: "#DC2626",
  dangerSoft: "rgba(239,68,68,0.08)",
  dangerBorder: "rgba(239,68,68,0.25)",
  ctaGradient: "#7B9919",
  border: "#E5E7EB",
  border2: "#F3F4F6",
  panel2: "#F9FAFB",
  text: "#1F2937",
  primarySoft: "rgba(123,153,25,0.08)",
  highlightSoft: "rgba(123,153,25,0.1)",
};

export { NEON_FALLBACK };

export function getNeonTheme(): NeonTheme {
  const primary = readCssVar("--primary", NEON_FALLBACK.primary);
  const highlight = readCssVar("--highlight", NEON_FALLBACK.highlight);
  return {
    primary,
    highlight,
    primaryDeep: readCssVar("--primary-deep", NEON_FALLBACK.primaryDeep),
    stroke: readCssVar("--stroke", NEON_FALLBACK.stroke),
    strokeStrong: readCssVar("--stroke-strong", NEON_FALLBACK.strokeStrong),
    muted: readCssVar("--muted", NEON_FALLBACK.muted),
    muted2: readCssVar("--muted2", NEON_FALLBACK.muted2),
    white: readCssVar("--white", NEON_FALLBACK.white),
    bg: readCssVar("--bg", NEON_FALLBACK.bg),
    panel: readCssVar("--panel", NEON_FALLBACK.panel),
    card: readCssVar("--card", NEON_FALLBACK.card),
    accentSoft: readCssVar("--neon-accent-soft", NEON_FALLBACK.accentSoft),
    accentBorder: readCssVar("--neon-accent-border", NEON_FALLBACK.accentBorder),
    accentBorderStrong: readCssVar("--neon-accent-border-strong", NEON_FALLBACK.accentBorderStrong),
    ctaText: readCssVar("--neon-cta-text", NEON_FALLBACK.ctaText),
    danger: readCssVar("--danger", NEON_FALLBACK.danger),
    dangerSoft: readCssVar("--neon-danger-soft", NEON_FALLBACK.dangerSoft),
    dangerBorder: readCssVar("--neon-danger-border", NEON_FALLBACK.dangerBorder),
    ctaGradient: primary,
    border: readCssVar("--stroke", NEON_FALLBACK.stroke),
    border2: readCssVar("--stroke-subtle", NEON_FALLBACK.border2),
    panel2: readCssVar("--panel-strong", NEON_FALLBACK.panel2),
    text: readCssVar("--black", NEON_FALLBACK.text),
    primarySoft: readCssVar("--neon-primary-soft", NEON_FALLBACK.primarySoft),
    highlightSoft: readCssVar("--neon-highlight-soft", NEON_FALLBACK.highlightSoft),
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNeonTheme(): NeonTheme {
  const [theme, setTheme] = useState(() => getNeonTheme());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getNeonTheme());
    const mo = new MutationObserver(() => setTheme(getNeonTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-mode", "data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}
