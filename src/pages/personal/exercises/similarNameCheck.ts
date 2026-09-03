/**
 * D11 (harness da Sprint P1): aviso NÃO-bloqueante quando o nome digitado no
 * formulário se parece com um exercício do catálogo GLOBAL S2CORE.
 *
 * Deliberadamente simples — sem fuzzy matching: normaliza (minúsculo, sem
 * acento, espaços colapsados) e compara por igualdade ou substring nos dois
 * sentidos. "Supino reto" acha "Supino Reto com Barra" e vice-versa; não
 * pretende achar erro de digitação ("Supnio"). Isso é aviso, não bloqueio —
 * o backend é quem bloqueia de verdade (409 `DUPLICATE_NAME`, só dentro da
 * PRÓPRIA biblioteca).
 */

export function normalizeForSimilarityCheck(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks (acentos) pós-NFD
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export interface SimilarNameCandidate {
  id: string;
  name: string;
}

/**
 * Devolve o primeiro exercício do catálogo global cujo nome normalizado
 * colide (igual ou substring) com o nome digitado, ou `null` se nenhum bate.
 * Nomes muito curtos (<3 chars normalizados) não disparam aviso — substring
 * de 1-2 letras combina com quase tudo e o aviso vira ruído.
 */
export function findSimilarExerciseName(
  typedName: string,
  candidates: SimilarNameCandidate[],
): SimilarNameCandidate | null {
  const typed = normalizeForSimilarityCheck(typedName);
  if (typed.length < 3) return null;

  for (const candidate of candidates) {
    const normalized = normalizeForSimilarityCheck(candidate.name);
    if (!normalized) continue;
    if (normalized === typed || normalized.includes(typed) || typed.includes(normalized)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Termo enviado a `GET /api/exercises?q=` para buscar candidatos do D11.
 *
 * Bug real (QA, sprint P1): o backend filtra com
 * `normalized_name ILIKE '%q%'` — exige que o NOME DO CATÁLOGO contenha o
 * texto buscado, nunca o contrário. Mandar o nome digitado inteiro como `q`
 * só encontra candidato quando o texto digitado é curto/igual a um nome do
 * catálogo; o caso canônico da própria spec — digitar algo MAIOR que já
 * contém um nome do catálogo, ex. "Supino Reto Personalizado" quando existe
 * "Supino Reto" — nunca bate, porque "Supino Reto" não contém a frase
 * inteira digitada.
 *
 * A primeira palavra do nome digitado resolve a maior parte dos casos reais
 * sem varrer o catálogo inteiro (não dá pra fazer a comparação bidirecional
 * inteira no servidor, porque ele não sabe de antemão qual lado vai conter
 * o outro): tanto "Supino Reto Personalizado" quanto "Supino Reto" trazem
 * candidatos que contêm "Supino", e `findSimilarExerciseName` decide se
 * bate de verdade nos dois sentidos. Se a primeira palavra for curta demais
 * pra ser um termo de busca útil (<3 chars — ex. "De Pé Reto"), cai de volta
 * pro nome digitado inteiro em vez de arriscar um `ILIKE '%de%'` genérico.
 */
export function buildSimilarityCheckQuery(typedName: string): string {
  const trimmed = typedName.trim();
  const firstWord = trimmed.split(/\s+/)[0] ?? "";
  return firstWord.length >= 3 ? firstWord : trimmed;
}
