import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import type { AcademyBranding } from "../services/authApi";

const ALLOWED_TOKENS: Array<keyof AcademyBranding> = [
  "primaryColor",
  "primaryHover",
  "accentColor",
];

const TOKEN_CSS_VAR: Record<string, string> = {
  primaryColor: "--color-primary",
  primaryHover: "--color-primary-hover",
  accentColor: "--color-accent",
};

const STYLE_ELEMENT_ID = "academy-branding-override";

/**
 * Injeta tokens de branding da academia ativa via <style> controlado.
 * Apenas tokens da whitelist são aplicados — nenhum CSS arbitrário é aceito.
 * Limpa os tokens ao desmontar ou quando a academia muda.
 */
export function useAcademyBranding(): void {
  const { branding, activeAcademyId } = useAuth();
  const prevAcademyId = useRef<number | null | undefined>(null);

  useEffect(() => {
    const styleEl = getOrCreateStyleEl();

    if (!branding || !activeAcademyId) {
      styleEl.textContent = "";
      document.documentElement.removeAttribute("data-academy");
      prevAcademyId.current = activeAcademyId;
      return;
    }

    if (prevAcademyId.current !== activeAcademyId) {
      // Academia changed — clear first
      styleEl.textContent = "";
      document.documentElement.removeAttribute("data-academy");
    }

    const overrides = buildCssOverrides(branding);
    if (overrides) {
      styleEl.textContent = overrides;
    }

    prevAcademyId.current = activeAcademyId;

    return () => {
      // Only clean up if component unmounts (user logout)
      styleEl.textContent = "";
      document.documentElement.removeAttribute("data-academy");
    };
  }, [branding, activeAcademyId]);
}

function getOrCreateStyleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ELEMENT_ID;
    document.head.appendChild(el);
  }
  return el;
}

function buildCssOverrides(branding: AcademyBranding): string {
  const vars: string[] = [];

  for (const key of ALLOWED_TOKENS) {
    const value = branding[key];
    if (!value || typeof value !== "string") continue;
    if (!isValidHex(value)) continue;
    const cssVar = TOKEN_CSS_VAR[key];
    if (cssVar) {
      vars.push(`  ${cssVar}: ${value};`);
    }
  }

  if (vars.length === 0) return "";

  return `:root {\n${vars.join("\n")}\n}`;
}

function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
