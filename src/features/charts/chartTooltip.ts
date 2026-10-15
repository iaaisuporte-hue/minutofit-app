import type { CSSProperties } from "react";

/**
 * Estilo único dos tooltips dos gráficos (recharts). O padrão do recharts é um fundo BRANCO inline com a cor do texto
 * herdada — no tema escuro o texto herdado é claro e o rótulo some (1,1:1). Aqui fundo, rótulo e itens vêm de tokens do
 * tema (≥4,5:1 nos dois). O item usa `--color-text`, não a cor da série: o oliva da linha sobre o fundo claro mede 3,27:1.
 * Só o traço da linha pode manter a cor da série (gráfico, não texto).
 */
export const chartTooltipProps: {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
} = {
  contentStyle: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
    boxShadow: "var(--shadow-sm)",
  },
  labelStyle: { color: "var(--color-text)", fontWeight: 600 },
  itemStyle: { color: "var(--color-text)" },
};
