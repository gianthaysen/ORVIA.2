#!/usr/bin/env node
/* ============================================================================
   GM7 · collision_scan.mjs — Regressionsscan gegen globale Namenskollisionen.

   Erkennt exakt die Fehlerklasse, die den Aktivitäten-Tab schwarz machte:
   Datei A weist `name = function(){…}` zu (oder deklariert `function name`),
   eine SPÄTER geladene Datei B deklariert `function name(){…}` erneut auf
   Top-Level und überschreibt damit das globale Binding per Hoisting.

   Der Scan liest die ECHTE Script-Ladereihenfolge aus index.html (keine
   Fixture-Liste) und schlägt fehl, wenn eine Deklaration eine frühere
   Zuweisung/Deklaration aus einer ANDEREN Datei überschreibt und das Paar
   nicht in der Allowlist steht. renderAkt darf hier NIE wieder auftauchen.

   Aufruf:  node tools/collision_scan.mjs        (Exit 0 = grün)
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');

/* Bekannte, geprüfte Selbst- oder Altlast-Paare (Stand GM7-Audit). Jedes Paar ist
   dokumentiert; NEUE Einträge nur mit Begründung. Ziel: Liste schrumpft. */
const ALLOWLIST = new Set([
  // beabsichtigte Überschreibungen INNERHALB einer Datei werden ohnehin nicht gemeldet;
  // dateiübergreifende, geprüft harmlose Altlasten:
  'sparkline::js/orvia-charts.js->js/gm-icons.js', // GM4-Audit: gm-icons gewinnt absichtlich (später geladen); orvia-charts exportiert zusätzlich ORVIA.charts.sparkline
  'renderModules::js/issues.js->js/ui.js', // beabsichtigt: kanonischer GM-Renderer (ui.js, später geladen) ersetzt Legacy; Abbau des issues.js-Pfads = eigener Schritt
  'oModal::js/orvia-pro.js->js/ui.js',     // beabsichtigt: ui.js-Version ist der produktive Modal-Helfer; orvia-pro-Altpfad wird nicht mehr erreicht
]);

function scriptOrder() {
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const out = [];
  for (const m of html.matchAll(/<script\s+src="(js\/[^"]+)"><\/script>/g)) out.push(m[1]);
  if (!out.length) throw new Error('Keine lokalen Scripts in index.html gefunden');
  return out;
}

/* Top-Level-Erkennung über Klammertiefe (Heuristik, bewusst konservativ):
   nur Zeilen mit Tiefe 0 zählen. Strings/Kommentare werden grob entfernt. */
function topLevelDefs(src) {
  const decls = [], assigns = [];
  let depth = 0, line = 1;
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
    .replace(/'(?:[^'\\\n]|\\.)*'/g, s => "'" + ' '.repeat(s.length - 2) + "'")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, s => '"' + ' '.repeat(s.length - 2) + '"')
    .replace(/`(?:[^`\\]|\\.)*`/g, s => '`' + ' '.repeat(s.length - 2) + '`');
  const lines = clean.split('\n');
  for (const ln of lines) {
    if (depth === 0) {
      let m = ln.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
      if (m) decls.push({ name: m[1], line });
      m = ln.match(/^\s*(?:var\s+|let\s+|const\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/);
      if (m && !['window', 'module', 'exports'].includes(m[1])) assigns.push({ name: m[1], line });
    }
    for (const ch of ln) {
      if (ch === '{' || ch === '(' ) depth++;
      else if (ch === '}' || ch === ')') depth = Math.max(0, depth - 1);
    }
    line++;
  }
  return { decls, assigns };
}

const order = scriptOrder();
const firstDef = new Map(); // name -> {file, kind, line}
const broken = [];

for (const rel of order) {
  let src;
  try { src = readFileSync(join(APP, rel), 'utf8'); } catch { continue; }
  const { decls, assigns } = topLevelDefs(src);
  for (const a of assigns) {
    if (!firstDef.has(a.name)) firstDef.set(a.name, { file: rel, kind: 'assign', line: a.line });
  }
  for (const d of decls) {
    const prev = firstDef.get(d.name);
    if (prev && prev.file !== rel) {
      const key = `${d.name}::${prev.file}->${rel}`;
      if (!ALLOWLIST.has(key)) {
        broken.push({ name: d.name, first: prev, shadow: { file: rel, line: d.line }, key });
      }
    }
    if (!prev) firstDef.set(d.name, { file: rel, kind: 'decl', line: d.line });
  }
}

/* Zusätzliche harte Regel: renderAkt darf nur EINE Top-Level-Definition haben
   (Wrapper in ui.js). Eine zweite Deklaration irgendwo = sofort rot. */
let renderAktDecls = 0;
for (const rel of order) {
  let src; try { src = readFileSync(join(APP, rel), 'utf8'); } catch { continue; }
  renderAktDecls += (src.match(/^function\s+renderAkt\s*\(/mg) || []).length;
}

let fail = false;
if (broken.length) {
  fail = true;
  console.error('KOLLISION: spätere function-Deklaration überschreibt frühere Definition einer anderen Datei:');
  for (const b of broken) {
    console.error(`  ${b.name}: ${b.first.file}:${b.first.line} (${b.first.kind}) <- überschrieben von ${b.shadow.file}:${b.shadow.line}`);
    console.error(`    (falls geprüft harmlos: Allowlist-Key "${b.key}")`);
  }
}
if (renderAktDecls > 0) {
  fail = true;
  console.error(`KOLLISION: ${renderAktDecls}× Top-Level "function renderAkt(" gefunden — erlaubt ist nur der Zuweisungs-Wrapper in ui.js.`);
}
if (fail) process.exit(1);
console.log(`collision_scan: OK — ${order.length} Scripts in echter Ladereihenfolge geprüft, keine dateiübergreifende Deklarations-Überschreibung.`);
