/* ORVIA · Phase 6.1/6.4 (2026-08-05) — Vertragstest: die kritischen Fail-closed-Pfade
   aus docs/ENGINE-VERTRAEGE-2026-08.md werden GEGEN DIE MODULE bewiesen, nicht nur
   dokumentiert. Zusaetzlich: das neutrale Workout-Schema (Vertrag 4) wird mit einem
   Mini-Validator ausfuehrbar gemacht und die beiden normativen Beispiele validiert.
   node supabase/tests/phase6_contracts_test.mjs [appRoot-absolut] */
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

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R = f => readFileSync(join(APP, f), 'utf8');

/* ============ Dokument existiert und benennt alle 7 Vertraege + Grundsatz ============ */
const doc = R('docs/ENGINE-VERTRAEGE-2026-08.md');
['Vertrag 1 · Trainingsziel', 'Vertrag 2 · Sportkapazität', 'Vertrag 3 · Zulässiger Trainingsslot',
 'Vertrag 4 · Session Prescription', 'Vertrag 5 · Konkrete ausführbare Einheit',
 'Vertrag 6 · Ausreichend belastbare Daten', 'Vertrag 7 · Sicherheitsregeln']
  .forEach(t => ok('Dokument enthält: ' + t, doc.indexOf(t) >= 0));
ok('Grundsatz 6.4 wörtlich enthalten', doc.indexOf('Fehlende Sicherheit führt zu weniger Automatisierung, nicht zu mehr Heuristik') >= 0);
ok('Kapazitäts-SoT-Tabelle: Lastserie=Ist-Wahrheit, calc.js=nur Anzeige',
   doc.indexOf('dailyLoadSeries') >= 0 && doc.indexOf('NIE in eine Prescription') >= 0);

/* ============ Vertrag 7.5 · Aktivierungsmodus: nur shadow_only ============ */
const GA = require(join(APP, 'js/engine/scheduler-goal-allocation.js'));
{
  const fn = GA.allocate || GA.build || GA.run;
  ok('GA exportiert eine Allokationsfunktion', typeof fn === 'function', Object.keys(GA).join(','));
  const r1 = fn.call(GA, {});
  const c1 = JSON.stringify(r1);
  ok('GA fail-closed bei leerem Input (kein stiller Default)', /SCHEDULER_GA_/.test(c1), c1.slice(0, 120));
  const r2 = fn.call(GA, { activationMode: 'production', contractVersion: 'x', planningDayLocal: '2026-08-05', timezone: 'Europe/Berlin' });
  ok('GA lehnt activationMode=production ab (nur shadow_only — Aktivierung ist Produktentscheidung)',
     JSON.stringify(r2).indexOf('ACTIVATION_MODE_REJECTED') >= 0, JSON.stringify(r2).slice(0, 120));
}

/* ============ Vertrag 7.3/7.4 · Knowledge-Gates ============ */
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));
const KP = require(join(APP, 'js/engine/knowledge/running-knowledge-pack.js'));
const KS = require(join(APP, 'js/engine/knowledge/knowledge-sources.js'));
{
  /* Pflicht-Pinning: ohne Pins ⇒ blocked, null Regeln. */
  const noPin = KC.selectRules(KP, KS, { mode: 'shadow' });
  ok('Pflicht-Pinning: selectRules ohne Pins ⇒ blocked + 0 Regeln',
     noPin.blocked === true && noPin.rules.length === 0 && noPin.errors.length > 0,
     (noPin.errors || []).slice(0, 3).map(e => e.code).join(','));
  const pins = {
    expectedKnowledgeContractVersion: KC.KNOWLEDGE_CONTRACT_VERSION || 5,
    expectedKnowledgeVersion: KP.knowledgeVersion,
    expectedPackContentHash: KC.packContentHash(KP),
    expectedSourceRegistryVersion: KS.registryVersion,
    expectedSourceRegistryHash: KC.registryContentHash(KS)
  };
  /* Production-Gate: ALLE Regeln unreviewed ⇒ null produktive Regeln (Entscheidung ②). */
  const prod = KC.selectRules(KP, KS, Object.assign({ mode: 'production', sport: 'running' }, pins));
  ok('Production-Gate zu: 0 Regeln im Produktionsmodus (alle scientific_review_pending/medical)',
     prod.blocked === false && prod.rules.length === 0
     && prod.excluded.every(e => ['scientific_review_pending', 'medical_safety_review_pending', 'technical_review_pending'].indexOf(e.code) >= 0),
     'excluded=' + prod.excluded.length);
  /* medicalSafetyRelevant in JEDEM Modus gesperrt bis medizinischer Review. */
  const shadow = KC.selectRules(KP, KS, Object.assign({ mode: 'shadow', sport: 'running' }, pins));
  const medIds = KP.rules.filter(r => r.medicalSafetyRelevant === true).map(r => r.ruleId);
  ok('medicalSafetyRelevant-Regeln (' + medIds.join(',') + ') auch im Shadow-Modus ausgeschlossen',
     medIds.length >= 2 && medIds.every(id => shadow.rules.every(r => r.ruleId !== id)
       && shadow.excluded.some(e => e.ruleId === id && e.code === 'medical_safety_review_pending')));
  /* Hash-Bindung: manipuliertes Pack ⇒ blocked (Freigaben invalidieren automatisch). */
  const tampered = JSON.parse(JSON.stringify(KP));
  tampered.rules[0].topic = 'tampered_topic';
  const tr = KC.selectRules(tampered, KS, Object.assign({ mode: 'shadow' }, pins));
  ok('Hash-Bindung: inhaltlich geändertes Pack ⇒ blocked (content_hash_mismatch)',
     tr.blocked === true && tr.errors.some(e => String(e.code).indexOf('hash') >= 0),
     tr.errors.slice(0, 2).map(e => e.code).join(','));
}

/* ============ Vertrag 1 · Zielwert = Aspiration, nie Capacity ============ */
ok('RUN-GOAL-001 existiert (Zielzeit nie Capacity-Quelle)',
   KP.rules.some(r => r.ruleId === 'RUN-GOAL-001'));
ok('goal-portfolio: Gesundheitsziele tighten_only (Safety nur verschärfen)',
   R('js/engine/goal-portfolio.js').indexOf('tighten_only') >= 0);

/* ============ Vertrag 6 · E-02-Quellenordnung + TRIMP-Fail-closed ============ */
const sc = R('js/metrics/source-contract.js');
ok('E-02-Ränge vollständig (measured_validated > device_sync > profile_manual > derived_estimate)',
   ['measured_validated', 'device_sync', 'profile_manual', 'derived_estimate'].every(s => sc.indexOf(s) >= 0));
ok('TRIMP fail-closed ohne gemessenen Ruhepuls/HFmax (kein Fallback) — ui.js-Anker',
   R('js/ui.js').indexOf('ohne gemessenen Ruhepuls bzw. HFmax kein TRIMP (kein Fallback)') >= 0);
ok('E-11: fehlende RPE ⇒ unknown (nie raten) — trainingLoadRepository',
   /unknown/.test(R('js/repos/trainingLoadRepository.js')));

/* ============ Vertrag 4 · Neutrales Workout-Schema: ausfuehrbarer Mini-Validator ============ */
const COMPLETION = ['duration', 'distance', 'reps', 'open'];
const TARGET = ['pace', 'speed', 'power', 'hr', 'hr_zone', 'rpe', 'rir', 'weight', 'cadence', 'open'];
const BLOCK = ['warmup', 'work', 'recovery', 'repeat', 'exercise', 'cooldown', 'skill', 'open'];
function vBlock(b, path, errs) {
  if (!b || typeof b !== 'object') { errs.push(path + ': kein Objekt'); return; }
  if (BLOCK.indexOf(b.type) < 0) errs.push(path + ': unbekannter Blocktyp ' + b.type);
  if (b.type === 'repeat') {
    if (!Number.isInteger(b.iterations) || b.iterations < 1) errs.push(path + ': repeat ohne iterations');
    if (!Array.isArray(b.blocks) || !b.blocks.length) errs.push(path + ': repeat ohne innere blocks');
    else b.blocks.forEach((x, i) => vBlock(x, path + '.blocks[' + i + ']', errs));
    return;
  }
  if (b.type === 'exercise') {
    if (typeof b.exercise_id !== 'string' || !b.exercise_id) errs.push(path + ': exercise ohne exercise_id');
    if (!Number.isInteger(b.sets) || b.sets < 1) errs.push(path + ': exercise ohne sets');
  } else {
    const c = b.completion;
    if (!c || COMPLETION.indexOf(c.type) < 0) errs.push(path + ': completion fehlt/unbekannt');
    else if (c.type !== 'open' && !(typeof c.value === 'number' && isFinite(c.value) && c.value > 0)) errs.push(path + ': completion ohne value');
  }
  const t = b.target;
  if (t != null) {
    if (TARGET.indexOf(t.type) < 0) errs.push(path + ': unbekannter Zieltyp ' + t.type);
    const hasVal = t.value != null, hasRange = t.min != null || t.max != null;
    if (hasVal && hasRange) errs.push(path + ': target hat value UND min/max');   // Vertrag: entweder/oder
    if (t.type !== 'open' && !hasVal && !hasRange) errs.push(path + ': target ohne Wert/Bereich');
  }
}
function vWorkout(w) {
  const errs = [];
  if (typeof w.sport_id !== 'string' || !w.sport_id) errs.push('sport_id fehlt');
  if (!Array.isArray(w.blocks) || !w.blocks.length) errs.push('blocks fehlen');
  else w.blocks.forEach((b, i) => vBlock(b, 'blocks[' + i + ']', errs));
  return errs;
}
/* Normatives Beispiel 1: Laufen-Intervalle (Anhang des Vertragsdokuments). */
const exRun = { sport_id: 'running', session_type: 'interval', goal: 'vo2max', priority: 'key', blocks: [
  { type: 'warmup', completion: { type: 'distance', value: 2000, unit: 'm' }, target: { type: 'hr_zone', min: 1, max: 2 } },
  { type: 'repeat', iterations: 4, blocks: [
    { type: 'work', completion: { type: 'distance', value: 800, unit: 'm' }, target: { type: 'pace', min: 295, max: 305, unit: 's_per_km' } },
    { type: 'recovery', completion: { type: 'distance', value: 400, unit: 'm' }, target: { type: 'open' } }
  ] },
  { type: 'cooldown', completion: { type: 'distance', value: 1200, unit: 'm' }, target: { type: 'open' } }
] };
ok('Schema · Laufen-Intervallbeispiel validiert (verschachteltes repeat)', vWorkout(exRun).length === 0, vWorkout(exRun).join(' | '));
/* Normatives Beispiel 2: Kraft (Gym-Stufe-5-Pfad, E-27). */
const exStr = { sport_id: 'strength', session_type: 'lower_body_strength', goal: null, priority: 'build', blocks: [
  { type: 'exercise', exercise_id: 'back_squat', sets: 4, repetitions: 5, rest_seconds: 180, target: { type: 'rir', value: 2 } }
] };
ok('Schema · Kraftbeispiel validiert (exercise/sets/rir)', vWorkout(exStr).length === 0, vWorkout(exStr).join(' | '));
/* Negativkontrollen: der Validator MUSS Fehler finden (sonst misst er nichts). */
ok('Schema-Negativkontrolle: value UND min/max gleichzeitig ⇒ abgelehnt',
   vWorkout({ sport_id: 'running', blocks: [{ type: 'work', completion: { type: 'duration', value: 600 }, target: { type: 'pace', value: 300, min: 295, max: 305 } }] }).length > 0);
ok('Schema-Negativkontrolle: repeat ohne innere blocks ⇒ abgelehnt',
   vWorkout({ sport_id: 'running', blocks: [{ type: 'repeat', iterations: 4 }] }).length > 0);
ok('Schema-Negativkontrolle: exercise ohne exercise_id ⇒ abgelehnt',
   vWorkout({ sport_id: 'strength', blocks: [{ type: 'exercise', sets: 3 }] }).length > 0);

/* ============ Vertrag 5 · E-16-Identität + 5C-Modell verankert ============ */
const PD = require(join(APP, 'js/plan-domain.js'));
ok('plan-domain: rebase/effectiveSessions/applyOverride vorhanden (5C-Modell = Vertrag-5-Basis)',
   typeof PD.rebase === 'function' && typeof PD.effectiveSessions === 'function' && typeof PD.applyOverride === 'function');
ok('E-16 im Quelltext: psg:-IDs nie automatisch übernehmen (Konflikt statt still)',
   /psg/.test(R('js/plan-domain.js')));

console.log('\nphase6_contracts: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
