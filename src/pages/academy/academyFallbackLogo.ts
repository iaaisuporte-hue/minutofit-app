/**
 * Logos estáticos em `/public/branding/` quando a academia ainda não definiu `logo_url` no branding.
 * Slug normalizado: remove `-` e `_` para detectar variações (ex.: ph-gym, phgym, ph-gym-column).
 */
export function academyFallbackLogoUrl(academySlug: string | null | undefined): string | null {
  const compact = (academySlug ?? "").toLowerCase().replace(/[-_]/g, "");
  if (compact.includes("phgym")) {
    return "/branding/ph-gym-logo.png";
  }
  return null;
}

export type AcademyHeroLogo =
  | { kind: "img"; src: string; layout: "square" | "wide" }
  | { kind: "initials" };

export function resolveAcademyHeroLogo(
  brandingLogoUrl: string | null | undefined,
  academySlug: string | null | undefined,
): AcademyHeroLogo {
  const trimmed = (brandingLogoUrl ?? "").trim();
  if (trimmed) {
    return { kind: "img", src: trimmed, layout: "square" };
  }
  const fallback = academyFallbackLogoUrl(academySlug);
  if (fallback) {
    return { kind: "img", src: fallback, layout: "wide" };
  }
  return { kind: "initials" };
}
