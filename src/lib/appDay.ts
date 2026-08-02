/**
 * "Que dia é hoje" na perspectiva do aluno — espelho de `utils/appDay.ts` do backend.
 *
 * O padrão anterior (`new Date().toISOString().slice(0, 10)`) devolve o dia UTC.
 * Em UTC-3 isso joga tudo que acontece entre 21h e 24h para o dia seguinte:
 * o treino de segunda 21h30 virava terça, quebrando streak e heatmap. Cliente e
 * servidor precisam concordar sobre o que é "hoje", então os dois usam o fuso do
 * aluno — e não o relógio da máquina que por acaso executou o código.
 */
export const APP_TIMEZONE = "America/Sao_Paulo";

/** Chave de dia 'YYYY-MM-DD' de um INSTANTE, no fuso do aluno. */
export function dayKey(date: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  // 'en-CA' formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
