import { describe, expect, it } from "vitest";
import {
  encontrarReferenciasLocais,
  validarApiDeDistribuicao,
} from "../../scripts/lib/nativeBuildGuard.mjs";

describe("validarApiDeDistribuicao", () => {
  it("aceita https de host público e tira a barra final", () => {
    expect(validarApiDeDistribuicao("https://api.s2core.com.br/api/")).toEqual({
      ok: true,
      url: "https://api.s2core.com.br/api",
    });
  });

  it("apara espaço e quebra de linha (a variável da Vercel chegou com \\n)", () => {
    expect(validarApiDeDistribuicao("https://api.s2core.com.br/api\n")).toMatchObject({ ok: true });
  });

  it.each([undefined, "", "   "])("recusa ausente (%j)", (raw) => {
    expect(validarApiDeDistribuicao(raw)).toMatchObject({ ok: false });
  });

  it("recusa a URL de desenvolvimento que já vazou para o bundle iOS", () => {
    expect(validarApiDeDistribuicao("http://localhost:3000/api")).toMatchObject({ ok: false });
  });

  it.each([
    "https://localhost:3000/api",
    "https://127.0.0.1/api",
    "https://10.0.2.2:3000/api",
    "https://192.168.0.10/api",
    "https://172.20.1.5/api",
    "https://minha-maquina.local/api",
  ])("recusa host local mesmo com https (%s)", (raw) => {
    expect(validarApiDeDistribuicao(raw)).toMatchObject({ ok: false });
  });

  it("recusa http em host público", () => {
    expect(validarApiDeDistribuicao("http://api.s2core.com.br/api")).toMatchObject({ ok: false });
  });

  it("recusa texto que não é URL", () => {
    expect(validarApiDeDistribuicao("api.s2core.com.br")).toMatchObject({ ok: false });
  });
});

describe("encontrarReferenciasLocais", () => {
  it("acha a constante que estava embutida no bundle iOS", () => {
    const trecho = 'const ug=`http://localhost:3000/api`.trim(),R=ug||`${window.location.origin}/api`';
    expect(encontrarReferenciasLocais(trecho)).toEqual(["http://localhost:3000"]);
  });

  it("acha /api local sem porta e o alias do emulador Android", () => {
    expect(encontrarReferenciasLocais('"http://localhost/api" "http://10.0.2.2:3000"')).toEqual(
      expect.arrayContaining(["http://localhost/api", "http://10.0.2.2:3000"]),
    );
  });

  it("acha IP de rede local embutido em código (mesmas faixas recusadas na variável)", () => {
    expect(
      encontrarReferenciasLocais('"http://192.168.0.5:3000/api" "http://172.20.1.1/api" "https://10.1.2.3:8443"'),
    ).toEqual(expect.arrayContaining(["http://192.168.0.5:3000", "http://172.20.1.1/api", "https://10.1.2.3:8443"]));
  });

  it("não acusa o 'localhost' legítimo de um bundle de produção", () => {
    // Trechos reais de um build de produção correto (16/10/2026).
    const legitimo =
      '"assets","mail","dev","staging","test","localhost"]),$m="academy-branding";' +
      'function gt(e,t=!1){let n="http://localhost";typeof window<"u"&&(n=window.location.origin)}' +
      'const api="https://api.s2core.com.br/api"';
    expect(encontrarReferenciasLocais(legitimo)).toEqual([]);
  });
});
