import { describe, expect, it } from "vitest";
import { aplicarTeamId, problemasDoAasa } from "../../scripts/lib/aasaTeamId.mjs";

const base = JSON.stringify({ applinks: { details: [{ appID: "TEAMID.com.s2core.app", paths: ["/invite/*"] }] } });

describe("Team ID no AASA", () => {
  it("troca o placeholder pelo Team ID e preserva os caminhos", () => {
    const out = JSON.parse(aplicarTeamId(base, "ABCDE12345"));
    expect(out.applinks.details[0]).toEqual({ appID: "ABCDE12345.com.s2core.app", paths: ["/invite/*"] });
  });

  it("é idempotente e permite corrigir um Team ID gravado errado", () => {
    const uma = aplicarTeamId(base, "ABCDE12345");
    expect(aplicarTeamId(uma, "ABCDE12345")).toBe(uma);
    expect(JSON.parse(aplicarTeamId(uma, "ZZZZZ99999")).applinks.details[0].appID).toBe("ZZZZZ99999.com.s2core.app");
  });

  it.each(["", "abcde12345", "ABCDE1234", "ABCDE123456", "ABCDE-2345", "TEAMID"])("recusa Team ID inválido (%j)", (id) => {
    expect(() => aplicarTeamId(base, id)).toThrow(/Team ID inválido/);
  });

  it("não aceita AASA de outro bundle", () => {
    const outro = JSON.stringify({ applinks: { details: [{ appID: "TEAMID.com.outro.app", paths: [] }] } });
    expect(() => aplicarTeamId(outro, "ABCDE12345")).toThrow(/appID inesperado/);
  });

  it("o portão de release reprova o placeholder e aprova o Team ID válido", () => {
    expect(problemasDoAasa(base)).toEqual(["appID ainda usa o placeholder TEAMID"]);
    expect(problemasDoAasa(aplicarTeamId(base, "ABCDE12345"))).toEqual([]);
    expect(problemasDoAasa("{")).toEqual(["JSON inválido"]);
  });
});
