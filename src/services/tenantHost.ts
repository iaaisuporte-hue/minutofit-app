/**
 * FE-1.7.1 — Tenant host resolver & branding applier.
 *
 * Extracts the academy slug from the current hostname,
 * fetches public branding from GET /auth/branding,
 * and injects a whitelisted set of CSS variables into the DOM.
 *
 * Security note: only a fixed whitelist of CSS tokens is ever injected.
 * Semantic tokens (error, warning, text, bg) are never overridden.
 */

import { API_URL } from './apiBase';

const SUBDOMAIN_REGEX = /^([a-z0-9][a-z0-9-]{1,61}[a-z0-9])\.minutofit\.com\.br$/i;
const RESERVED = new Set(['app', 'www', 'api', 'admin', 'cdn', 'static', 'assets', 'mail', 'dev', 'staging', 'test', 'localhost']);
const STYLE_ELEMENT_ID = 'academy-branding';

export interface AcademyBrandingPublic {
  displayName?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primaryColor?: string | null;
  primaryHover?: string | null;
  primarySoft?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  ctaTextColor?: string | null;
  welcomeMessage?: string | null;
}

/** Returns the academy slug from the hostname, or null if not a tenant subdomain. */
export function extractTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  const match = SUBDOMAIN_REGEX.exec(host);
  if (!match) return null;
  const slug = match[1].toLowerCase();
  if (RESERVED.has(slug)) return null;
  return slug;
}

/** Fetches branding from the backend. Returns null on 204 (no tenant) or network error. */
export async function fetchBranding(): Promise<AcademyBrandingPublic | null> {
  const slug = extractTenantSlug();
  if (!slug) return null;
  try {
    const res = await fetch(`${API_URL}/auth/branding`, {
      credentials: 'omit',
      headers: { 'X-Tenant-Host': window.location.hostname },
    });
    if (res.status === 204) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data?.branding as AcademyBrandingPublic) ?? null;
  } catch {
    return null;
  }
}

/**
 * Injects a <style id="academy-branding"> element with the whitelisted
 * CSS variable overrides. Safe to call multiple times (replaces existing element).
 */
export function applyBranding(branding: AcademyBrandingPublic | null): void {
  if (typeof document === 'undefined') return;

  // Remove existing element
  removeBranding();

  if (!branding) return;

  const vars: string[] = [];

  function add(token: string, value: string | null | undefined) {
    if (!value) return;
    // Validate hex colours before injecting
    if (value.startsWith('#') && !/^#[0-9a-fA-F]{6,8}$/.test(value)) return;
    vars.push(`  ${token}: ${value};`);
  }

  add('--color-primary',       branding.primaryColor);
  add('--color-primary-hover', branding.primaryHover);
  add('--color-primary-soft',  branding.primarySoft);
  add('--color-secondary',     branding.secondaryColor);
  add('--color-accent',        branding.accentColor);
  add('--color-cta-text',      branding.ctaTextColor);

  if (vars.length === 0) return;

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `:root {\n${vars.join('\n')}\n}`;
  document.head.appendChild(style);

  // Mark <html> for debugging / testing (T24)
  document.documentElement.setAttribute('data-academy-branding', 'applied');
}

/** Removes injected branding and resets the data attribute. */
export function removeBranding(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(STYLE_ELEMENT_ID);
  if (el) el.remove();
  document.documentElement.removeAttribute('data-academy-branding');
}
