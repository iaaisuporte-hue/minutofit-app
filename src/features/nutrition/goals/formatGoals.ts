/**
 * Formatação das metas diárias (Spec 039). Pura — só apresentação; limites
 * e validação vivem no backend (`parseNutritionGoalsInput`), nunca aqui.
 */

const nf = (maxFractionDigits: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: maxFractionDigits });

/** "2.300" · "150" · "2,5" */
export function formatNumber(value: number, maxFractionDigits = 1): string {
  return nf(maxFractionDigits).format(value);
}

/**
 * Faixa com en dash: "150–170". Valor único (sem máximo) mostra só o
 * mínimo — é assim que o nutri prescreve "pelo menos X". `null` = sem meta.
 */
export function formatRange(min: number | null, max: number | null, maxFractionDigits = 1): string | null {
  if (min == null) return null;
  if (max == null || max === min) return formatNumber(min, maxFractionDigits);
  return `${formatNumber(min, maxFractionDigits)}–${formatNumber(max, maxFractionDigits)}`;
}

export function mlToLiters(ml: number | null): number | null {
  return ml == null ? null : Math.round(ml / 10) / 100;
}

export function litersToMl(liters: number | null): number | null {
  return liters == null ? null : Math.round(liters * 1000);
}

/**
 * Lê um campo numérico digitado em PT-BR ("2,5", "2.300", " 150 ").
 * Vazio → null (sem meta). Texto que não é número → NaN, para o editor
 * apontar o erro em vez de gravar algo diferente do que foi digitado.
 */
export function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // "2.300" (milhar) → 2300; "2,5" → 2.5. Ponto seguido de exatamente 3
  // dígitos no fim é separador de milhar; senão é decimal ("2.5").
  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

/** Valor do input a partir do número salvo: 2.5 → "2,5". */
export function toInputValue(value: number | null): string {
  return value == null ? '' : String(value).replace('.', ',');
}
