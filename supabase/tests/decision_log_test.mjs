/* ORVIA · Entscheidungs-Log (Bauplan Stufe 0a, Fassung 2.1)

   Geprüfte Zusagen — jede einzeln, jede als EIGENSCHAFT formuliert:

     Z1  Deckelung: Top-5 nach Score + Gesamtzahl; nie mehr gespeichert
     Z2  Gleiche Eingaben + gleiche Laufzeit  ⇒ gleicher decisionHash
     Z3  Gleiche Eingaben + ANDERE Version    ⇒ ANDERER decisionHash
     Z4  Logging-Ausfall verändert den finalen Plan byte-für-byte NICHT
     Z5  Unveränderlichkeit: kein update(); Datensatz eingefroren
     Z6  Kette von final_plan rückwärts auflösbar; Zyklus bricht ab
     Z7  Rekonstruktion bei abweichendem Runtime-Hash wird VERWEIGERT
     Z8  Keine Gesundheitsfelder in der Diagnoseausgabe
     Z9  Kein Ausgang wirft; jeder Fehlerpfad liefert {stored:false, reason}
     Z10 Fehlendes Modul wird als 'absent' geführt, nicht übersprungen

   node supabase/tests/decision_log_test.mjs [appRoot-absolut] */
import { existsSync } from 'node:fs';
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
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const DL = require(join(APP, 'js/engine/decision-log.js'));

let seq = 0;
const nextId = () => 'dec:' + (++seq);
const NOW = '2026-08-07T09:00:00.000Z';

const baseOpts = (over) => Object.assign({
  timestamp: NOW, decisionType: 'week_design', decisionId: nextId(),
  weekId: '2026-W32', planId: 'plan:1',
  versions: { engine: 'v8-262', designer: 'week-plan-designer@1', policy: 'week-plan-policy@1' },
  inputs: { trainDays: 5, units: 8 },
  derivedState: { loadTrend: 'stable' },
  rulesTriggered: ['R4_no_two_hard_per_day']
}, over || {});

/* ══════════════════════════════════════════════════════════════ */
sec('Z1 · Deckelung der Kandidaten');
{
  const many = Array.from({ length: 40 }, (_, i) => ({ days: [i], score: i * 10 }));
  const b = DL.build(baseOpts({ candidates: many }));
  ok('nur 5 Kandidaten gespeichert', b.record.candidates.length === 5, 'ist ' + b.record.candidates.length);
  ok('Gesamtzahl bleibt erhalten', b.record.candidatesEvaluated === 40, 'ist ' + b.record.candidatesEvaluated);
  ok('Abschnitt wird beziffert', b.record.candidatesTruncated === 35, 'ist ' + b.record.candidatesTruncated);
  ok('höchster Score ist dabei', b.record.candidates[0].score === 390);
  ok('niedrigster Score ist NICHT dabei',
    !b.record.candidates.some(c => c.score === 0));

  /* Kandidaten ohne Score dürfen die guten nicht verdrängen — sonst hinge die
     Auswahl an der Array-Reihenfolge statt an der Bewertung. */
  const mixed = [{ days: [1] }, { days: [2], score: 500 }, { days: [3] }, { days: [4], score: 400 },
    { days: [5] }, { days: [6] }, { days: [7] }];
  const b2 = DL.build(baseOpts({ candidates: mixed }));
  ok('bewertete Kandidaten stehen vorn',
    b2.record.candidates[0].score === 500 && b2.record.candidates[1].score === 400);

  const c0 = DL.capCandidates([], 5);
  ok('leere Liste erzeugt keine Fehlzahl', c0.evaluated === 0 && c0.truncated === 0 && c0.kept.length === 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z2/Z3 · Hash bindet Eingaben UND Laufzeit');
{
  const V1 = { engine: 'v8-262', designer: 'week-plan-designer@1' };
  const V2 = { engine: 'v8-400', designer: 'week-plan-designer@1' };
  const inputs = { trainDays: 5, units: 8, goal: 'HM' };

  const a = DL.build(baseOpts({ versions: V1, inputs, decisionId: 'a' }));
  const b = DL.build(baseOpts({ versions: V1, inputs: { units: 8, goal: 'HM', trainDays: 5 }, decisionId: 'b' }));
  ok('Z2 gleiche Eingaben + gleiche Laufzeit ⇒ gleicher Hash',
    a.record.decisionHash === b.record.decisionHash, a.record.decisionHash + ' / ' + b.record.decisionHash);
  ok('Schlüsselreihenfolge ist irrelevant (stabile Serialisierung)',
    DL.stable({ x: 1, y: 2 }) === DL.stable({ y: 2, x: 1 }));

  const c = DL.build(baseOpts({ versions: V2, inputs, decisionId: 'c' }));
  ok('Z3 andere Engine-Version ⇒ anderer Hash',
    a.record.decisionHash !== c.record.decisionHash, a.record.decisionHash + ' / ' + c.record.decisionHash);
  ok('Runtime-Hash selbst unterscheidet sich',
    a.record.decisionRuntimeHash !== c.record.decisionRuntimeHash);

  const d = DL.build(baseOpts({ versions: V1, inputs: { trainDays: 6, units: 8, goal: 'HM' }, decisionId: 'd' }));
  ok('andere Eingaben ⇒ anderer Hash', a.record.decisionHash !== d.record.decisionHash);

  /* Hashfunktion selbst: gleiche Eingabe gleicher Wert, verschiedene Eingabe
     verschiedener Wert (Stichprobe gegen triviale Kollision). */
  ok('Hash ist deterministisch', DL.hashString('abc') === DL.hashString('abc'));
  ok('Hash trennt ähnliche Eingaben', DL.hashString('abc') !== DL.hashString('abd'));
  const hs = new Set(Array.from({ length: 500 }, (_, i) => DL.hashString('week-' + i)));
  ok('keine Kollisionen in 500 Stichproben', hs.size === 500, 'eindeutig: ' + hs.size);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z4 · Logging-Ausfall verändert den Plan NICHT');
{
  /* Das ist die wichtigste Zusage des Moduls: Das Log ist Beobachter, nie
     Beteiligter. Geprüft am echten Designer — einmal mit funktionierender
     Senke, einmal mit einer Senke, die wirft, einmal ganz ohne Log. Die drei
     Pläne müssen byte-für-byte identisch sein. */
  const D = require(join(APP, 'js/engine/week-plan-designer.js'));
  const units = [
    { t: 'Laufen', l: 'Intervalle', d: 'iv' }, { t: 'Laufen', l: 'Tempo', d: 'tempo' },
    { t: 'Laufen', l: 'Long Run', d: 'lr' }, { t: 'Laufen', l: 'Easy Z2', d: 'ez' },
    { t: 'Gym', l: 'Beine', d: '45 min' }, { t: 'Gym', l: 'Oberkörper', d: '45 min' },
    { t: 'Rad', l: 'Easy Z2', d: '60 min' }, { t: 'Schwimmen', l: 'Technik', d: '~900 m' }
  ];
  const cfg = { trainDays: [0, 1, 2, 3, 4, 5], restDayIdx: [6], doubleAllowedDayIdx: [1, 3] };

  const planA = JSON.stringify(D.designWeek(units, cfg));

  DL.clear(); DL.setEnabled(true);
  DL.setSink(() => { throw new Error('sink kaputt'); });
  const planB = JSON.stringify(D.designWeek(units, cfg));
  const rB = DL.logDecision(baseOpts({ inputs: cfg }));
  ok('Senke wirft ⇒ stored:false mit Grund', rB.stored === false && rB.reason === 'sink_failed', rB.reason);

  DL.setSink(null); DL.setEnabled(false);
  const planC = JSON.stringify(D.designWeek(units, cfg));
  const rC = DL.logDecision(baseOpts({ inputs: cfg }));
  ok('Log abgeschaltet ⇒ stored:false', rC.stored === false && rC.reason === 'disabled', rC.reason);

  ok('Plan mit defekter Senke identisch (byte-für-byte)', planA === planB);
  ok('Plan mit abgeschaltetem Log identisch (byte-für-byte)', planA === planC);
  DL.setEnabled(true); DL.setSink(null); DL.clear();
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z5 · Unveränderlichkeit');
{
  ok('kein update() in der Schnittstelle',
    typeof DL.update === 'undefined' && typeof DL.patch === 'undefined' && typeof DL.edit === 'undefined');

  const b = DL.build(baseOpts({}));
  let threwOrIgnored = false;
  try { b.record.decisionType = 'gefälscht'; } catch (e) { threwOrIgnored = true; }
  ok('Datensatz ist eingefroren',
    b.record.decisionType === 'week_design' || threwOrIgnored, 'ist ' + b.record.decisionType);

  /* Eingaben dürfen nicht per Referenz im Datensatz landen — sonst könnte eine
     spätere Änderung am Aufrufer-Objekt den Beleg rückwirkend verfälschen. */
  const live = { trainDays: 5 };
  const b2 = DL.build(baseOpts({ inputs: live }));
  live.trainDays = 99;
  ok('Eingaben werden kopiert, nicht referenziert', b2.record.inputs.trainDays === 5, 'ist ' + b2.record.inputs.trainDays);

  /* Korrektur = neuer Eintrag mit supersedesDecisionId */
  const corr = DL.build(baseOpts({ decisionId: 'x2', supersedesDecisionId: 'x1', decisionType: 'user_override' }));
  ok('Korrektur trägt supersedesDecisionId', corr.record.supersedesDecisionId === 'x1');
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z6 · Entscheidungskette');
{
  const mk = (id, parent, type) => DL.build(baseOpts({
    decisionId: id, parentDecisionId: parent, decisionType: type, weekId: '2026-W33'
  })).record;

  const recs = [
    mk('d1', null, 'week_design'),
    mk('d2', 'd1', 'policy_move'),
    mk('d3', 'd2', 'user_override'),
    mk('d4', 'd3', 'opportunity_move'),
    mk('d5', 'd4', 'final_plan')
  ];
  const chain = DL.chainOf(recs, 'd5');
  ok('Kette vollständig', chain.length === 5, 'ist ' + chain.length);
  ok('Kette chronologisch',
    chain.map(r => r.decisionType).join('→') ===
    'week_design→policy_move→user_override→opportunity_move→final_plan',
    chain.map(r => r.decisionType).join('→'));

  /* Entscheidung ≠ Ausführung: die erste Auswahl ist NICHT der finale Plan. */
  const finals = recs.filter(r => r.decisionType === 'final_plan');
  ok('genau ein final_plan terminiert die Kette', finals.length === 1);
  ok('final_plan ist nicht die erste Entscheidung', finals[0].decisionId !== 'd1');
  ok('final_plan trägt resolvedFrom (kein Flag auf altem Eintrag)',
    Array.isArray(finals[0].resolvedFrom));
  ok('Nicht-final-Einträge haben resolvedFrom = null', recs[0].resolvedFrom === null);

  /* Ein defektes Log darf keine Endlosschleife erzeugen. */
  const cyc = [
    DL.build(baseOpts({ decisionId: 'c1', parentDecisionId: 'c2' })).record,
    DL.build(baseOpts({ decisionId: 'c2', parentDecisionId: 'c1' })).record
  ];
  let looped = false;
  const t0 = Date.now();
  const cc = DL.chainOf(cyc, 'c1');
  if (Date.now() - t0 > 2000) looped = true;
  ok('Zyklus bricht ab statt endlos zu laufen', !looped && cc.some(x => x.broken === 'cycle'));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z7 · Rekonstruktion nur bei gleicher Laufzeit');
{
  /* Purität garantiert Determinismus INNERHALB einer Codeversion. Ein alter
     Eingabesatz kann in einer neuen Version andere Kandidaten erzeugen —
     deshalb darf explain() dann NICHT rekonstruieren. */
  const regNow = {
    engineVersion: 'v8-263',
    weekPlanDesigner: { VERSION: 'week-plan-designer@1' },
    weekPlanPolicy: { VERSION: 'week-plan-policy@1' },
    loadProfile: { VERSION: 'load-profile@1' },
    planVariants: { VERSION: 'plan-variants@1' },
    performanceZones: { VERSION: 'performance-zones@1' },
    featureFlags: { VERSION: 'feature-flags@1' }
  };
  const vNow = DL.collectVersions(regNow);
  const recSame = DL.build(baseOpts({ versions: vNow, weekId: '2026-W34' })).record;
  const exSame = DL.explain('2026-W34', [recSame], regNow);
  ok('gleiche Laufzeit ⇒ reconstruction available',
    exSame.reconstruction === 'available', exSame.reconstruction);

  const regLater = Object.assign({}, regNow, { weekPlanDesigner: { VERSION: 'week-plan-designer@2' } });
  const exDiff = DL.explain('2026-W34', [recSame], regLater);
  ok('geänderte Designer-Version ⇒ Rekonstruktion VERWEIGERT',
    exDiff.reconstruction === 'unavailable_runtime_changed', exDiff.reconstruction);
  ok('beide Versionsstände werden ausgewiesen',
    !!exDiff.runtime.loggedVersions && !!exDiff.runtime.currentVersions &&
    exDiff.runtime.logged !== exDiff.runtime.current);

  /* Auch eine reine Engine-Versionsänderung ohne Modulwechsel zählt — eine
     Datenmigration kann dieselben Eingaben anders auflösen. */
  const regBumped = Object.assign({}, regNow, { engineVersion: 'v8-400' });
  ok('geänderte Engine-Version allein reicht für Verweigerung',
    DL.explain('2026-W34', [recSame], regBumped).reconstruction === 'unavailable_runtime_changed');

  ok('ohne Einträge: found:false statt Erfindung',
    DL.explain('2099-W01', [], regNow).found === false);

  const ex = DL.explain('2026-W34', [recSame], regNow);
  ok('ausgelöste Regeln werden benannt', ex.rulesTriggered.indexOf('R4_no_two_hard_per_day') >= 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z8 · Gesundheitsdaten verlassen den geschützten Pfad nicht');
{
  DL.clear(); DL.setEnabled(true); DL.setSink(null);
  DL.logDecision(baseOpts({
    decisionType: 'constraint_block',
    inputs: { trainDays: 5, pain: 'Knie links, stechend', rpe: 9 },
    constraints: [{ region: 'knee', severity: 2, note: 'seit dem Wettkampf' }]
  }));
  const out = JSON.stringify(DL.dump(5));

  ok('Schmerztext erscheint nicht in der Diagnoseausgabe', out.indexOf('stechend') < 0);
  ok('Notiz erscheint nicht in der Diagnoseausgabe', out.indexOf('seit dem Wettkampf') < 0);
  ok('RPE erscheint nicht in der Diagnoseausgabe', out.indexOf('"rpe":9') < 0);
  ok('Schwärzung ist als solche erkennbar', out.indexOf('[redigiert]') >= 0);
  ok('unkritische Felder bleiben lesbar', out.indexOf('trainDays') >= 0);

  /* Der ROHE Datensatz muss die Daten dagegen enthalten — sonst wäre der Beleg
     wertlos. Der Unterschied liegt im Ausgabeweg, nicht in der Speicherung. */
  const raw = JSON.stringify(DL.recent(1));
  ok('roher Datensatz enthält die Daten weiterhin', raw.indexOf('stechend') >= 0);

  /* Schwärzung muss verschachtelt greifen. */
  const deep = DL.redact({ a: { b: { c: { pain: 'x', ok: 1 } } } });
  ok('Schwärzung greift verschachtelt', deep.a.b.c.pain === '[redigiert]' && deep.a.b.c.ok === 1);
  const arr = DL.redact([{ pain: 'x' }, { ok: 2 }]);
  ok('Schwärzung greift in Arrays', arr[0].pain === '[redigiert]' && arr[1].ok === 2);
  DL.clear();
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z9 · Kein Ausgang wirft');
{
  const bad = [
    undefined, null, {}, { decisionType: 'unbekannt' },
    { decisionType: 'week_design' },
    { decisionType: 'week_design', timestamp: NOW },
    { decisionType: 'week_design', timestamp: NOW, decisionId: 'z', candidates: 'kein Array' },
    { decisionType: 'week_design', timestamp: NOW, decisionId: 'z', inputs: (() => { const a = {}; a.self = a; return a; })() }
  ];
  let threw = null;
  bad.forEach((o, i) => { try { DL.logDecision(o); } catch (e) { threw = i + ': ' + e.message; } });
  ok('kein Eingabefall wirft', threw === null, threw || '');

  const r1 = DL.logDecision({});
  ok('ungültige Eingabe ⇒ stored:false mit Grund',
    r1.stored === false && /invalid:/.test(r1.reason), r1.reason);
  ok('Grund benennt die fehlenden Felder',
    /missing_timestamp/.test(r1.reason) && /missing_decision_id/.test(r1.reason), r1.reason);

  const r2 = DL.logDecision(baseOpts({ decisionType: 'erfunden' }));
  ok('unbekannter Typ wird abgelehnt, nicht gespeichert',
    r2.stored === false && /unknown_decision_type/.test(r2.reason), r2.reason);

  DL.setSink(() => Promise.reject(new Error('netz weg')));
  const r3 = DL.logDecision(baseOpts({}));
  ok('abgelehntes Promise der Senke wirft nicht', r3.stored === true && r3.reason === 'queued');

  DL.setSink(null);
  const r4 = DL.logDecision(baseOpts({}));
  ok('ohne Senke: no_sink, kein Fehler', r4.stored === false && r4.reason === 'no_sink');
  DL.clear();
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z10 · Laufzeitversionen vollständig');
{
  const v = DL.collectVersions({});
  const keys = DL.RUNTIME_MODULES.map(m => m[0]);
  ok('alle entscheidungsrelevanten Module sind Teil des Vertrags',
    keys.every(k => Object.prototype.hasOwnProperty.call(v, k)),
    'fehlt: ' + keys.filter(k => !(k in v)).join(','));
  ok('fehlendes Modul wird als absent geführt, nicht übersprungen',
    v.designer === 'absent' && v.policy === 'absent');
  ok('das Log führt seine eigene Version mit', v.log === DL.VERSION);

  const vFull = DL.collectVersions({
    engineVersion: 'v8-262',
    weekPlanDesigner: { VERSION: 'week-plan-designer@1' },
    weekPlanPolicy: { VERSION: 'week-plan-policy@1' },
    loadProfile: { VERSION: 'load-profile@1' },
    planVariants: { VERSION: 'plan-variants@1' },
    performanceZones: { VERSION: 'performance-zones@1' },
    featureFlags: { VERSION: 'feature-flags@1' }
  });
  ok('vollständige Registry liefert keine absent-Einträge',
    !Object.keys(vFull).some(k => vFull[k] === 'absent'),
    Object.keys(vFull).filter(k => vFull[k] === 'absent').join(','));
  ok('absent und vorhanden ergeben verschiedene Runtime-Hashes',
    DL.runtimeHash(v) !== DL.runtimeHash(vFull));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Reinheit des Moduls');
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(join(APP, 'js/engine/decision-log.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok('kein DOM-Zugriff', !/\bdocument\.|\bwindow\.(?!ORVIA)/.test(src));
  ok('kein direkter Uhrzugriff', !/new Date\(|Date\.now\(/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Storage-Zugriff', !/localStorage|sessionStorage|indexedDB/.test(src));
  ok('kein Netzzugriff', !/fetch\(|XMLHttpRequest|supabase/i.test(src));
  ok('Ringpuffer ist gedeckelt', /LOCAL_RING\s*=\s*\d+/.test(src));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Ringpuffer');
{
  DL.clear(); DL.setSink(() => true);
  for (let i = 0; i < DL.LOCAL_RING + 50; i++) DL.logDecision(baseOpts({ decisionId: 'r' + i }));
  ok('Ringpuffer wächst nicht über die Grenze', DL.recent().length === DL.LOCAL_RING, 'ist ' + DL.recent().length);
  ok('die jüngsten Einträge bleiben erhalten',
    DL.recent(1)[0].decisionId === 'r' + (DL.LOCAL_RING + 49));
  DL.clear(); DL.setSink(null);
  ok('clear() leert den Puffer', DL.recent().length === 0);
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
