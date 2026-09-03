import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Guarda estática do bug achado no QA da Sprint P2B (CHECKPOINT 10, set/2026):
 * `.pp-btn:hover` (classe + pseudo-classe) tem mais especificidade que
 * `.pp-btn--primary` (só classe) e sobrescrevia o fundo para
 * `var(--color-surface)` (branco no tema claro) sem tocar `color` — o botão
 * primário ficava com texto branco sobre fundo branco ao passar o mouse.
 * Reproduzido de verdade no fluxo de revisão assistida
 * (`PlanReviewModal.tsx`): ao avançar de `choice` para `confirm`, o botão
 * "Confirmar substituição" nasce exatamente na posição do botão anterior
 * ("Substituir na ficha"), então o cursor já está em cima dele — o usuário
 * via um botão em branco, sem precisar mover o mouse.
 *
 * jsdom não computa cascata real de CSS carregado por `<link>`/import (não há
 * paint), então não dá para reproduzir aqui o defeito visual em si — só travar
 * a regra que o corrige, mesmo padrão de
 * `workoutSession/actionBarOverlayZIndex.test.ts` (P2A).
 */
describe("personalPremium.css — `.pp-btn--primary` não fica invisível no hover", () => {
  it("declara `.pp-btn--primary:hover` com fundo de token de ação e texto branco", () => {
    const css = readFileSync(resolve(here, "./personalPremium.css"), "utf-8");

    const rule = /\.pp-btn--primary:hover\s*\{([^}]*)\}/;
    const match = css.match(rule);
    expect(match, ".pp-btn--primary:hover ausente de personalPremium.css").not.toBeNull();

    const body = match![1];
    // Não pode voltar a herdar `var(--color-surface)` do `.pp-btn:hover`
    // genérico — teria que ser um token de AÇÃO (--action-primary*), nunca a
    // superfície neutra que causou o bug.
    expect(body).toMatch(/background:\s*var\(--action-primary/);
    expect(body).toMatch(/color:\s*#fff/);
  });
});
