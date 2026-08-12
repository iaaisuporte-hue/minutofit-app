import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

// Contrato do banner LGPD na porta de entrada do produto (/login).
//
// O banner é `position: fixed` por cima do cartão de auth. Quando ele cresce, ele
// cobre a ação principal — foi o P0 de 02/ago/2026 (320x568) e voltou em
// 12/ago/2026: 377px de altura a 375x812 cobriam "Entrar" e TODOS os caminhos de
// cadastro ("Criar conta", "Sou personal"). A reserva de rodapé sozinha não
// protege, porque abaixo de 720px `.auth-page` vira `place-items: start center`.
//
// Estes testes prendem as duas invariantes que seguram a altura.
describe("contrato de layout — banner de consentimento", () => {
  const css = read("../styles/cookieConsent.css");
  const tsx = read("../components/CookieConsentBanner.tsx");

  it("o texto longo da LGPD fica num disclosure, não solto no banner", () => {
    expect(tsx).toMatch(/<details className="cookie-consent__details">/);
    expect(tsx).toMatch(/<summary className="cookie-consent__summary">/);
  });

  it("a escolha (checkbox) fica FORA da região que rola", () => {
    // `.cookie-consent__text` é o único bloco com `overflow-y: auto`. Um controle
    // de consentimento que sai da tela não é consentimento — o checkbox precisa
    // ser irmão do bloco de texto, não filho dele.
    const textBlockStart = tsx.indexOf('className="cookie-consent__text"');
    const checkStart = tsx.indexOf('className="cookie-consent__check"');
    const textBlockEnd = tsx.indexOf("</div>", tsx.indexOf("</details>"));

    expect(textBlockStart).toBeGreaterThan(-1);
    expect(checkStart).toBeGreaterThan(-1);
    expect(checkStart).toBeGreaterThan(textBlockEnd);
  });

  it("telas curtas limitam a altura do banner", () => {
    expect(css).toMatch(/@media \(max-height: 640px\)[\s\S]*?max-height:\s*42vh/);
  });

  it("telas curtas escondem o título só visualmente (aria continua apontando)", () => {
    // `aria-labelledby="cookie-consent-title"` depende do h2 existir no DOM.
    expect(tsx).toMatch(/aria-labelledby="cookie-consent-title"/);
    expect(tsx).toMatch(/id="cookie-consent-title"/);
    expect(css).toMatch(/@media \(max-height: 640px\)[\s\S]*?clip-path:\s*inset\(50%\)/);
  });

  it("os dois botões dividem uma linha só no mobile", () => {
    // Quebrar em duas linhas custava ~46px de altura a 360px de largura.
    expect(css).toMatch(/@media \(max-width: 719px\)[\s\S]*?flex-wrap:\s*nowrap/);
  });
});
