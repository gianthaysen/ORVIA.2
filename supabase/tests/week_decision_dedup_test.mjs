/* ============================================================
   ORVIA · week_decision_dedup — Renderings sind keine Entscheidungen
   ------------------------------------------------------------
   BEFUND (24.08.2026, live gemessen, direkt nach dem Senken-Fix):
     week_design 180 · policy_move 180 · final_plan 180  in EINER Sitzung
   = 60 identische Entscheidungsketten. Ursache: generateWeekPlan() laeuft aus
   activeWeekPlan(), dem Lesepfad ALLER sieben Plan-Leser; logWeekDecision hatte
   — anders als logWeekShadow (_gmObsLast) — keine Drossel.

   Geprueft am ECHTEN ui.js-Quelltext: identischer Inhalt wird genau EINMAL
   protokolliert, jede echte Aenderung sofort wieder.

   node supabase/tests/week_decision_dedup_test.mjs [appRoot]
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const DL = require(join(APP, 'js/engine/decision-log.js'));
const uiRaw = readFileSync(join(APP, 'js/ui.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function sliceBalanced(src, marker) {
  const i = src.indexOf(marker); if (i < 0) return null;
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') { d++; started = true; }
    else if (ch === '}') { d--; if (started && d === 0) {
      let k = j + 1; while (k < src.length && /\s/.test(src[k])) k++;
      return src.slice(i, src[k] === ';' ? k + 1 : j + 1); } }
  }
  return null;
}

/* Die ECHTE Funktion aus ui.js, mit protokollierenden Attrappen. */
const src = sliceBalanced(uiRaw, 'O.logWeekDecision=function(ctx){');
ok('A1 logWeekDecision aus ui.js schneidbar', !!src);

function harness() {
  const calls = [];
  const O = { decisionLog: Object.assign({}, DL, { logDecision: (o) => { calls.push(o.decisionType); return { stored: true }; } }) };
  let n = 0;
  const fn = new Function('O', '_decisionId', 'var _lastWeekDecisionKey=null;\n' + src + '\nreturn O.logWeekDecision;')(O, () => 'dec:' + (++n));
  return { fn, calls };
}

console.log('\nA · Dedup bei identischem Inhalt');
{
  const { fn, calls } = harness();
  const ctx = { weekId: '2026-W35', planId: 'p1', cfg: { a: 1 },
    design: { hardDays: [1, 3], rules: ['r'] }, policy: { changes: [] },
    finalSummary: { sessions: 5, restDays: 2 } };
  fn(ctx);
  const nachErstem = calls.length;
  ok('A2 erster Aufruf schreibt die Kette', nachErstem >= 2, calls.join(','));
  for (let i = 0; i < 59; i++) fn(ctx);            /* exakt der Live-Fall: 60 Wiederholungen */
  ok('A3 59 identische Wiederholungen schreiben NICHTS mehr', calls.length === nachErstem,
    calls.length + ' statt ' + nachErstem);
  ok('A4 (Live-Bezug) statt 180 Zeilen nur ' + calls.length, calls.length <= 3);
}

console.log('\nB · Echte Änderung wird sofort wieder protokolliert');
{
  const { fn, calls } = harness();
  /* STRENG SEQUENZIELL: jeder Schritt aendert GENAU EIN Feld gegenueber dem
     vorherigen Zustand. Eine fruehere Fassung aenderte bei B3 nebenbei
     finalSummary zurueck — dadurch war „weekId wird gesehen" ungeprueft, und
     eine Mutationsprobe deckte genau das auf. */
  let s = { weekId: '2026-W35', planId: 'p1', cfg: { a: 1 }, finalSummary: { sessions: 5 } };
  fn(s); const n1 = calls.length;
  fn(s); ok('B1 Wiederholung gedrosselt', calls.length === n1);

  s = Object.assign({}, s, { finalSummary: { sessions: 6 } });          /* nur finalSummary */
  fn(s); ok('B2 geänderter Plan → wieder protokolliert', calls.length > n1, calls.length + ' > ' + n1);
  const n2 = calls.length; fn(s);
  ok('B2b danach wieder gedrosselt', calls.length === n2);

  s = Object.assign({}, s, { weekId: '2026-W36' });                      /* NUR weekId */
  fn(s); ok('B3 andere Woche → wieder protokolliert', calls.length > n2, calls.length + ' > ' + n2);
  const n3 = calls.length;

  s = Object.assign({}, s, { policy: { changes: [{ rule: 'x' }] } });    /* nur policy */
  fn(s); ok('B4 geänderte Policy → wieder protokolliert', calls.length > n3);
  const n4 = calls.length;

  s = Object.assign({}, s, { planId: 'p2' });                            /* NUR planId */
  fn(s); ok('B5 anderer Plan → wieder protokolliert', calls.length > n4, calls.length + ' > ' + n4);
  const n5 = calls.length;

  s = Object.assign({}, s, { cfg: { a: 2 } });                           /* NUR cfg */
  fn(s); ok('B6 geänderte Konfiguration → wieder protokolliert', calls.length > n5);
}

console.log('\nC · Fail-open: lieber doppelt als blind');
{
  const calls = [];
  const O = { decisionLog: { logDecision: (o) => { calls.push(o.decisionType); return { stored: true }; } } };  /* ohne stable/hashString */
  let n = 0;
  const fn = new Function('O', '_decisionId', 'var _lastWeekDecisionKey=null;\n' + src + '\nreturn O.logWeekDecision;')(O, () => 'dec:' + (++n));
  const ctx = { weekId: 'W', finalSummary: { sessions: 1 } };
  fn(ctx); const n1 = calls.length;
  fn(ctx);
  ok('C1 ohne Hashwerkzeug wird NICHT gedrosselt (kein stiller Verlust)', calls.length > n1, calls.length + ' > ' + n1);
  ok('C2 und es wirft nicht', true);
}

console.log('\n' + '─'.repeat(60));
console.log('week_decision_dedup: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);
