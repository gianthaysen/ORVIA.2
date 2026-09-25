/* ============================================================
   ORVIA · pacing_plan_v14 — Pacing-Plan (engine/pacing-plan.js, S5c)
   ------------------------------------------------------------
     A. plan(): v14-Referenz HM 1:50, kurze Distanzen, Grenzen ⇒ null
     B. Rechner-Verdrahtung: Slot, Fuellung, Katalog, CSS, Precache
   node supabase/tests/pacing_plan_v14_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
import { createRequire } from 'node:module';
import { tStub } from './_i18n-src.mjs';
const require = createRequire(import.meta.url);
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const P = require(new URL(_APPREL + 'js/engine/pacing-plan.js', import.meta.url).pathname);

sec('A · plan()');
{
  const hm = P.plan(21.0975, 6600);
  ok('A1 HM 1:50 = v14-Referenz: 5:17 / 5:13 / 5:10, Haelften 55:20 / 54:40', hm.fmt.segments.map(s => s[1]).join() === '5:17,5:13,5:10' && hm.fmt.h1 === '55:20' && hm.fmt.h2 === '54:40' && hm.halves.negative === true);
  ok('A2 Grenzen 5 / 15 km ab 20 km, Summe geht exakt auf', hm.segments[0].toKm === 5 && hm.segments[1].toKm === 15 && Math.abs(hm.segments[2].cumSec - 6600) < 1e-6);
  const t = P.plan(10, 3000);
  ok('A3 10 km: 25 % / 75 % Grenzen, Schnitt 5:00, Schluss 4:56', t.segments[0].toKm === 2.5 && t.segments[1].toKm === 7.5 && t.fmt.avg === '5:00' && t.fmt.segments[2][1] === '4:56');
  ok('A4 Zwischenzeiten monoton, Ziel = Gesamtzeit', t.segments[0].cumSec < t.segments[1].cumSec && t.segments[1].cumSec < t.segments[2].cumSec && t.fmt.total === '50:00');
  ok('A5 unplausibel ⇒ null: < 3 km, 0 s, Pace < 2:00, Pace > 20:00, NaN', P.plan(2, 600) === null && P.plan(10, 0) === null && P.plan(10, 1000) === null && P.plan(10, 13000) === null && P.plan('x', 100) === null);
  ok('A6 Offset einstellbar', P.plan(10, 3000, { offsetSec: 8 }).fmt.segments[0][1] === '5:08');
  ok('A7 Marathon 3:30: proportionale Grenzen 10,5 / 31,6 km, Anlaufen 5:03, Ziel 3:30:00', P.plan(42.195, 12600).segments[0].toKm === 10.5 && P.plan(42.195, 12600).segments[1].toKm === 31.6 && P.plan(42.195, 12600).fmt.segments[0][1] === '5:03' && P.plan(42.195, 12600).fmt.total === '3:30:00');
  ok('A8 VERSION', P.VERSION === 'pacing-plan@1');
}

sec('B · Rechner');
{
  const ui = rd('js/ui.js'), idx = rd('index.html'), sw = rd('sw.js'), css = rd('styles.css'), de = rd('locales/de.js');
  const calc = ui.slice(ui.indexOf('function gmProfPaceCalc(){'), ui.indexOf('function gmProfPaceCalc(){') + 4000);
  ok('B1 Seite: Slot #pcPlan nur beim Laufen und nur mit Modul', /if\(window\.ORVIA&&ORVIA\.pacingPlan\)h\+=.*id="pcPlan"/.test(calc) && calc.indexOf('pcPlan') > calc.indexOf("if(sp==='run')"));
  const comp = ui.slice(ui.indexOf('function gmPcCompute(){'), ui.indexOf('function gmProfPaceCalc(){'));
  ok('B2 gmPcCompute fuellt den Slot aus (dKm, tMin*60) — nur Laufen', /ORVIA\.pacingPlan\.plan\(dKm,tMin\*60\)/.test(comp) && /sp==='run'&&dKm!=null&&tMin!=null/.test(comp));
  /* Markup-Probe */
  const g = globalThis; g.window = g; g.ORVIA = {}; g._uiT = tStub().t; g.icon = n => '<svg data-i="' + n + '"></svg>'; g.gmEsc = s => String(s); g.fmtDe = v => String(v).replace('.', ',');
  const fn = ui.match(/\n(function gmPcPlanHTML\(pl\)\{[\s\S]*?\n\})\n/)[1];
  (0, eval)(fn + '\nglobalThis.gmPcPlanHTML=gmPcPlanHTML;');
  const h = g.gmPcPlanHTML(P.plan(21.0975, 6600));
  ok('B3 Markup: 3 Segmente + Ziel, Haelften, Quelle mit Offset', (h.match(/class="rc-srow"/g) || []).length === 3 && /rc-srow fin/.test(h) && /55:20/.test(h) && /\+4 s\/km/.test(h) && /21,1 km/.test(h));
  ok('B4 leer ⇒ Hinweis, keine Tabelle', /ab 3 km/.test(g.gmPcPlanHTML(null)) && !/rc-srow/.test(g.gmPcPlanHTML(null)));
  ok('B5 index/sw/CSS/Katalog', /js\/engine\/pacing-plan\.js/.test(idx) && /'\.\/js\/engine\/pacing-plan\.js'/.test(sw) && /\.rc-srow\{/.test(css) && /\.rc-halves\{/.test(css) && ['ui.pacing_plan', 'ui.pacing_intro', 'ui.pacing_quelle', 'ui.pacing_leer'].every(k => de.indexOf("'" + k + "'") >= 0));
}

console.log('\n' + (fail ? '❌' : '✅') + ' pacing_plan_v14: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
