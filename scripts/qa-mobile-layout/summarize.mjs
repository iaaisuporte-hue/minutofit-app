#!/usr/bin/env node
/**
 * Resume um report.json do runner: uma linha por célula, achados por tipo.
 *   node scripts/qa-mobile-layout/summarize.mjs <report.json> [--only texto] [--min P2] [--detail]
 */
import { readFileSync } from 'node:fs';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error('uso: summarize.mjs <report.json> [--only texto] [--min P1|P2|P3] [--detail]');
  process.exit(2);
}
const opt = (k) => {
  const i = rest.indexOf(`--${k}`);
  return i > -1 ? rest[i + 1] ?? true : null;
};
const only = opt('only');
const min = { P1: 1, P2: 2, P3: 3 }[opt('min') ?? 'P3'];
const detail = !!opt('detail');
const sev = { P1: 1, P2: 2, P3: 3 };

const { cells } = JSON.parse(readFileSync(file, 'utf8'));
for (const c of cells) {
  if (only && !c.cell.includes(only)) continue;
  if (c.status !== 'ok') {
    console.log(`${c.cell}  [${c.status.toUpperCase()}] ${c.reason ?? ''}`);
    continue;
  }
  const r = c.report;
  const types = Object.entries(r.counts)
    .map(([t, n]) => `${t}×${n}`)
    .join(' ');
  console.log(`${c.cell}${c.routeMismatch ? `  ⚠ → ${c.finalPath}` : ''}  ${types || '(limpo)'}`);
  if (detail) {
    for (const f of r.findings.filter((x) => sev[x.severity] <= min)) {
      const by = f.coveredBy ? ` ← ${f.coveredBy.chrome ?? f.coveredBy.selector}` : '';
      console.log(`    ${f.severity} ${f.type} ${f.selector}${f.text ? ` "${f.text.slice(0, 28)}"` : ''}${f.w ? ` ${f.w}x${f.h}` : ''}${f.hiddenPx ? ` oculto=${f.hiddenPx}px` : ''}${by}`);
    }
  }
}
