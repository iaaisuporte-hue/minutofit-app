import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Guarda estática do bug achado no QA do CHECKPOINT 10 (Sprint P2A, set/2026).
 *
 * O bug era de PINTURA/STACKING real do browser — `.ws-action-bar`/`.ws-rest`
 * (z-index 1200/1210, fixos no rodapé do Modo Treino) ficavam ACIMA de
 * qualquer folha aberta durante a execução (`.drawer-overlay`, herda
 * `var(--z-modal)` = 200), cobrindo os botões de confirmação renderizados
 * perto do fundo. jsdom não computa layout/paint real (`getBoundingClientRect`
 * e `elementFromPoint` não refletem CSS de verdade), então não há como
 * reproduzir o defeito original num teste deste projeto — ele só apareceu
 * navegando de verdade (Chromium, 390×844) e foi verificado do mesmo jeito
 * (antes: botão "Substituir" e o fallback "Buscar outro exercício" ficavam
 * atrás da barra e intocáveis por toque; depois: alcançáveis).
 *
 * Este teste não prova o comportamento visual — prova que a regra que o
 * corrige continua no arquivo, para um refactor de CSS não apagá-la em
 * silêncio sem ninguém notar até o próximo QA manual.
 */
describe("workoutSession.css — folhas do Modo Treino acima da action-bar", () => {
  it("eleva o overlay das folhas conhecidas acima de .ws-action-bar/.ws-rest (1210)", () => {
    const css = readFileSync(resolve(here, "./workoutSession.css"), "utf-8");

    const rule = /\.drawer-overlay:has\(\.ws-sub-sheet\)[\s\S]*?\{\s*z-index:\s*(\d+);\s*\}/;
    const match = css.match(rule);

    expect(match, "regra .drawer-overlay:has(.ws-sub-sheet) não encontrada em workoutSession.css").not.toBeNull();
    const zIndex = Number(match![1]);
    expect(zIndex).toBeGreaterThan(1210);

    // As demais folhas abertas durante a execução (sugestões P2A, gestão de
    // exercícios e histórico) precisam estar no MESMO seletor combinado —
    // senão uma delas volta a ficar atrás da barra sozinha.
    for (const cls of [".ws-rsug-sheet", ".fw-manage", ".fw-sheet", ".ehs"]) {
      const selectorPresent = new RegExp(
        `\\.drawer-overlay:has\\(${cls.replace(".", "\\.")}\\)[^{]*\\{`,
      ).test(css) || new RegExp(`:has\\(${cls.replace(".", "\\.")}\\)\\s*,?`).test(css);
      expect(selectorPresent, `.drawer-overlay:has(${cls}) ausente da regra combinada`).toBe(true);
    }
  });
});
