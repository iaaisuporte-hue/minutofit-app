/**
 * Grava o Team ID real no AASA (Universal Links).
 *
 *   IOS_TEAM_ID=ABCDE12345 npm run aasa:team-id     grava (idempotente)
 *   npm run aasa:team-id -- --check                  só confere; falha se ainda houver placeholder
 *
 * Depois de gravar: commitar o arquivo e publicar o app web (a Vercel serve o AASA em
 * app.s2core.com.br/.well-known/apple-app-site-association com Content-Type JSON).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { aplicarTeamId, problemasDoAasa } from "./lib/aasaTeamId.mjs";

const ARQUIVO = fileURLToPath(new URL("../public/.well-known/apple-app-site-association", import.meta.url));
const atual = readFileSync(ARQUIVO, "utf8");

if (process.argv.includes("--check")) {
  const problemas = problemasDoAasa(atual);
  if (problemas.length) {
    console.error(`[aasa] NÃO pronto para release:\n  - ${problemas.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("[aasa] ok");
  process.exit(0);
}

const teamId = (process.env.IOS_TEAM_ID ?? "").trim();
if (!teamId) {
  console.error("[aasa] defina IOS_TEAM_ID (10 caracteres, em developer.apple.com/account > Membership).");
  process.exit(1);
}
writeFileSync(ARQUIVO, aplicarTeamId(atual, teamId));
console.log(`[aasa] appID agora é ${teamId}.com.s2core.app`);
