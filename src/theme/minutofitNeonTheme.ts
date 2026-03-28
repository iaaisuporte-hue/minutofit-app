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
  primary: "#1DB954",
  highlight: "#7CFF6B",
  primaryDeep: "#0F3D2E",
  stroke: "rgba(124,255,107,.16)",
  strokeStrong: "rgba(29,185,84,.34)",
  muted: "rgba(255,255,255,.74)",
  muted2: "rgba(232,236,233,.58)",
  white: "#FFFFFF",
  bg: "#121212",
  panel: "#161916",
  card: "#181d19",
  accentSoft: "rgba(29,185,84,.18)",
  accentBorder: "rgba(29,185,84,.42)",
  accentBorderStrong: "rgba(29,185,84,.55)",
  ctaText: "#082014",
  danger: "#DC2626",
  dangerSoft: "rgba(239,68,68,.12)",
  dangerBorder: "rgba(239,68,68,.35)",
  ctaGradient: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
  border: "rgba(255,255,255,.10)",
  border2: "rgba(255,255,255,.08)",
  panel2: "#141414",
  text: "#FFFFFF",
  primarySoft: "rgba(29,185,84,.18)",
  highlightSoft: "rgba(124,255,107,.12)",
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
    ctaGradient: `linear-gradient(135deg, ${primary} 0%, ${highlight} 100%)`,
    border: NEON_FALLBACK.border,
    border2: NEON_FALLBACK.border2,
    panel2: NEON_FALLBACK.panel2,
    text: NEON_FALLBACK.text,
    primarySoft: readCssVar("--neon-primary-soft", NEON_FALLBACK.primarySoft),
    highlightSoft: readCssVar("--neon-highlight-soft", NEON_FALLBACK.highlightSoft),
  };
}

export function useNeonTheme(): NeonTheme {
  const [theme, setTheme] = useState(() => getNeonTheme());
  useEffect(() => {
    setTheme(getNeonTheme());
    const mo = new MutationObserver(() => setTheme(getNeonTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-mode"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}
