import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

// A7 (chat do aluno): o cartão precisa de ALTURA controlada no shell mobile e a faixa das mensagens precisa
// poder encolher; com `min-height` + `1fr` puro o compositor ia parar no fim do documento.
describe("chat do aluno — contrato de layout (A7)", () => {
  const tsx = read("../pages/user/UserMessagesPage.tsx");
  const css = read("../pages/user/userMessages.css");

  it("a faixa das mensagens usa minmax(0, 1fr) para poder rolar por dentro", () => {
    expect(tsx).toMatch(/gridTemplateRows:\s*"auto minmax\(0, 1fr\) auto"/);
    expect(tsx).not.toMatch(/gridTemplateRows:\s*"auto 1fr auto"/);
  });

  it("no shell mobile o cartão tem height (não só min-height) com as reservas medidas", () => {
    expect(css).toMatch(/@media \(max-width: 980px\)\s*\{[\s\S]*?\.um-chat-card\s*\{[\s\S]*?height:\s*calc\(100dvh[^;]*--bottom-nav-h[^;]*--mini-player-h[^;]*--cookie-consent-h/);
  });

  it("o auto-scroll da conversa não puxa a janela inteira (block: nearest)", () => {
    expect(tsx).toMatch(/scrollIntoView\(\{ behavior: "smooth", block: "nearest" \}\)/);
  });
});
