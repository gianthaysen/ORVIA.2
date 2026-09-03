/* ============================================================
   ORVIA · goal_plan_switch — B-01 Schritt 3: goalOf() Quelle tauschen, Form behalten
   ------------------------------------------------------------
     A. Flag AUS ⇒ goalOf() byteweise wie bisher (6 Profile, golden)
     B. Flag AN, nur Laufziel ⇒ gleiche Werte wie AUS (+ _planInput)
     C. Flag AN, Kraftziel Prio 1 + Laufziel Prio 2 ⇒ Kraftziel (Luecke 1)
     D. Flag AN, kein Hauptziel ⇒ Rueckfallkette unveraendert
     E. Flag AN, Modul fehlt / wirft ⇒ wie AUS (fail-closed)
     F. Verdrahtung: Skript-Tag + sw.js + KNOWN + Migration 0039

   node supabase/tests/goal_plan_switch_test.mjs
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'ui.js'))) || _flat);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = x => JSON.stringify(x);

function sliceFn(src, marker) {
  const i = src.indexOf(marker); if (i < 0) throw new Error('Slice fehlt: ' + marker);
  let d = 0, st = false;
  for (let j = i; j < src.length; j++) { const ch = src[j]; if (ch === '{') { d++; st = true; } else if (ch === '}') { d--; if (st && d === 0) return src.slice(i, j + 1); } }
  throw new Error('unbalanciert: ' + marker);
}
const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
const src = ['const RACE_DIST=' + ui.match(/const RACE_DIST=\{[^}]*\}/)[0].slice('const RACE_DIST='.length) + ';',
  sliceFn(ui, 'function goalOf()'), sliceFn(ui, 'function mainGoalOf()'), sliceFn(ui, 'function _goalPlanInputOn()')].join('\n');

const GPI = require(join(APP, 'js/engine/goal-plan-input.js'));
const TAPER = require(join(APP, 'js/engine/goal-taper-resolver.js'));
let FLAG = false, MODULE = GPI;
const ctx = () => ({
  ORVIA: { featureFlags: { isEnabled: f => f === 'goal_plan_input' && FLAG }, goalPlanInput: MODULE, goalTaperResolver: TAPER },
  gcat: c => c, todayStr: () => '2026-09-03', listGoals: undefined, DB: undefined
});
function mk(profile) {
  const c = ctx(); c.PROFILE = profile;
  const fn = new Function('PROFILE', 'ORVIA', 'gcat', 'todayStr', 'listGoals', 'DB', 'window', src + '\nreturn goalOf;');
  return fn(c.PROFILE, c.ORVIA, c.gcat, c.todayStr, c.listGoals, c.DB, { ORVIA: c.ORVIA });
}
const HM = { id: 'g-hm', status: 'active', priority: 2, category: 'half_marathon', metricType: 'time', unit: 's', targetValue: 6600, targetDate: '2026-10-11' };
const KRAFT = { id: 'g-k', status: 'active', priority: 1, category: 'muscle_gain', metricType: 'weight', unit: 'kg', targetValue: 82, targetDate: '2026-12-31' };
const PROFILES = {
  nurHM: { goals: [HM] },
  hmOhneZeit: { goals: [Object.assign({}, HM, { targetValue: null })] },
  kraftUndHM: { goals: [KRAFT, HM] },
  nurKraft: { goals: [KRAFT] },
  keinZiel: { goals: [], primaryGoal: 'health' },
  legacySpiegel: { goals: [], goal: { type: 'run_10k', distanceKm: 10, raceDate: '2026-11-01', targetMin: 50, priority: 'finish' } }
};
const strip = o => { if (!o) return o; const c = Object.assign({}, o); delete c._planInput; return c; };

sec('A · Flag AUS = Bestand');
const GOLD = {};
{
  FLAG = false;
  for (const k of Object.keys(PROFILES)) GOLD[k] = mk(PROFILES[k])();
  ok('A1 nur HM → half_marathon, 110 min, Datum', GOLD.nurHM.type === 'half_marathon' && GOLD.nurHM.targetMin === 110 && GOLD.nurHM.raceDate === '2026-10-11' && GOLD.nurHM._canonicalId === 'g-hm');
  ok('A2 Kraft Prio 1 + HM → Bestand liefert das HM (Luecke 1 sichtbar)', GOLD.kraftUndHM.type === 'half_marathon');
  ok('A3 nur Kraft → Bestand faellt auf health zurueck', GOLD.nurKraft.type === 'health' && GOLD.nurKraft.distanceKm === null);
  ok('A4 Legacy-Spiegel wird gelesen', GOLD.legacySpiegel.type === 'run_10k' && GOLD.legacySpiegel.targetMin === 50);
  ok('A5 kein _planInput im Bestand', Object.keys(GOLD).every(k => !('_planInput' in GOLD[k])));
}

sec('B · Flag AN, reines Laufziel ⇒ gleiche Werte');
{
  FLAG = true;
  const r = mk(PROFILES.nurHM)();
  ok('B1 Felder identisch zum Bestand', J(strip(r)) === J(GOLD.nurHM), J(strip(r)));
  ok('B2 _planInput haengt an (Phase build, keine Luecken)', r._planInput && r._planInput.phase === 'build' && r._planInput.gaps.length === 0);
  const r2 = mk(PROFILES.hmOhneZeit)();
  ok('B3 HM ohne Zielzeit: targetMin null wie im Bestand, Luecke benannt', r2.targetMin === null && GOLD.hmOhneZeit.targetMin === null && r2._planInput.gaps.indexOf('target_value') >= 0);
}

sec('C · Flag AN, Hauptziel ist kein Laufziel');
{
  FLAG = true;
  const r = mk(PROFILES.kraftUndHM)();
  ok('C1 Kraft Prio 1 gewinnt: type muscle_gain', r.type === 'muscle_gain', r.type);
  ok('C2 keine Distanz, keine Zielzeit, Datum des Kraftziels', r.distanceKm === null && r.targetMin === null && r.raceDate === '2026-12-31');
  ok('C3 _canonicalId = Kraftziel', r._canonicalId === 'g-k');
  const r2 = mk(PROFILES.nurKraft)();
  ok('C4 nur Kraft: muscle_gain statt health', r2.type === 'muscle_gain' && GOLD.nurKraft.type === 'health');
}

sec('D · Flag AN, kein Hauptziel ⇒ Rueckfall unveraendert');
{
  FLAG = true;
  ok('D1 kein Ziel → identisch zum Bestand', J(mk(PROFILES.keinZiel)()) === J(GOLD.keinZiel));
  ok('D2 Legacy-Spiegel → identisch zum Bestand', J(mk(PROFILES.legacySpiegel)()) === J(GOLD.legacySpiegel));
}

sec('E · fail-closed');
{
  FLAG = true; MODULE = null;
  ok('E1 Modul fehlt → wie AUS', J(mk(PROFILES.kraftUndHM)()) === J(GOLD.kraftUndHM));
  MODULE = { resolve: () => { throw new Error('boom'); }, legacyForm: () => null };
  ok('E2 Modul wirft → wie AUS', J(mk(PROFILES.kraftUndHM)()) === J(GOLD.kraftUndHM));
  MODULE = GPI; FLAG = false;
  ok('E3 Flag aus, Modul da → wie AUS', J(mk(PROFILES.kraftUndHM)()) === J(GOLD.kraftUndHM));
}

sec('F · Verdrahtung');
{
  const idx = readFileSync(join(APP, 'index.html'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('F1 Skript-Tag nach goal-taper-resolver', idx.indexOf('js/engine/goal-plan-input.js') > idx.indexOf('js/engine/goal-taper-resolver.js') && idx.indexOf('js/engine/goal-plan-input.js') > 0);
  ok('F2 sw.js-Eintrag', sw.indexOf("'./js/engine/goal-plan-input.js'") > 0);
  const FF = require(join(APP, 'js/engine/feature-flags.js'));
  ok('F3 Flag bekannt', FF.KNOWN.indexOf('goal_plan_input') >= 0);
  const mig = join(HERE, '..', 'migrations', '0039_goal_plan_input_flag.sql');
  ok('F4 Migration 0039 nennt das Flag im CHECK', existsSync(mig) && /goal_plan_input/.test(readFileSync(mig, 'utf8')));
}

sec('G · Luecke 5: Zieldistanz an goalEngine (buildGoal)');
{
  const bg = sliceFn(ui, 'function buildGoal()');
  const call = bg.slice(bg.indexOf('Calc.goalEngine('));
  ok('G1 goalEngine-Aufruf uebergibt distanceKm', /distanceKm\s*:/.test(call));
  ok('G2 … nur hinter dem Flag (_goalPlanInputOn) — ohne Flag null', /distanceKm:\(function\(\)\{try\{if\(!_goalPlanInputOn\(\)\)return null;/.test(call));
  ok('G3 … aus goalOf().distanceKm, nie aus einer Konstante', /goalOf\(\);return \(_g&&_g\.distanceKm>0\)\?_g\.distanceKm:null/.test(call) && !/distanceKm:\s*21/.test(call));
  /* Funktional: die Distanz-Logik selbst ist in goal_engine_distance_test abgedeckt. */
}

console.log('\n' + (fail ? '❌' : '✅') + ' goal_plan_switch: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
