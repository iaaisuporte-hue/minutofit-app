import type { DoseUnit, SupplementFrequency, SupplementStatus } from "../../../services/supplementsApi";
import { formatNumber } from "../goals/formatGoals";

/** [singular, plural] — unidades de massa/volume não flexionam. */
export const DOSE_UNIT_LABELS: Record<DoseUnit, [string, string]> = {
  g: ["g", "g"],
  mg: ["mg", "mg"],
  mcg: ["mcg", "mcg"],
  ml: ["ml", "ml"],
  ui: ["UI", "UI"],
  capsule: ["cápsula", "cápsulas"],
  tablet: ["comprimido", "comprimidos"],
  scoop: ["scoop", "scoops"],
  drops: ["gota", "gotas"],
  sachet: ["sachê", "sachês"],
  dose: ["dose", "doses"],
};

export const DOSE_UNITS = Object.keys(DOSE_UNIT_LABELS) as DoseUnit[];

export const FREQUENCY_LABELS: Record<SupplementFrequency, string> = {
  daily: "1x ao dia",
  twice_daily: "2x ao dia",
  three_times_daily: "3x ao dia",
  weekly: "Semanal",
  as_needed: "Quando necessário",
  other: "Outra",
};

export const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as SupplementFrequency[];

export const STATUS_LABELS: Record<SupplementStatus, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  ended: "Encerrada",
};

/** "5 g" · "1 cápsula" · "2 cápsulas" · "2.000 UI" */
export function formatDose(amount: number, unit: DoseUnit): string {
  const [one, many] = DOSE_UNIT_LABELS[unit] ?? [unit, unit];
  return `${formatNumber(amount, 2)} ${amount === 1 ? one : many}`;
}

/** "Semanal · seg, qua, sex" — o detalhe livre do nutri complementa o enum. */
export function formatFrequency(frequency: SupplementFrequency, detail: string | null): string {
  const base = FREQUENCY_LABELS[frequency] ?? frequency;
  return detail ? `${base} · ${detail}` : base;
}

/** "2026-10-01" → "01/10/2026" sem passar por Date (sem deslocar fuso). */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatPeriod(start: string | null, end: string | null): string | null {
  if (start && end) return `${formatDateKey(start)} a ${formatDateKey(end)}`;
  if (start) return `Desde ${formatDateKey(start)}`;
  if (end) return `Até ${formatDateKey(end)}`;
  return null;
}

/** "hoje às 12:30" · "ontem às 08:05" · "12/10 às 21:40" */
export function formatTakenAt(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff === 0) return `hoje às ${time}`;
  if (diff === 1) return `ontem às ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${time}`;
}
