#!/usr/bin/env node
/**
 * Reclassifica um report.json e grava baseline.json ao lado.
 *   node scripts/qa-mobile-layout/classify-cli.mjs <report.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classify } from './classify.mjs';

export function writeBaseline(reportFile) {
  const payload = JSON.parse(readFileSync(reportFile, 'utf8'));
  const result = classify(payload.cells, payload.meta);
  const out = path.join(path.dirname(reportFile), 'baseline.json');
  writeFileSync(out, JSON.stringify({ meta: payload.meta, ...result }, null, 1));
  return { out, result };
}

export function printTable(result) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${pad('ID', 5)}${pad('Sev', 5)}${pad('Status', 14)}${pad('Exec/Esp', 10)}${pad('Hits', 6)}Viewports afetados`);
  for (const i of result.issues) {
    console.log(`${pad(i.id, 5)}${pad(i.severity, 5)}${pad(i.status, 14)}${pad(`${i.executedCells}/${i.expectedCells}`, 10)}${pad(i.hitCells, 6)}${i.viewportsAffected.join(',')}${i.blockedReasons.length ? `  [bloq: ${i.blockedReasons[0].slice(0, 60)}]` : ''}`);
  }
  console.log(`\nNEW: ${result.newFindings.length} agrupamentos (P1: ${result.newFindings.filter((n) => n.severity === 'P1').length}, P2: ${result.newFindings.filter((n) => n.severity === 'P2').length})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = process.argv[2];
  if (!f) {
    console.error('uso: classify-cli.mjs <report.json>');
    process.exit(2);
  }
  const { out, result } = writeBaseline(f);
  printTable(result);
  console.log(`\nbaseline: ${out}`);
}
