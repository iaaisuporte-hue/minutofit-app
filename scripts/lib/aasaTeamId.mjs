/**
 * Team ID no AASA (Universal Links). Regras puras, testadas sem tocar em arquivo.
 *
 * O Team ID da Apple é 10 caracteres [A-Z0-9] e NÃO é segredo (aparece em qualquer AASA público),
 * mas errar uma letra faz o Universal Link abrir no Safari sem nenhum erro visível — daí a validação
 * e o modo de checagem que reprova o release enquanto o placeholder `TEAMID` existir.
 */
export const TEAM_ID_RE = /^[A-Z0-9]{10}$/;
export const PLACEHOLDER = "TEAMID";
const BUNDLE_ID = "com.s2core.app";

/** @param {string} json conteúdo do AASA @param {string} teamId @returns {string} */
export function aplicarTeamId(json, teamId) {
  if (!TEAM_ID_RE.test(teamId)) throw new Error(`Team ID inválido: esperado 10 caracteres [A-Z0-9], recebido "${teamId}".`);
  const aasa = JSON.parse(json);
  const detalhes = aasa?.applinks?.details;
  if (!Array.isArray(detalhes) || detalhes.length === 0) throw new Error("AASA sem applinks.details.");
  for (const d of detalhes) {
    if (typeof d.appID !== "string" || !d.appID.endsWith(`.${BUNDLE_ID}`)) {
      throw new Error(`appID inesperado: ${d.appID}`);
    }
    d.appID = `${teamId}.${BUNDLE_ID}`;
  }
  return `${JSON.stringify(aasa, null, 2)}\n`;
}

/** @param {string} json @returns {string[]} problemas que impedem usar este AASA num release */
export function problemasDoAasa(json) {
  const problemas = [];
  let aasa;
  try {
    aasa = JSON.parse(json);
  } catch {
    return ["JSON inválido"];
  }
  for (const d of aasa?.applinks?.details ?? []) {
    const [team, ...resto] = String(d.appID).split(".");
    if (team === PLACEHOLDER) problemas.push("appID ainda usa o placeholder TEAMID");
    else if (!TEAM_ID_RE.test(team)) problemas.push(`Team ID inválido no appID: ${team}`);
    if (resto.join(".") !== BUNDLE_ID) problemas.push(`bundle id inesperado: ${resto.join(".")}`);
  }
  return problemas;
}
