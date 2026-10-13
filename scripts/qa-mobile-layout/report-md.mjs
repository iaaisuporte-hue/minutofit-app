#!/usr/bin/env node
/**
 * Gera o relatório em Markdown a partir de um diretório de execução (report.json + baseline.json).
 *   node scripts/qa-mobile-layout/report-md.mjs <dir-da-execucao> > relatorio.md
 * As tabelas vêm dos DADOS (nada digitado à mão); a narrativa fica por conta de quem escreve o relatório.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('uso: report-md.mjs <dir-da-execucao>');
  process.exit(2);
}
const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8'));
const base = JSON.parse(readFileSync(path.join(dir, 'baseline.json'), 'utf8'));
const cells = report.cells;
const VPS = ['320x568', '360x740', '375x667', '390x844', '412x915', '430x932', '844x390', '932x430', '768x1024'];
const ROLE = { public: 'Público', student: 'Aluno', personal: 'Personal', nutri: 'Nutri' };
const short = (o, n = 190) => {
  const t = JSON.stringify(o ?? {}).replace(/[{}"]/g, '').replace(/,/g, ', ');
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const out = [];
const p = (s = '') => out.push(s);

// ── Execução ──
const ok = cells.filter((c) => c.status === 'ok').length;
const blocked = cells.filter((c) => c.status === 'blocked');
const err = cells.filter((c) => c.status === 'error').length;
p('## Execução');
p();
p(`- Navegador: Chromium ${report.meta.browser} · playwright-core ${report.meta.playwrightCore}`);
p(`- Início/fim: ${report.meta.startedAt} → ${report.meta.finishedAt}`);
p(`- Células: **${cells.length}** (executadas ${ok} · bloqueadas ${blocked.length} · erro ${err})`);
p(`- Controle de arrasto por toque (CDP): ${report.meta.touchDragControl ? '`dragstart` dispara' : '**`dragstart` NÃO dispara** — o P1 fica com ressalva'}`);
p(`- Escritas na API interceptadas (a matriz não grava no banco): ${Object.entries(report.meta.stubbedWrites ?? {}).map(([w, n]) => `${w} ×${n}`).join(', ') || 'nenhuma'}`);
p(`- Hosts externos bloqueados pela política hermética: ${Object.entries(report.meta.blockedExternalHosts ?? {}).map(([h, n]) => `${h} (${n})`).join(', ') || 'nenhum'}`);
p();

// ── Cobertura ──
p('## Cobertura (células executadas por perfil × estado × viewport)');
p();
p(`| Perfil | Estado | ${VPS.join(' | ')} | Total | Bloq. |`);
p(`|---|---|${VPS.map(() => '---:').join('|')}|---:|---:|`);
const groups = new Map();
for (const c of cells) {
  const st = c.state.startsWith('overlay:') ? 'overlay' : c.state;
  const k = `${c.role}|${st}`;
  const g = groups.get(k) ?? { role: c.role, state: st, per: Object.fromEntries(VPS.map((v) => [v, 0])), total: 0, blocked: 0 };
  if (c.status === 'ok') {
    g.per[c.viewport]++;
    g.total++;
  } else g.blocked++;
  groups.set(k, g);
}
const order = ['public', 'student', 'personal', 'nutri'];
const sOrder = ['default', 'cookie', 'workout-active', 'offline', 'safe-area', 'keyboard', 'overlay'];
for (const g of [...groups.values()].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || sOrder.indexOf(a.state) - sOrder.indexOf(b.state))) {
  p(`| ${ROLE[g.role]} | ${g.state} | ${VPS.map((v) => g.per[v] || '·').join(' | ')} | ${g.total} | ${g.blocked || '·'} |`);
}
p();
if (blocked.length) {
  p('Células bloqueadas:');
  for (const b of blocked.slice(0, 20)) p(`- \`${b.cell}\` — ${b.reason}`);
  p();
}

// ── Achados originais ──
p('## Achados originais');
p();
p('| ID | Sev. | Status | Células (exec/esp.) | Viewports afetados | Evidência |');
p('|---|---|---|---|---|---|');
for (const i of base.issues) {
  const ev = i.evidence[0];
  const evTxt = ev ? `\`${ev.cell}\` ${short(ev.detail, 150)}` : i.blockedReasons[0] ? `bloqueio: ${i.blockedReasons[0].slice(0, 110)}` : '—';
  p(`| ${i.id} | ${i.severity} | **${i.status}** | ${i.executedCells}/${i.expectedCells} | ${i.viewportsAffected.join(', ') || '—'} | ${evTxt.replace(/\|/g, '/')} |`);
}
p();
p('### Detalhe por achado');
p();
for (const i of base.issues) {
  p(`#### ${i.id} — ${i.title}`);
  p(`- **${i.status}** · severidade original ${i.severity} · executadas ${i.executedCells}/${i.expectedCells}${i.notApplicableCells ? ` · não aplicáveis ${i.notApplicableCells}` : ''}${i.blockedCells ? ` · bloqueadas ${i.blockedCells}` : ''}`);
  if (i.parts) for (const pt of i.parts) p(`  - parte "${pt.part}": **${pt.status}** (${pt.executed}/${pt.expected} exec.${pt.notApplicable ? `, ${pt.notApplicable} n/a` : ''}${pt.blocked ? `, ${pt.blocked} bloq.` : ''}; reproduziu em ${pt.hits})`);
  if (i.limitation) p(`- Limitação: ${i.limitation}`);
  if (i.controls) p(`- Controle: ${i.controls.ran} célula(s) onde NÃO deveria ocorrer${i.controls.alsoHit.length ? ` — **acusou em ${i.controls.alsoHit.join(', ')}**` : ' — nenhuma acusou'}`);
  for (const e of i.evidence.slice(0, 3)) {
    p(`- Evidência \`${e.cell}\`${e.part ? ` (${e.part})` : ''}: ${short(e.detail, 260)}${e.screenshot ? ` · captura \`${e.screenshot}\`` : ''}${e.evidenceFiles?.length ? ` · anotada \`${e.evidenceFiles[0]}\`` : ''}`);
  }
  if (i.status === 'REFUTADO' && i.clearExample) p(`- Refutação: executado em ${i.executedCells} célula(s), sem reprodução. Ex.: ${i.clearExample.map((c) => `\`${c.cell}\` ${short(c.detail, 120)}`).join(' · ')}`);
  if (i.status === 'PARCIAL' && i.notReproducedIn?.length) p(`- Não reproduziu em: ${i.notReproducedIn.slice(0, 8).map((c) => `\`${c}\``).join(', ')}${i.notReproducedIn.length > 8 ? '…' : ''}`);
  if (i.blockedReasons.length && i.status !== 'CONFIRMADO') p(`- Bloqueio/pendência: ${i.blockedReasons.join(' | ').slice(0, 260)}`);
  p();
}

// ── Descobertas novas ──
p('## Descobertas novas (não previstas no relatório de 12/10)');
p();
p('Agrupadas por componente/seletor; severidade herdada do detector. `vp` = quantidade de viewports em que apareceu.');
p();
p('| ID | Sev. | Tipo | Elemento | Onde | vp | Detalhe |');
p('|---|---|---|---|---|---:|---|');
for (const n of base.newFindings.slice(0, 40)) {
  const el = (n.texts?.[0] ?? n.text ?? '').slice(0, 30);
  p(`| ${n.id} | ${n.severity} | ${n.type} | \`${n.selector.slice(0, 54)}\`${el ? ` "${el}"` : ''} | ${n.scenarios.slice(0, 2).join(', ')} | ${n.viewports.length} | ${short(n.detail, 70)} |`);
}
if (base.newFindings.length > 40) p(`\n_(+${base.newFindings.length - 40} agrupamentos no \`baseline.json\`)_`);
p();
console.log(out.join('\n'));
