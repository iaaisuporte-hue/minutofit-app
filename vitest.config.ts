import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Runner de testes (regressão de features maduras — ver docs/MATURE_FEATURES.md).
// Separado do vite.config para não afetar o build de produção.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
