/** @type {import('tailwindcss').Config} */
export default {
  // Scoped only to tracker files to keep bundle minimal
  content: [
    "./src/pages/user/ActivityTrackerPage.tsx",
    "./src/pages/user/activityTracker.tailwind.css",
  ],
  prefix: "tw-",
  corePlugins: {
    // Disable global reset — avoid conflicts with existing globals.css
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Semantic design tokens (Apple Fitness redesign)
        ink:         "#111827",
        "ink-muted": "#6B7280",
        "ink-subtle":"#9CA3AF",
        divider:     "#F3F4F6",
        canvas:      "#FAFAFA",
        brand:       "#16A34A",
        "brand-light":"#22C55E",
        // Ring chart data colors
        "ring-energy":  "#16A34A",
        "ring-recover": "#F59E0B",
        "ring-ready":   "#3B82F6",
        // Legacy tokens kept for compatibility
        primary:     "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-soft":  "var(--color-primary-soft)",
        "primary-soft-strong": "var(--color-primary-soft-strong)",
        accent:      "var(--color-accent)",
        "accent-soft": "var(--color-accent-soft)",
        "accent-border": "var(--color-accent-border)",
        surface:     "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        "surface-subtle": "var(--color-surface-subtle)",
        text:        "var(--color-text)",
        muted:       "var(--color-text-muted)",
        subtle:      "var(--color-text-subtle)",
        border:      "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        danger:      "var(--color-danger)",
        "danger-soft": "var(--color-danger-soft)",
        "danger-border": "var(--color-danger-border)",
        warn:        "var(--color-warn)",
        "warn-soft": "var(--color-warn-soft)",
        "warn-border": "var(--color-warn-border)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)",
        "card-lg": "0 4px 8px rgba(0,0,0,0.04), 0 12px 28px rgba(0,0,0,0.05)",
        accent: "0 4px 20px rgba(6,182,212,0.18)",
      },
    },
  },
  plugins: [],
};
