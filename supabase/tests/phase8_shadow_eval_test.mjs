/* ORVIA · Phase 8 (2026-08-05) — Shadow-Gate-Auswertung.
   Kernbeweise: die 5 Plan-Kriterien werden EINZELN bewertet; fehlender Beleg ist
   'insufficient_data' und NICHT 'pass'; Safety-Divergenz ist richtungsabhaengig
   definiert (nur „v2 nachsichtiger" blockiert); die Ordnungskonstanten stimmen mit
   decision-engine-v2 ueberein; Auswerter ist pure + deterministisch.
   node supabase/tests/phase8_shadow_eval_test.mjs [appRoot-absolut] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const SE = require(join(APP, 'js/engine/shadow-eval.js'));
const R = f => readFileSync(join(APP, f), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const crit = (r, id) => r.criteria.find(c => c.id === id);

/* ---- Fixtures ---- */
const day = (date, s1, s2, over) => Object.assign({
  date, ts: 0, v1: { state: s1, action: 'KEEP', score: 70 },
  v2: { state: s2, action: 'KEEP', confidence: 'medium', reasons: [] },
  agree: s1 === s2, missing: []
}, over || {});
const days = (n, s1, s2) => Array.from({ length: n }, (_, i) => day('2026-07-' + String(i + 1).padStart(2, '0'), s1, s2));
const week = (weekKey, over) => Object.assign({
  weekKey, day: '2026-08-01', ts: 0, ok: true, error: null, sessions: 6, byDay: [],
  unplaced: 0, conflicts: 0, blockedPrescriptions: 0, flags: [], liveSessions: 4,
  scheduler: 'scheduler-v2',
  gate: { deterministic: true, invalidSessions: 0, invalidCodes: [], validator: 'prescription-factory.validateWorkout',
    provenanceComplete: true, provenanceMissing: [], sessionsChecked: 6 }
}, over || {});
const GOOD = { dailyLog: days(14, 'GREEN', 'GREEN'), weeklyLog: [week('2026-W31'), week('2026-W32')] };

/* ============ Ordnungskonstanten vs. echte Engine ============
   Der Auswerter spiegelt die Reihenfolgen aus decision-engine-v2. Driften sie
   auseinander, wird „v2 nachsichtiger" falsch klassifiziert — das waere ein
   stiller Sicherheitsfehler, also hart pruefen. */
{
  const src = R('js/engine/decision-engine-v2.js');
  const st = (src.match(/order = \[('GREEN'[^\]]*)\]/) || [])[1];
  const ac = (src.match(/order = \[('KEEP'[^\]]*)\]/) || [])[1];
  const parse = s => (s || '').split(',').map(x => x.trim().replace(/'/g, ''));
  ok('Ordnung STATE identisch zu decision-engine-v2 (sonst falsche Safety-Einstufung)',
     JSON.stringify(parse(st)) === JSON.stringify(SE.STATE_ORDER), st);
  ok('Ordnung ACTION identisch zu decision-engine-v2',
     JSON.stringify(parse(ac)) === JSON.stringify(SE.ACTION_ORDER), ac);
}

/* ============ Safety-Divergenz: RICHTUNG entscheidet ============ */
ok('Einigkeit ⇒ keine Divergenz', SE.classifyDivergence(day('d', 'GREEN', 'GREEN')) === null);
{
  const d = SE.classifyDivergence(day('d', 'RED', 'GREEN'));
  ok('v1 RED / v2 GREEN ⇒ SAFETY-RELEVANT (v2 wuerde trainieren lassen, wo v1 bremst)',
     d && d.safetyRelevant === true && d.kind === 'v2_more_permissive' && d.reason === 'v2_state_less_severe');
}
{
  const d = SE.classifyDivergence(day('d', 'GREEN', 'RED'));
  ok('v1 GREEN / v2 RED ⇒ konservativ, KEIN Gate-Blocker',
     d && d.safetyRelevant === false && d.kind === 'v2_more_conservative');
}
{
  /* Gleicher State, aber v2 erlaubt die weniger einschraenkende Handlung. */
  const e = day('d', 'YELLOW', 'YELLOW');
  e.v1.action = 'REST'; e.v2.action = 'KEEP';
  const d = SE.classifyDivergence(e);
  ok('gleicher State, aber v2-Action weniger einschraenkend ⇒ safety-relevant',
     d && d.safetyRelevant === true && d.reason === 'v2_action_less_restrictive');
}
ok('unbekannter State ⇒ unknown, NICHT stillschweigend „sicher"',
   SE.classifyDivergence(day('d', 'GREEN', 'BLAU')).kind === 'unknown');

/* ============ S1 · Vergleichstage ============ */
ok('S1 · 13 Tage ⇒ insufficient_data (nicht fail, nicht pass)',
   crit(SE.evaluate({ dailyLog: days(13, 'GREEN', 'GREEN'), weeklyLog: GOOD.weeklyLog }), 'S1').status === 'insufficient_data');
ok('S1 · 14 Tage ⇒ pass', crit(SE.evaluate(GOOD), 'S1').status === 'pass');
{
  const blocked = days(14, 'GREEN', 'GREEN').concat([
    { date: '2026-07-20', agree: null, v1: null, v2: { state: null, blocked: 'training_input_resolver_missing' } }]);
  const c = crit(SE.evaluate({ dailyLog: blocked, weeklyLog: GOOD.weeklyLog }), 'S1');
  ok('S1 · BLOCKED-Tage zaehlen NICHT als verwertbar, werden aber ausgewiesen',
     c.value === 14 && c.evidence.blockedDays === 1 && c.evidence.blockedReasons[0].code === 'training_input_resolver_missing');
}

/* ============ S2 · Safety-Divergenzen ============ */
{
  const mixed = days(13, 'GREEN', 'GREEN').concat([day('2026-07-14', 'RED', 'GREEN')]);
  const r = SE.evaluate({ dailyLog: mixed, weeklyLog: GOOD.weeklyLog });
  ok('S2 · eine nachsichtige Abweichung ⇒ fail + Gate zu', crit(r, 'S2').status === 'fail' && r.gateReady === false);
  ok('S2 · Blocker wird benannt (S2 in blockers, nextStep=resolve_blockers)',
     r.blockers.indexOf('S2') >= 0 && r.nextStep.indexOf('resolve_blockers') === 0);
}
{
  const cons = days(13, 'GREEN', 'GREEN').concat([day('2026-07-14', 'GREEN', 'RED')]);
  const r = SE.evaluate({ dailyLog: cons, weeklyLog: GOOD.weeklyLog });
  ok('S2 · konservative Abweichung blockiert NICHT, wird aber gezaehlt',
     crit(r, 'S2').status === 'pass' && crit(r, 'S2').evidence.conservativeDivergences === 1 && r.gateReady === true);
}
ok('S2 · ohne Vergleichstage ⇒ insufficient_data (nicht „0 Divergenzen = pass")',
   crit(SE.evaluate({ dailyLog: [], weeklyLog: GOOD.weeklyLog }), 'S2').status === 'insufficient_data');

/* ============ S3/S4/S5 · Belege aus dem Wochenprotokoll ============
   Kernpunkt dieser Phase: das ALTE Protokoll (ohne gate-Feld) darf diese
   Kriterien nicht bestehen — sonst waere das Gate scheinbar erfuellt. */
{
  const legacy = [week('2026-W31'), week('2026-W32')].map(w => { const c = Object.assign({}, w); delete c.gate; return c; });
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'), weeklyLog: legacy });
  ok('ALT-Protokoll ohne gate-Feld ⇒ S3/S4/S5 insufficient_data, Gate NICHT bereit',
     ['S3', 'S4', 'S5'].every(id => crit(r, id).status === 'insufficient_data') && r.gateReady === false);
  ok('ALT-Protokoll · fehlende Belege werden je Kriterium ausgewiesen',
     crit(r, 'S3').evidence.weeksWithoutEvidence === 2);
  ok('ALT-Protokoll · nextStep verlangt Daten, nennt keine Blocker',
     r.nextStep.indexOf('collect_more_data') === 0 && r.blockers.length === 0);
}
{
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'),
    weeklyLog: [week('2026-W31'), week('2026-W32', { gate: Object.assign({}, week('x').gate, { deterministic: false }) })] });
  ok('S3 · nicht-deterministische Woche ⇒ fail mit weekKey',
     crit(r, 'S3').status === 'fail' && crit(r, 'S3').evidence.nonDeterministicWeeks[0] === '2026-W32');
}
{
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'),
    weeklyLog: [week('2026-W31'), week('2026-W32', { gate: Object.assign({}, week('x').gate, { invalidSessions: 2, invalidCodes: ['block_target_invalid'] }) })] });
  ok('S4 · ungueltige Sessions ⇒ fail inkl. Codes', crit(r, 'S4').status === 'fail' && crit(r, 'S4').evidence.offendingWeeks[0].codes[0] === 'block_target_invalid');
}
{
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'),
    weeklyLog: [week('2026-W31'), week('2026-W32', { blockedPrescriptions: 1 })] });
  ok('S4 · auch verweigerte Prescriptions (Factory) blockieren, nicht nur ungueltige',
     crit(r, 'S4').status === 'fail' && crit(r, 'S4').evidence.blockedPrescriptions === 1);
}
{
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'),
    weeklyLog: [week('2026-W31'), week('2026-W32', { gate: Object.assign({}, week('x').gate, { provenanceComplete: false, provenanceMissing: ['templateId'] }) })] });
  ok('S5 · unvollstaendige Provenienz ⇒ fail inkl. fehlendem Feld',
     crit(r, 'S5').status === 'fail' && crit(r, 'S5').evidence.incompleteWeeks[0].missing[0] === 'templateId');
}
/* Die drei Kriterien duerfen „nicht gemessen" NIE als erfuellt werten — das war
   beim Bau zuerst falsch (null ⇒ 0 ⇒ pass) und ist der Kern-Fehlermodus dieses
   Moduls. Jeweils separat gegen fail UND gegen pass abgesichert. */
{
  const noValidator = week('2026-W32', { gate: Object.assign({}, week('x').gate, { invalidSessions: null, validator: null }) });
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'), weeklyLog: [week('2026-W31'), noValidator] });
  ok('S4 · Validator lief nicht (null) ⇒ insufficient_data, NICHT pass; Gate bleibt zu',
     crit(r, 'S4').status === 'insufficient_data' && crit(r, 'S4').evidence.weeksNotValidated[0] === '2026-W32' && r.gateReady === false);
}
{
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'),
    weeklyLog: [week('2026-W31'), week('2026-W32', { gate: Object.assign({}, week('x').gate, { deterministic: null }) })] });
  ok('S3 · Determinismus nicht gemessen (null) ⇒ insufficient_data, weder pass noch fail',
     crit(r, 'S3').status === 'insufficient_data' && crit(r, 'S3').evidence.weeksNotMeasured[0] === '2026-W32');
}
{
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'),
    weeklyLog: [week('2026-W31'), week('2026-W32', { gate: Object.assign({}, week('x').gate, { provenanceComplete: null }) })] });
  ok('S5 · Provenienz nicht gemessen (null) ⇒ insufficient_data, nicht pass',
     crit(r, 'S5').status === 'insufficient_data' && crit(r, 'S5').evidence.weeksNotMeasured[0] === '2026-W32');
}
{
  /* Eine blockierte Woche schreibt gate:{deterministic:null,...} — sie darf das
     Gate nicht faelschlich als „verletzt" melden, aber eben auch nicht als erfuellt. */
  const blockedWeek = { weekKey: '2026-W33', ok: false, error: 'SCHEDULER_V2_AVAILABILITY_MISSING',
    gate: { deterministic: null, invalidSessions: null, provenanceComplete: null, note: 'week_blocked' } };
  const r = SE.evaluate({ dailyLog: days(14, 'GREEN', 'GREEN'), weeklyLog: GOOD.weeklyLog.concat([blockedWeek]) });
  ok('blockierte Woche verfaelscht S3/S4/S5 nicht (nur ok-Wochen liefern Belege)',
     ['S3', 'S4', 'S5'].every(id => crit(r, id).status === 'pass') && r.weeks.ok === 2);
}

/* ============ Gesamturteil ============ */
{
  const r = SE.evaluate(GOOD);
  ok('Vollstaendiger Beleg ⇒ gateReady true, alle 5 Kriterien pass',
     r.gateReady === true && r.criteria.length === 5 && r.criteria.every(c => c.status === 'pass'));
  ok('nextStep bei bestandenem Gate verweist auf Canary', r.nextStep === 'shadow_gate_passed_proceed_to_canary');
  ok('zu wenige ok-Wochen ⇒ Gate zu, auch wenn alle Kriterien pass',
     SE.evaluate({ dailyLog: GOOD.dailyLog, weeklyLog: [week('2026-W31')] }).gateReady === false);
  ok('blockierte Woche wird ausgewiesen',
     SE.evaluate({ dailyLog: GOOD.dailyLog, weeklyLog: GOOD.weeklyLog.concat([{ weekKey: '2026-W33', ok: false, error: 'SCHEDULER_V2_AVAILABILITY_MISSING' }]) })
       .weeks.blocked[0].error === 'SCHEDULER_V2_AVAILABILITY_MISSING');
  ok('leere Eingabe ⇒ NIE gateReady (fail-closed)', SE.evaluate({}).gateReady === false);
  ok('DETERMINISMUS · zweiter Lauf byte-identisch', JSON.stringify(SE.evaluate(GOOD)) === JSON.stringify(SE.evaluate(GOOD)));
}

/* ============ Reinheit + Einbindung ============ */
{
  const src = R('js/engine/shadow-eval.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('pure (Code): kein Date.now/Math.random/DOM/Storage/PROFILE',
     !/Date\.now|Math\.random|document\.|localStorage|\bPROFILE\b/.test(src));
}
{
  const idx = R('index.html'), sw = R('sw.js'), run = R('js/engine/shadow-runner.js');
  ok('index.html laedt shadow-eval', idx.indexOf('js/engine/shadow-eval.js') > 0);
  ok('sw.js precacht shadow-eval', sw.indexOf("'./js/engine/shadow-eval.js'") >= 0);
  ok('shadow-runner bietet gateReport() und faellt ohne Auswerter fail-closed aus',
     /gateReport/.test(run) && /shadow_eval_missing/.test(run) && /gateReady: false, error: 'shadow_eval_missing'/.test(run));
  ok('shadow-runner schreibt die Gate-Belege in den Wochen-Eintrag (gate:)',
     /_gateEvidence\(SV2, svInput, res\)/.test(run) && /gate: gate/.test(run));
  /* Der Log ist die Beweisgrundlage des Gates ⇒ run() darf das v2-Ergebnis NICHT
     cachen. Ein erster Cache-Versuch hat die Invariante „Krankheit ⇒ nie GREEN"
     gebrochen (engine_program_e S6). Absicht + Messung stehen im Quelltext. */
  ok('KEIN Cache in run(): jeder Lauf rechnet frisch (Gate-Belege duerfen nicht veralten)',
     !/cached\.sig/.test(run) && !/_inputSignature/.test(run) && /BEWUSST NICHT gecacht/.test(run));
  const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
  ok('SW-Version >= 244, genau einmal', swv != null && Number(swv) >= 244 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);
}

console.log('\nphase8_shadow_eval: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
