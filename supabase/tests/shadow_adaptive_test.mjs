/* ORVIA · Shadow Mode (C1 → C2 → Stufe 5 im Schattenbetrieb)

   Geprüft werden die acht technischen Zusagen — jede als Test, nicht als
   Kommentar:
     S1 Shadow an/aus erzeugt byte-identische ausgelieferte Pläne
     S2 Fehler, Timeout oder fehlende Daten verändern den Plan nicht
     S3 Alte und adaptive Berechnung nutzen denselben eingefrorenen Snapshot
     S4 Jeder Vergleich enthält Cache-Key, Audit-Hash und alle Versionen
     S5 Wiederholte Läufe erzeugen keine irreführenden Dubletten
     S6 provisionalTargetLoad und autoApplicable:false bleiben beobachtend
     S7 Abweichungen strukturiert: Menge, Intensität, Frequenz, Scope, Begründung
     S8 Die acht Fallkriterien entscheiden, nicht die Kalenderzeit

   node supabase/tests/shadow_adaptive_test.mjs [appRoot-absolut] */
import { existsSync, readFileSync } from 'node:fs';
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

require(join(APP, 'js/engine/evidence.js'));
require(join(APP, 'js/engine/load-profile.js'));
const LH = require(join(APP, 'js/engine/load-history.js'));
const PR = require(join(APP, 'js/engine/progression.js'));
const GF = require(join(APP, 'js/engine/goal-feasibility.js'));
const DL = require(join(APP, 'js/engine/decision-log.js'));
const S = require(join(APP, 'js/engine/shadow-adaptive.js'));

/* Ein realistischer Eingang: 28 Tage geloggte Läufe, ein Ziel, ein Leistungswert. */
function tage(n, kmProTag = 10, ab = '2026-07-11') {
  const out = [];
  const d0 = new Date(ab + 'T12:00:00Z');
  for (let i = 0; i < n; i++) {
    const d = new Date(d0.getTime() + i * 86400000).toISOString().slice(0, 10);
    out.push({ id: 'a' + i, localDate: d, sport: 'running', subType: 'easy',
      durationMin: kmProTag * 6, distanceKm: kmProTag, source: 'test' });
  }
  return out;
}
const ROH = (o = {}) => Object.assign({
  weekId: '2026-W32', planId: 'p1', today: '2026-08-07',
  currentPlan: [[], [{ t: 'Laufen' }], [], [{ t: 'Laufen' }], [], [{ t: 'Laufen' }], []],
  activities: tage(28), debriefs: [], sports: ['running'],
  goal: { targetValue: 285 }, targetDate: '2026-11-06', level: 'intermediate',
  currentPerformance: { metric: 'thresholdPaceSecPerKm', value: 300, evidence: 'strong', ageRatio: 0.2 },
  weeksLeft: null,
  /* @10: die Produktions-Verdrahtung liefert IMMER die Eingangs-Herkunft —
     ohne vollstaendige Basis schliesst das Abnahme-Gate reale Läufe aus. */
  inputHash: 'cafe0123', inputVersion: 'observer-input@5',
  inputBasis: { activities: 'provided', debriefs: 'provided', goal: 'provided',
    performance: 'provided', checkins: 'provided', profileConstraints: 'provided' }
}, o);

/* ══════════════════════════════════════════════════════════════ */
sec('S1 · Shadow an/aus ⇒ byte-identische Pläne');
{
  /* Der Plan wird VOR der Beobachtung fertiggestellt und dieser übergeben.
     Byte-Identität ist deshalb keine Absprache, sondern Bauart: Es gibt
     keinen Rückgabepfad, über den eine Planänderung entstehen könnte. */
  const plan = [[], [{ t: 'Laufen', km: 8 }], [], [{ t: 'Rad' }], [], [{ t: 'Laufen', km: 14 }], []];
  const ohne = JSON.stringify(plan);
  const snap = S.snapshot(ROH({ currentPlan: plan }));
  const obs = S.observe(snap);
  ok('der Plan ist nach dem Schattenlauf byte-identisch', JSON.stringify(plan) === ohne);
  ok('… und die Beobachtung gibt keinen Plan zurück',
    obs.plan === undefined && obs.days === undefined && obs.week === undefined);
  ok('… sie führt planMutation none', obs.planMutation === 'none');
  ok('… applied ist immer false', obs.applied === false && obs.observationOnly === true);
  ok('… und der Modus ist eine Konstante, kein Schalter', S.MODE === 'shadow' && obs.mode === 'shadow');

  /* Auch der eingefrorene Snapshot bleibt unberührt — er ist derselbe Eingang,
     den der alte Zweig gesehen hat. */
  const vorher = JSON.stringify(snap);
  S.observe(snap); S.observe(snap);
  ok('mehrfaches Beobachten verändert den Snapshot nicht', JSON.stringify(snap) === vorher);

  /* DIE AUFRUFSTELLE: Die Beobachtung steht nach der Planberechnung und weist
     dem Plan nichts zu. Quelltextprüfung, weil genau hier eine spätere Änderung
     die Zusage still aufheben könnte. */
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  const i = ui.indexOf('ORVIA.logWeekShadow({');
  ok('die Aufrufstelle existiert', i > 0);
  /* DIE EIGENTLICHE ZUSAGE: Der Rueckgabewert wird NIRGENDS verwendet. Ein
     Fensterausschnitt um den Aufruf herum waere zu grob — er trifft die naechste
     Funktion mit. Geprüft wird deshalb die ganze Datei auf jede Zuweisung. */
  ok('der Rückgabewert wird nirgends zugewiesen',
    !/[^=!<>]=\s*(window\.)?(ORVIA|O)\.logWeekShadow\s*\(/.test(ui));
  /* Und die Funktion gibt selbst weder Plan noch Beobachtung zurück. Geprüft
     auf dem Definitionsblock, nicht auf einem Zeichenfenster: Die injizierte
     Uhr enthält ein legitimes `return Date.now()`, das eine grobe Prüfung
     fälschlich getroffen hätte. */
  const defA = ui.indexOf('O.logWeekShadow=function');
  const defB = ui.indexOf('O.shadowAcceptance=function');
  ok('der Definitionsblock ist auffindbar', defA > 0 && defB > defA);
  const def = ui.slice(defA, defB);
  ok('… und die Funktion gibt weder Plan noch Beobachtung zurück',
    !/return\s+(obs|snap|w|plan|currentPlan)\b/.test(def));
  ok('… ihr gesamter Rumpf liegt im try/catch', /try\{[\s\S]*\}catch\(_\)\{\s*\}/.test(def));
  if (i > 0) {
    const call = ui.slice(i, ui.indexOf('});', i) + 3);
    ok('der Aufruf übergibt den fertigen Plan als Vergleichsgröße',
      /currentPlan\s*:\s*w\b/.test(call), call.slice(0, 60));
    ok('… und weist dem Wochenplan im Aufruf nichts zu', !/\bw\s*=[^=]/.test(call));
    ok('… er liegt in einer Schutzhülle', /if\(window\.ORVIA&&ORVIA\.logWeekShadow\)/.test(ui));
  }

  /* BETRIEBSDETAILS DER PRODUKTIONSVERDRAHTUNG. try/catch schützt den Plan,
     aber nicht die Flüssigkeit der Oberfläche — und ein Budget, das nur im
     Test übergeben wird, schützt gar nichts. Deshalb hier als Vertrag: */
  const defA2 = ui.indexOf('O.logWeekShadow=function');
  const defB2 = ui.indexOf('O.shadowAcceptance=function');
  const def2 = ui.slice(defA2, defB2);
  ok('die Produktionsverdrahtung übergibt IMMER eine Uhr',
    /now\s*:\s*function\(\)\{return Date\.now\(\);\}/.test(def2));
  ok('… und IMMER ein Zeitbudget', /budgetMs\s*:\s*\d+/.test(def2));
  /* GEPRÜFT WIRD DER AUFRUF, NICHT DER KOMMENTAR. Eine Regex auf
     `requestIdleCallback` irgendwo im Block traf die Prosa daneben — die
     Verzögerung konnte entfernt werden, solange der Kommentar blieb
     (Mutationsprobe M11). Anker ist deshalb der tatsächliche Aufruf
     `_defer(function(){`, und die Definition von `_defer` muss beide
     Mechanismen als CODE enthalten. */
  const deferDef = def2.match(/var _defer=\(typeof requestIdleCallback==='function'\)[\s\S]{0,200}?setTimeout\(f,0\)/);
  ok('die Verzögerung ist als Code definiert, nicht nur erwähnt', !!deferDef);
  const deferCall = def2.indexOf('_defer(function(){');
  ok('… und wird tatsächlich aufgerufen', deferCall > 0);
  ok('… der Snapshot entsteht dagegen SYNCHRON, vor der Verzögerung',
    def2.indexOf('SA.snapshot') >= 0 && def2.indexOf('SA.snapshot') < deferCall,
    'Snapshot muss den Zustand des Plan-Ticks einfrieren');
  /* Gesucht wird der AUFRUF `SA.observe(snap`, nicht die Erwähnung — die
     Existenzprüfung am Funktionskopf nennt `SA.observe` ebenfalls. */
  ok('… und observe() liegt IN der verzögerten Funktion',
    deferCall > 0 && deferCall < def2.indexOf('SA.observe(snap'));
  ok('… der Nutzer steht im Snapshot', /userId\s*:\s*\(O\.user&&O\.user\.id\)/.test(def2));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S2 · Fehler, Timeout und fehlende Daten ändern nichts');
{
  const snap = S.snapshot(ROH());
  const werfen = { VERSION: 'x@1', buildHistory() { throw new Error('kaputt'); } };

  /* Jede Stufe einzeln zum Werfen gebracht — keine darf nach außen wirken. */
  const faelle = [
    ['C1 wirft', { loadHistory: werfen, progression: PR, goalFeasibility: GF }],
    ['C2 wirft', { loadHistory: LH, progression: { VERSION: 'x@1', progressionDecision() { throw new Error('kaputt'); } }, goalFeasibility: GF }],
    ['Stufe 5 wirft', { loadHistory: LH, progression: PR, goalFeasibility: { VERSION: 'x@1', feasibility() { throw new Error('kaputt'); } } }],
    ['C1 fehlt ganz', { progression: PR, goalFeasibility: GF }],
    ['alle fehlen', {}]
  ];
  faelle.forEach(([n, reg]) => {
    let geworfen = null, obs = null;
    try { obs = S.observe(snap, { registry: reg }); } catch (e) { geworfen = e.message; }
    ok(n + ' ⇒ keine Ausnahme nach außen', geworfen === null, geworfen || '');
    ok('… und ein benannter Status statt eines stillen Erfolgs',
      obs && (obs.status === 'failed' || obs.status === 'partial'), obs ? obs.status : '—');
    ok('… und der Plan bleibt unangetastet', obs && obs.planMutation === 'none' && obs.applied === false);
  });
  ok('der Grund des Fehlschlags wird benannt, nicht verschluckt',
    S.observe(snap, { registry: faelle[0][1] }).stages.c1.reason === 'kaputt');

  /* Ein Fehlschlag in C1 darf die Folgestufen nicht mit erfundenen Daten
     füttern — sie laufen mit null und melden das ehrlich. */
  const kaputt = S.observe(snap, { registry: faelle[0][1] });
  ok('eine gefallene Stufe erzeugt keine Ersatzdaten', kaputt.history === null);

  /* ZEITBUDGET mit INJIZIERTER Uhr: keine eigene Uhr im Modul. */
  let t = 0;
  const langsam = S.observe(snap, { now: () => (t += 50), budgetMs: 60 });
  ok('überschrittenes Budget bricht ab statt zu erzwingen',
    langsam.abortReason === 'budget_exceeded', String(langsam.abortReason));
  ok('… die abgebrochenen Stufen sind als skipped gekennzeichnet',
    [langsam.stages.c1, langsam.stages.c2, langsam.stages.s5].some(s => s.status === 'skipped'));
  ok('… und auch dann bleibt der Plan unverändert',
    langsam.planMutation === 'none' && langsam.applied === false);
  ok('ohne Uhr gibt es kein Budget — dafür volle Determinismus',
    S.observe(snap, { budgetMs: 1 }).abortReason === null);

  /* Leere Daten sind kein Fehler, sondern ein Zustand. */
  const leer = S.observe(S.snapshot({ today: '2026-08-07' }));
  ok('leerer Eingang ⇒ Beobachtung ohne Ausnahme',
    ['ok', 'partial', 'failed'].indexOf(leer.status) >= 0, leer.status);
  ok('… und nichts wird angewendet', leer.applied === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('S3 · Ein eingefrorener Snapshot für beide Zweige');
{
  const roh = ROH();
  const snap = S.snapshot(roh);
  ok('der Snapshot trägt einen Hash', typeof snap.hash === 'string' && snap.hash.length === 8);
  ok('… und ist tief eingefroren',
    Object.isFrozen(snap) && Object.isFrozen(snap.activities) && Object.isFrozen(snap.activities[0]));

  /* Ein Schreibversuch muss auffallen, statt still zu wirken. */
  let verhindert = false;
  try { 'use strict'; snap.today = '2099-01-01'; } catch (e) { verhindert = true; }
  ok('ein Schreibversuch wirkt nicht', verhindert || snap.today === '2026-08-07');

  /* Änderungen an der Rohquelle NACH dem Einfrieren dürfen die Beobachtung
     nicht mehr erreichen — sonst wäre eine Abweichung nicht mehr zuzuordnen. */
  const a = JSON.stringify(S.observe(snap).progression);
  roh.activities.push({ id: 'neu', localDate: '2026-08-06', sport: 'running', subType: 'vo2', durationMin: 90, source: 'test' });
  const b = JSON.stringify(S.observe(snap).progression);
  ok('spätere Änderungen an der Quelle erreichen den Snapshot nicht', a === b);
  ok('… ein NEUER Snapshot sieht sie dagegen sehr wohl',
    S.snapshot(roh).hash !== snap.hash);

  /* Gleicher Inhalt ⇒ gleicher Hash, unabhängig von der Objektidentität. */
  ok('gleicher Inhalt ⇒ gleicher Snapshot-Hash', S.snapshot(ROH()).hash === S.snapshot(ROH()).hash);
  ok('… jede inhaltliche Änderung ⇒ anderer Hash',
    S.snapshot(ROH({ today: '2026-08-08' })).hash !== snap.hash);
}

/* ══════════════════════════════════════════════════════════════ */
sec('S4 · Jeder Vergleich trägt Hashes und Versionen');
{
  const obs = S.observe(S.snapshot(ROH()));
  ok('Snapshot-Hash vorhanden', typeof obs.hashes.snapshot === 'string');
  ok('Cache-Key aus Stufe 5 vorhanden', typeof obs.hashes.cacheKey === 'string', String(obs.hashes.cacheKey));
  ok('Audit-Hash vorhanden', typeof obs.hashes.auditHash === 'string', String(obs.hashes.auditHash));
  ok('… und beide sind nicht derselbe Wert', obs.hashes.cacheKey !== obs.hashes.auditHash);
  ok('der Cache-Key ist derselbe, den Stufe 5 selbst führt',
    obs.hashes.cacheKey === obs.feasibility.cacheKey);

  const v = obs.versions;
  ['shadow', 'shadowPolicy', 'history', 'historyPolicy', 'progression', 'progressionPolicy',
    'feasibility', 'feasibilityPolicy', 'evidence'].forEach(k => {
      ok('Version geführt: ' + k, typeof v[k] === 'string' && v[k].length > 0, v[k]);
    });
  ok('die Versionen stimmen mit den geladenen Modulen überein',
    v.progression === PR.VERSION && v.feasibility === GF.VERSION && v.history === LH.VERSION);
  ok('ein fehlendes Modul wird als „absent" geführt, nicht weggelassen',
    S.observe(S.snapshot(ROH()), { registry: { progression: PR, goalFeasibility: GF } }).versions.history !== undefined);

  /* Der Log-Eintrag transportiert alles davon weiter. */
  const e = S.toLogEntry(obs, { decisionId: 'd1', timestamp: '2026-08-07T10:00:00Z' });
  ok('der Log-Eintrag ist vom Typ shadow_observation', e.decisionType === 'shadow_observation');
  ok('… der Typ ist im Decision Log bekannt', DL.TYPES.indexOf('shadow_observation') >= 0);
  ok('… und als Beobachtungstyp markiert', DL.OBSERVATION_TYPES.indexOf('shadow_observation') >= 0);
  ok('… er trägt Hashes und Versionen',
    !!e.derivedState.hashes.cacheKey && !!e.derivedState.hashes.auditHash && !!e.derivedState.versions.progression);
  ok('… und hält planMutation none fest',
    e.derivedState.planMutation === 'none' && e.derivedState.applied === false);

  /* Der Eintrag muss vom Decision Log tatsächlich angenommen werden. */
  const built = DL.build(Object.assign({}, e, { timestamp: '2026-08-07T10:00:00Z', decisionId: 'd1' }));
  ok('das Decision Log nimmt den Eintrag an', built.valid === true, (built.errors || []).join(','));

  /* BEOBACHTUNGEN GEHÖREN NICHT IN DIE ERKLÄRUNG EINER WOCHE. */
  const recs = [built.record];
  const ex = DL.explain('2026-W32', recs, {});
  ok('explain() ignoriert Beobachtungen', ex.found === false, JSON.stringify(ex.reason || ex.found));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S5 · Wiederholte Läufe erzeugen keine Dubletten');
{
  const snap = S.snapshot(ROH());
  const a = S.observe(snap);
  const b = S.observe(snap, { seenKeys: [a.idempotencyKey] });
  ok('derselbe Snapshot ⇒ derselbe Idempotenzschlüssel', a.idempotencyKey === b.idempotencyKey);
  ok('der erste Lauf ist neu', a.novel === true && a.repeat === false);
  ok('der zweite ist als Wiederholung gekennzeichnet', b.repeat === true && b.novel === false);
  ok('ein anderer Snapshot ⇒ anderer Schlüssel',
    S.observe(S.snapshot(ROH({ today: '2026-08-08' }))).idempotencyKey !== a.idempotencyKey);
  /* DIE BEWERTUNGSIDENTITAET: Nutzer, Woche und Plan trennen Beobachtungen
     auch dann, wenn die Daten zufällig identisch sind. Zwei Nutzer mit
     denselben 28 Trainingstagen sind zwei Beobachtungen, nicht eine. */
  ok('ein anderer Nutzer ⇒ anderer Schlüssel',
    S.observe(S.snapshot(ROH({ userId: 'u1' }))).idempotencyKey !==
    S.observe(S.snapshot(ROH({ userId: 'u2' }))).idempotencyKey);
  ok('eine andere Woche ⇒ anderer Schlüssel',
    S.observe(S.snapshot(ROH({ weekId: '2026-W33' }))).idempotencyKey !== a.idempotencyKey);
  ok('ein anderer Plan ⇒ anderer Schlüssel',
    S.observe(S.snapshot(ROH({ planId: 'p2' }))).idempotencyKey !== a.idempotencyKey);
  /* DIE EXPLIZITE ZUSAGE, NICHT NUR DIE TRANSITIVE: userId, weekId und planId
     stehen als EIGENE Felder im Schlüssel — nicht nur im Snapshot-Hash. Geprüft
     mit handgebauten Beobachtungseingängen, deren Hash FESTGEHALTEN ist: Fiele
     eines der Felder aus der Schlüsselkomposition, wären diese Schlüssel gleich,
     obwohl Nutzer/Woche/Plan verschieden sind. Genau das passierte bei einem
     Snapshot-Umbau, der die Felder verlöre — und bliebe ohne diese Prüfung
     unbemerkt, weil der Hash es normalerweise mit abdeckt (Mutationsprobe M9). */
  const fix = { hash: 'ffffffff', today: '2026-08-07' };
  const kFix = x => S.observe(Object.assign({}, fix, x)).idempotencyKey;
  ok('userId wirkt auch bei identischem Snapshot-Hash',
    kFix({ userId: 'u1' }) !== kFix({ userId: 'u2' }));
  ok('weekId wirkt auch bei identischem Snapshot-Hash',
    kFix({ weekId: 'w1' }) !== kFix({ weekId: 'w2' }));
  ok('planId wirkt auch bei identischem Snapshot-Hash',
    kFix({ planId: 'p1' }) !== kFix({ planId: 'p2' }));
  ok('andere Vertragsversionen ⇒ anderer Schlüssel',
    S.observe(snap, { registry: { loadHistory: LH, progression: Object.assign({}, PR, { VERSION: 'progression@99' }), goalFeasibility: GF } })
      .idempotencyKey !== a.idempotencyKey);
  /* Set und Objekt als Speicher gesehener Schlüssel — beide müssen greifen. */
  ok('Set als Speicher funktioniert', S.observe(snap, { seenKeys: new Set([a.idempotencyKey]) }).repeat === true);

  /* UND DIE FOLGE DAVON: Dreimal gerendert zählt einmal. Sonst wäre die
     Fallabdeckung durch bloßes Neuladen erfüllbar. */
  const dreimal = [a, b, S.observe(snap, { seenKeys: [a.idempotencyKey] })];
  const acc = S.acceptance(dreimal);
  ok('drei identische Läufe zählen als eine Beobachtung',
    acc.observations === 1 && acc.records === 3 && acc.repeats === 2,
    acc.observations + '/' + acc.records);
}

/* ══════════════════════════════════════════════════════════════ */
sec('S6 · provisionalTargetLoad und autoApplicable:false bleiben beobachtend');
{
  const prov = { status: 'review', delta: 5, targetLoad: null, provisionalTargetLoad: 42.0,
    actionable: false, autoApplicable: false, allowableRange: { min: 0, max: 8 },
    selectionReason: 'adaptive_default', referenceLoad: 40, rationale: 'x',
    dimensionPolicy: { volumeDelta: 5, intensityPolicy: 'hold', frequencyPolicy: 'hold',
      scope: { key: 'all', domain: null, sport: null, all: true } } };
  const d = S.deviationOf({}, prov, null);
  ok('eine provisorische Empfehlung ist nicht anwendbar', d.applicable === false);
  ok('… der Sperrgrund wird benannt',
    d.blocked.indexOf('provisional_only') >= 0 && d.blocked.indexOf('not_auto_applicable') >= 0,
    d.blocked.join(','));
  ok('… sie erscheint trotzdem im Vergleich, als provisorisch markiert',
    d.volume.provisionalLoad === 42.0 && d.volume.isProvisional === true && d.volume.recommendedLoad === null);
  ok('… und wird nie angewendet', d.applied === false);
  ok('status review wird eigens vermerkt', d.blocked.indexOf('status_review') >= 0);

  /* DIE ASYMMETRIE BLEIBT: Eine Absenkung ist auch bei fehlender
     Handlungsfähigkeit sicher — sie zu blockieren wäre das Gegenteil von
     Sicherheit (der Plan bliebe auf dem alten Niveau stehen). */
  const senken = S.deviationOf({}, Object.assign({}, prov, { delta: -25, targetLoad: 30,
    provisionalTargetLoad: 30, actionable: false, autoApplicable: false }), null);
  ok('eine Absenkung bleibt grundsätzlich anwendbar', senken.applicable === true);
  ok('… und ist als Reduktion erkennbar', senken.volume.direction === 'reduce');
  const erhoehen = S.deviationOf({}, Object.assign({}, prov, { delta: 5, targetLoad: 42,
    actionable: false, autoApplicable: false }), null);
  ok('eine Erhöhung ohne Freigabe bleibt gesperrt', erhoehen.applicable === false);

  /* Goal Feasibility verändert keinen Korridor — auch nicht über diesen Weg. */
  const mitZiel = S.deviationOf({}, prov, { status: 'outside_modeled_corridor' });
  ok('die Machbarkeit steht daneben, nicht im Korridor',
    mitZiel.feasibilityInfluencesCorridor === false &&
    JSON.stringify(mitZiel.volume.allowableRange) === JSON.stringify({ min: 0, max: 8 }));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S7 · Abweichungen strukturiert: Menge, Intensität, Frequenz, Scope');
{
  const obs = S.observe(S.snapshot(ROH()));
  const d = obs.deviation;
  ok('die Abweichung ist vorhanden', !!d);
  ok('… mit getrennten Dimensionen',
    Object.prototype.hasOwnProperty.call(d, 'volume') &&
    Object.prototype.hasOwnProperty.call(d, 'intensity') &&
    Object.prototype.hasOwnProperty.call(d, 'frequency') &&
    Object.prototype.hasOwnProperty.call(d, 'scope'));
  ok('die Menge trägt Bezugsbasis, Korridor und Auswahlgrund',
    d.volume.referenceLoad !== undefined && d.volume.allowableRange !== undefined &&
    d.volume.selectionReason !== undefined);
  ok('… und ihre Einheit ist benannt', d.volume.unit === 'pct_of_reference');
  ok('… die Richtung ist explizit', ['increase', 'reduce', 'hold', 'unknown'].indexOf(d.volume.direction) >= 0);
  ok('eine Begründung liegt an', typeof d.rationale === 'string' && d.rationale.length > 5);

  /* EIN VOLUMENPROZENT IST KEINE AUSSAGE ÜBER INTENSITÄT — der C2-Vertrag
     bleibt auch im Schattenbetrieb erhalten. */
  const taper = S.observe(S.snapshot(ROH({ phase: 'taper' })));
  const td = taper.deviation;
  ok('Taper: Volumen und Intensität sind getrennte Felder',
    td.volume.deltaPct != null && td.intensity && td.intensity.policy != null,
    td.volume.deltaPct + ' / ' + (td.intensity && td.intensity.policy));
  ok('… die Intensitätspolitik ist kein Prozentwert', typeof td.intensity.policy === 'string');
  ok('… und die Frequenz hat ihre eigene', typeof td.frequency.policy === 'string');
  ok('… der Scope ist strukturiert, nie ein String',
    td.scope === null || (typeof td.scope === 'object' && 'key' in td.scope && 'all' in td.scope));

  /* Ein fehlender Scope wirkt NICHT global. */
  const ohneScope = S.deviationOf({}, { delta: 3, targetLoad: 41, actionable: true,
    autoApplicable: true, allowableRange: { min: 0, max: 8 }, dimensionPolicy: null }, null);
  ok('fehlender Scope ⇒ ausdrücklich unbekannt, nicht global',
    ohneScope.scope === null && ohneScope.blocked.indexOf('scope_unknown') >= 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('S8 · Die acht Fallkriterien entscheiden, nicht die Kalenderzeit');
{
  ok('acht Kriterien sind definiert', S.CRITERIA.length === 8, String(S.CRITERIA.length));
  const leer = S.acceptance([]);
  ok('ohne Beobachtungen ist nichts abgenommen', leer.accepted === false);
  ok('… und die offenen Punkte werden benannt', leer.open.length === 8);

  /* Eine Beobachtung erfüllt einige Bedingungen — aber KEINE Mindestfallzahl.
     Ein einzelner echter Normalfall nimmt nichts endgültig ab. */
  const eine = S.acceptance([S.observe(S.snapshot(ROH()))]);
  ok('ein einzelner Lauf reicht nicht', eine.accepted === false, eine.open.join(','));
  const fc1 = eine.criteria.find(c => c.id === 'full_chain');
  ok('… die vollständige Kette ist als EIN Fall registriert, aber nicht abgenommen',
    fc1.met === false && fc1.independentCases === 1 && fc1.minRealCases === 3,
    fc1.independentCases + '/' + fc1.minRealCases);
  ok('… und die Belegstärke steht an jedem Kriterium',
    eine.criteria.every(c => typeof c.independentCases === 'number' &&
      typeof c.realCases === 'number' && typeof c.fixtureCases === 'number' &&
      'firstObservedAt' in c && 'lastObservedAt' in c));

  /* Eine vollständige Abdeckung konstruiert — jetzt mit BELEGSTÄRKE: genug
     unabhängige echte Fälle je Kriterium, Wiederholungen für die
     Reproduzierbarkeit, Fixtures nur für die Sicherheitspfade. */
  const COHORT = S.currentCohort().versions;
  const B = (o = {}) => Object.assign({
    mode: 'shadow', planMutation: 'none', applied: false, status: 'ok',
    stages: { c1: { status: 'ok' }, c2: { status: 'ok' }, s5: { status: 'ok' } },
    idempotencyKey: 'k' + Math.round(o._i || 0),
    /* FALL-IDENTITAET: jede Beobachtung gehoert zu einer WOCHE. Ohne sie
       kollabiert alles fail-closed zu einem Fall — das prueft ein eigener
       Abschnitt unten. */
    userId: 'u-test', weekId: 'W' + Math.round(o._i || 0), planId: 'p' + Math.round(o._i || 0),
    /* @10: reale Beobachtungen der neuen Kohorte tragen IMMER eine
       vollstaendige Eingangsbasis — ohne sie schliesst das Gate aus. */
    inputBasis: { activities: 'provided', debriefs: 'provided', goal: 'provided',
      performance: 'provided', checkins: 'provided', profileConstraints: 'provided' },
    versions: Object.assign({}, COHORT),
    observedAt: '2026-08-0' + (1 + (Math.round(o._i || 0) % 7)) + 'T08:00:00Z',
    progression: { actionable: true },
    deviation: { wouldChangePlan: false, rationale: 'x',
      volume: { allowableRange: { min: 0, max: 8 }, referenceLoad: 40, selectionReason: 'adaptive_default' } },
    coverage: { feasibilityStatus: 'within_modeled_corridor', progressionStatus: 'ok',
      hasProvisional: false, autoApplicable: true, phase: null, interruptionReason: null,
      lowWeekReason: null, fixture: false }
  }, o);
  const cov = (o = {}) => Object.assign({}, B().coverage, o);
  const devPlanwirksam = { wouldChangePlan: true, rationale: 'Aufbau aus stabilem Verlauf',
    volume: { allowableRange: { min: 0, max: 8 }, referenceLoad: 40, selectionReason: 'adaptive_default' } };
  const echte = [
    B({ _i: 1 }),
    B({ _i: 2, coverage: cov({ feasibilityStatus: 'outside_modeled_corridor' }) }),
    B({ _i: 3, coverage: cov({ feasibilityStatus: 'insufficient_data' }) }),
    B({ _i: 4 }),
    B({ _i: 5 }),
    B({ _i: 6, deviation: devPlanwirksam }),
    B({ _i: 7, deviation: devPlanwirksam })
  ];
  const fixtures = [
    B({ _i: 14, coverage: cov({ progressionStatus: 'review', hasProvisional: true, fixture: true }) }),
    B({ _i: 15, coverage: cov({ phase: 'taper', fixture: true }) }),
    B({ _i: 16, coverage: cov({ phase: 'deload', fixture: true }) }),
    B({ _i: 17, coverage: cov({ interruptionReason: 'illness', fixture: true }) })
  ];
  /* Wiederholungen: dieselben Fälle noch einmal, identisch — nur so ist
     Reproduzierbarkeit überhaupt belegbar. */
  const wiederholungen = [echte[0], echte[1], echte[2]].map(b => JSON.parse(JSON.stringify(b)));
  const voll = [...echte, ...fixtures, ...wiederholungen];
  const acc = S.acceptance(voll);
  ok('vollständige Fallabdeckung mit Belegstärke ⇒ abgenommen', acc.accepted === true, acc.open.join(','));
  ok('… alle acht Kriterien sind einzeln ausgewiesen', acc.criteria.length === 8 && acc.met === 8);
  ok('… echte und Fixture-Belege werden getrennt gezählt',
    acc.realObservations === 7 && acc.fixtureObservations === 4,
    acc.realObservations + '/' + acc.fixtureObservations);
  ok('… jedes Kriterium nennt seine Belegbasis',
    acc.criteria.every(c => c.basis && typeof c.basis.real === 'number' &&
      ['real_only', 'real_and_fixture'].indexOf(c.basis.evaluatedOn) >= 0));
  ok('… Wiederholungen zählen als Wiederholungen, nicht als neue Fälle',
    acc.observations === 11 && acc.repeats === 3, acc.observations + '/' + acc.repeats);
  const repro = acc.criteria.find(c => c.id === 'reproducible');
  ok('… Reproduzierbarkeit belegen nur WIEDERHOLTE Fälle',
    repro.met === true && repro.independentCases === 3, String(repro.independentCases));
  ok('… und der Belegzeitraum ist ausgewiesen',
    repro.firstObservedAt != null && repro.lastObservedAt != null);

  /* OHNE WIEDERHOLUNGEN keine Reproduzierbarkeits-Abnahme — Stille ist kein
     Beleg. */
  const ohneWdh = S.acceptance([...echte, ...fixtures]);
  ok('ohne Wiederholungen bleibt „reproduzierbar" offen',
    ohneWdh.open.indexOf('reproducible') >= 0);
  /* MINDESTFALLZAHLEN: vier echte Normalfälle reichen nicht für fünf. */
  const zuWenig = S.acceptance([...echte.slice(0, 4), ...fixtures, ...wiederholungen]);
  ok('zu wenige echte Fälle ⇒ Mindestfallzahl greift',
    zuWenig.open.indexOf('plan_unchanged') >= 0 || zuWenig.open.indexOf('no_positive_without_auto') >= 0,
    zuWenig.open.join(','));

  /* FALL-IDENTITAET: fuenf Render DERSELBEN Woche mit leicht gewachsenen
     Daten (verschiedene Idempotenzschluessel!) sind EIN Fall — die
     Mindestfallzahl laesst sich nicht durch Neu-Rendern erfuellen. */
  const gleicheWoche = [1, 2, 3, 4, 5].map(n => B({ _i: 100 + n,
    weekId: 'W-fix', planId: 'p-fix', idempotencyKey: 'ik' + n }));
  const gw = S.acceptance([...gleicheWoche, ...fixtures]);
  const gwCrit = gw.criteria.find(c => c.id === 'plan_unchanged');
  ok('fünf Render derselben Woche zählen als EIN Fall',
    gwCrit.independentCases === 1 && gwCrit.met === false,
    gwCrit.independentCases + ' Fall/Fälle');
  ok('… caseKeyOf unterscheidet Wochen, nicht Snapshots',
    S.caseKeyOf({ userId: 'u', weekId: 'W1', planId: 'p' }) !==
    S.caseKeyOf({ userId: 'u', weekId: 'W2', planId: 'p' }) &&
    S.caseKeyOf({ userId: 'u', weekId: 'W1', planId: 'p', idempotencyKey: 'a' }) ===
    S.caseKeyOf({ userId: 'u', weekId: 'W1', planId: 'p', idempotencyKey: 'b' }));
  ok('… ohne bestimmbare Identität wird NICHT aufgebläht',
    S.caseKeyOf({}) === 'unidentified' && S.caseKeyOf({ idempotencyKey: 'x' }) === 'unidentified');
  /* Befund v8-290: Auch ein vorhandener Snapshot-Hash ist KEINE Fallidentität —
     er ändert sich mit jedem Datenzuwachs und bläht dieselbe Woche wieder zu
     mehreren „unabhängigen" Fällen auf. */
  ok('… auch ein Snapshot-Hash ersetzt keine Fallidentität',
    S.caseKeyOf({ userId: 'u', hashes: { snapshot: 'aaaa' } }) === 'unidentified' &&
    S.caseKeyOf({ userId: 'u', hashes: { snapshot: 'bbbb' } }) === 'unidentified');
  ok('… verschiedene Nutzer sind verschiedene Fälle',
    S.caseKeyOf({ userId: 'u1', weekId: 'W1' }) !== S.caseKeyOf({ userId: 'u2', weekId: 'W1' }));

  /* PARTIAL NIMMT KEINE FACHLICHEN ZUSTAENDE AB: Eine partial-Beobachtung
     mit (handkonstruiertem) Machbarkeitsstatus darf den fehlenden Zustand
     nicht beisteuern — die Stufe, die ihn berechnet, ist ja uebersprungen. */
  const ohneInsuff0 = voll.filter(b => b.coverage.feasibilityStatus !== 'insufficient_data');
  const partialInsuff = B({ _i: 200, status: 'partial',
    stages: { c1: { status: 'ok' }, c2: { status: 'ok' }, s5: { status: 'skipped' } },
    coverage: cov({ feasibilityStatus: 'insufficient_data' }) });
  const mitPartial = S.acceptance([...ohneInsuff0, partialInsuff]);
  ok('partial steuert keinen Machbarkeitszustand bei',
    mitPartial.open.indexOf('all_feasibility_states') >= 0);
  ok('… plan_unchanged gilt dagegen auch für partial (Nicht-Mutation)',
    mitPartial.criteria.find(c => c.id === 'plan_unchanged').met === true);

  /* REIHENFOLGE-UNABHAENGIGKEIT: Die absteigende Datenbankabfrage darf das
     Ergebnis nicht praegen. */
  ok('acceptance ist reihenfolgeunabhängig',
    JSON.stringify(S.acceptance([...voll].reverse())) === JSON.stringify(S.acceptance(voll)));

  /* DIE VERSIONSKOHORTE: Eine Beobachtung aus alten Vertragsversionen darf
     einen fehlenden Zustand NICHT beisteuern. */
  const ohneInsuff = voll.filter(b => b.coverage.feasibilityStatus !== 'insufficient_data');
  const alteVersion = B({ _i: 99, coverage: cov({ feasibilityStatus: 'insufficient_data' }),
    versions: Object.assign({}, COHORT, { feasibility: 'goal-feasibility@1' }) });
  const mitAlt = S.acceptance([...ohneInsuff, alteVersion]);
  ok('eine Beobachtung fremder Kohorte wird ausgeschlossen',
    mitAlt.excludedOtherCohort === 1 && mitAlt.accepted === false &&
    mitAlt.open.indexOf('all_feasibility_states') >= 0,
    'excluded=' + mitAlt.excludedOtherCohort + ' open=' + mitAlt.open.join(','));
  ok('… mit derselben Kohorte zählte sie dagegen',
    S.acceptance([...ohneInsuff, B({ _i: 99, coverage: cov({ feasibilityStatus: 'insufficient_data' }) }),
      JSON.parse(JSON.stringify(B({ _i: 99, coverage: cov({ feasibilityStatus: 'insufficient_data' }) })))]).accepted === true);
  /* PFLICHTQUELLEN (@9, Gians Gegenprobe): Drei formal gruene Beobachtungen
     mit activities:'unavailable' erfuellten full_chain vorher VOLLSTAENDIG —
     gruene Stufen ueber leeren Listen sind kein Beleg. plan_unchanged darf
     weiter zaehlen: Nichtmutation ist auch ohne Daten belegbar. */
  const ohneQuelle = [1, 2, 3].map(i => B({ _i: i,
    inputBasis: { activities: 'unavailable', debriefs: 'provided', goal: 'provided', performance: 'provided' } }));
  const gate = S.acceptance(ohneQuelle);
  const fcGate = gate.criteria.find(c => c.id === 'full_chain');
  const puGate = gate.criteria.find(c => c.id === 'plan_unchanged');
  ok('fehlende Pflichtquelle ⇒ full_chain zählt die Beobachtungen NICHT',
    fcGate.met === false && fcGate.realCases === 0,
    'met=' + fcGate.met + ' realCases=' + fcGate.realCases);
  ok('… plan_unchanged zählt sie WEITER (Nichtmutation ist datenfrei belegbar)',
    puGate.realCases === 3, 'realCases=' + puGate.realCases);
  ok('… und der Ausschluss wird AUSGEWIESEN', gate.excludedMissingSources === 3);
  /* FAIL-CLOSED (@10, Gians Gegenproben): ganz OHNE inputBasis und mit
     fehlenden Einzelfeldern (checkins/profileConstraints nicht 'provided')
     darf full_chain ebenfalls NICHT zaehlen. */
  const ohneBasis = [1, 2, 3].map(i => { const b = B({ _i: i }); delete b.inputBasis; return b; });
  ok('reale Beobachtung OHNE inputBasis ⇒ full_chain zählt sie NICHT (fail-closed)',
    S.acceptance(ohneBasis).criteria.find(c => c.id === 'full_chain').realCases === 0);
  const ohneCheckins = [1, 2, 3].map(i => B({ _i: i,
    inputBasis: { activities: 'provided', debriefs: 'provided', goal: 'provided',
      performance: 'provided', checkins: 'unavailable', profileConstraints: 'unavailable' } }));
  ok('checkins/profileConstraints sind PFLICHTQUELLEN — unavailable ⇒ ausgeschlossen',
    S.acceptance(ohneCheckins).criteria.find(c => c.id === 'full_chain').realCases === 0);
  const feldFehlt = [1, 2, 3].map(i => B({ _i: i,
    inputBasis: { activities: 'provided', debriefs: 'provided' } }));
  ok('ein FEHLENDES Basisfeld ist kein Freifahrtschein (exakt provided verlangt)',
    S.acceptance(feldFehlt).criteria.find(c => c.id === 'full_chain').realCases === 0);
  /* Dieselben Beobachtungen MIT vollstaendiger Basis zaehlen normal. */
  const mitQuelle = [1, 2, 3].map(i => B({ _i: i,
    inputBasis: { activities: 'provided', debriefs: 'provided', goal: 'provided',
      performance: 'provided', checkins: 'provided', profileConstraints: 'provided' } }));
  ok('mit vollständiger Basis zählen sie normal',
    S.acceptance(mitQuelle).criteria.find(c => c.id === 'full_chain').realCases === 3);

  ok('jede Kohortenversion ändert den Schlüssel',
    S.COHORT_FIELDS.every(f =>
      S.cohortOf(Object.assign({}, COHORT, { [f]: 'x@99' })).key !== S.cohortOf(COHORT).key));
  /* DER VOLLSTÄNDIGE ABNAHMEVERTRAG: alle End-to-End-Abhängigkeiten, nicht
     nur die vier Rechenmodule.
     v8-343: `source` fehlte hier, obwohl es seit shadow-adaptive@11 zur
     Kohorte gehört — aufgefallen durch eine Mutationsprobe, die das Feld aus
     COHORT_FIELDS entfernte und KEINE Zusicherung dafür rot bekam. Der Pin
     hätte den Wegfall zwar bemerkt, aber der Pin lässt sich bewusst neu
     setzen; dann wäre das fehlende Feld dauerhaft unbemerkt geblieben.
     Die Liste ist ab jetzt vollzählig — und die letzte Zusicherung hält sie
     vollzählig, ohne dass jemand daran denken muss. */
  const ERWARTETE_FELDER = ['shadow', 'shadowPolicy', 'history', 'historyPolicy', 'debrief',
    'evidence', 'loadProfile', 'progression', 'progressionPolicy', 'feasibility',
    'feasibilityPolicy', 'translator', 'translatorPolicy', 'designer', 'weekPolicy',
    'input', 'source'];
  ERWARTETE_FELDER.forEach(f => {
    ok('Kohortenfeld vorhanden: ' + f, S.COHORT_FIELDS.indexOf(f) >= 0);
  });
  ok('… und die Kohorte enthält KEIN Feld, das hier nicht steht (beide Listen vollzählig)',
    S.COHORT_FIELDS.every(f => ERWARTETE_FELDER.indexOf(f) >= 0) &&
    S.COHORT_FIELDS.length === ERWARTETE_FELDER.length,
    'Kohorte: ' + S.COHORT_FIELDS.length + ' Felder · erwartet: ' + ERWARTETE_FELDER.length);
  ok('… und die Beobachtung führt jede dieser Versionen',
    (() => { const v = S.observe(S.snapshot(ROH())).versions;
      return ['history', 'debrief', 'evidence', 'loadProfile', 'translator', 'designer', 'weekPolicy']
        .every(f => v[f] !== undefined); })());

  /* FIXTURES DÜRFEN DEN ALLTAG NICHT ABNEHMEN: Ein Satz, der NUR aus
     Fixtures besteht, erfüllt kein REQUIRE_REAL-Kriterium. */
  const nurFixtures = voll.map(b => { const c = JSON.parse(JSON.stringify(b)); c.coverage.fixture = true; return c; });
  const fxAcc = S.acceptance(nurFixtures);
  ok('nur Fixtures ⇒ kein Alltagskriterium erfüllt',
    S.REQUIRE_REAL.every(id => fxAcc.open.indexOf(id) >= 0),
    'offen: ' + fxAcc.open.join(','));
  ok('… die Sicherheitspfade dagegen schon',
    fxAcc.criteria.find(c => c.id === 'special_phases').met === true &&
    fxAcc.criteria.find(c => c.id === 'review_case').met === true);

  /* JEDES KRITERIUM EINZELN AUSGEHEBELT — sonst prüfte der Test nur, dass
     irgendetwas grün wird. */
  const weg = (mut) => { const c = voll.map(x => JSON.parse(JSON.stringify(x))); mut(c); return S.acceptance(c); };
  ok('K1 fällt, wenn ein Lauf etwas angewendet hätte',
    weg(c => { c[0].applied = true; }).open.indexOf('plan_unchanged') >= 0);
  ok('K2 fällt ohne vollständige Kette',
    weg(c => c.forEach(x => { x.stages.s5.status = 'failed'; })).open.indexOf('full_chain') >= 0);
  ok('K3 fällt, wenn ein Zustand nie vorkam',
    weg(c => { c[2].coverage.feasibilityStatus = 'within_modeled_corridor';
      c[13].coverage.feasibilityStatus = 'within_modeled_corridor'; })
      .open.indexOf('all_feasibility_states') >= 0);
  ok('K4 fällt ohne review-/provisorischen Fall',
    weg(c => { c[7].coverage.progressionStatus = 'ok'; c[7].coverage.hasProvisional = false; })
      .open.indexOf('review_case') >= 0);
  ok('K5 fällt, wenn Krankheit nie vorkam',
    weg(c => { c[10].coverage.interruptionReason = null; }).open.indexOf('special_phases') >= 0);
  ok('K6 fällt bei einer positiven Aussage ohne Freigabe',
    weg(c => { c[0].coverage.autoApplicable = false; c[0].progression.actionable = false; })
      .open.indexOf('no_positive_without_auto') >= 0);
  ok('K7 fällt bei einer planwirksamen Abweichung ohne Bezugsbasis',
    weg(c => { [c[0], c[11]].forEach(x => { x.deviation.wouldChangePlan = true;
      x.deviation.volume.referenceLoad = null; }); })
      .open.indexOf('deviation_explainable') >= 0);
  ok('K8 fällt bei widersprüchlichen Wiederholungen',
    weg(c => { const kopie = JSON.parse(JSON.stringify(c[0])); kopie.progression = { actionable: false }; c.push(kopie); })
      .open.indexOf('reproducible') >= 0);

  /* UND DIE ZUSAGE SELBST: Zeit ist kein Kriterium. */
  ok('kein Kriterium heißt „Zeit" oder „Tage"',
    !S.CRITERIA.some(id => /day|zeit|time|week/i.test(id)), S.CRITERIA.join(','));
  ok('… und der Hinweis sagt das ausdrücklich',
    /Zeit ist kein Abnahmekriterium/i.test(acc.note));
  /* Beliebig viele Läufe ohne Fallabdeckung nehmen nichts ab. */
  const vieleGleiche = [];
  for (let i = 0; i < 200; i++) vieleGleiche.push(B({ _i: i }));
  ok('200 ereignislose Läufe nehmen nichts ab', S.acceptance(vieleGleiche).accepted === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Purität, Robustheit, Einhängung');
{
  const src = readFileSync(join(APP, 'js/engine/shadow-adaptive.js'), 'utf8');
  ok('kein DOM-Zugriff', !/document\.|window\.|localStorage/.test(src));
  ok('keine eigene Uhr', !/Date\.now|new Date\(/.test(src));
  ok('kein Zufall', !/Math\.random/.test(src));
  ok('kein Netzwerk', !/fetch\(|XMLHttpRequest|supabase/.test(src));
  ok('kein Schreibpfad in den Plan',
    !/currentPlan\s*\[|\.days\s*=|plan\s*\[\s*\d+\s*\]\s*=/.test(src));

  const snap = S.snapshot(ROH());
  ok('gleiche Eingabe ⇒ gleiche Ausgabe',
    JSON.stringify(S.observe(snap)) === JSON.stringify(S.observe(snap)));

  let geworfen = null;
  [undefined, null, {}, { hash: 'x' }, S.snapshot({}), S.snapshot({ today: 'unlesbar' })]
    .forEach(x => { try { S.observe(x); } catch (e) { geworfen = e.message; } });
  ok('kein Eingang wirft', geworfen === null, geworfen || '');
  [undefined, null, [], [null], [{}]].forEach(x => {
    try { S.acceptance(x); } catch (e) { geworfen = 'acceptance: ' + e.message; }
  });
  ok('auch acceptance() wirft nie', geworfen === null, geworfen || '');

  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('Modul ist eingehängt', /js\/engine\/shadow-adaptive\.js/.test(html));
  ok('… nach goal-feasibility (es liest dessen Ergebnis)',
    html.indexOf('js/engine/goal-feasibility.js') < html.indexOf('js/engine/shadow-adaptive.js'));
  ok('Modul ist im Cache-Manifest', /engine\/shadow-adaptive\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
  ok('Modul ist in der Versionsdrift-Bewachung',
    /shadow-adaptive\.js/.test(readFileSync(join(HERE, 'module_version_drift_test.mjs'), 'utf8')));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Abnahme aus der persistierten Historie, nicht aus dem Tab');
{
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  const a = ui.indexOf('O.shadowAcceptance=function');
  ok('shadowAcceptance existiert', a > 0);
  const block = ui.slice(a, ui.indexOf('O.getAdaptiveExplanation=function'));
  ok('… liest zuerst die dauerhafte Historie',
    /engine_decision_log/.test(block) && /eq\('decision_type','shadow_observation'\)/.test(block));
  ok('… der lokale Ring ist nur der AUSGEWIESENE Notbehelf',
    /local_ring_fallback|local_ring_offline/.test(block) && /acc\.source=/.test(block));
  ok('… und die Kohortenprüfung läuft in acceptance(), nicht in der UI',
    /SA\.acceptance\((obs\.length\?obs:lokal|lokal),\{registry:O\}\)/.test(block) &&
    !/cohortOf|COHORT_FIELDS/.test(block));
  ok('… persistierte Einträge tragen die Versionen für die Kohorte',
    /versions:d\.versions/.test(ui));
  /* DER SORTIERFEHLER ALS VERTRAG: aufsteigend + Limit hätte die ÄLTESTEN 500
     geladen — irgendwann ausschließlich fremde Kohorten, die aktuellen
     unsichtbar. Neueste zuerst. */
  ok('… die 500er-Abfrage lädt die NEUESTEN Einträge',
    /order\('decided_at',\{ascending:false\}\)/.test(block) &&
    !/order\('decided_at',\{ascending:true\}\)/.test(block));
  /* Nutzertrennung im lokalen Notbehelf. */
  ok('… der lokale Ring filtert FAIL-CLOSED auf den aktuellen Nutzer',
    /uid!=null&&o2\.userId===uid/.test(block),
    'ohne eindeutigen Nutzer belegt der Ring nichts');
  ok('… und Beobachtungen tragen ihren Nutzer',
    /userId:d\.userId/.test(ui));
}

/* ══════════════════════════════════════════════════════════════ */
sec('DIE KOHORTE IST EINGEFROREN');
{
  /* Jede Aenderung an einem der 15 Kohortenvertraege setzt die Belegsammlung
     auf null — das ist der Vertrag, aber es darf NIE nebenbei passieren.
     Dieses Manifest pinnt die Kohorte; wer sie aendert, muss die Datei
     BEWUSST aktualisieren und weiss damit, dass die Sammlung neu beginnt. */
  const PIN = join(HERE, '_acceptance-cohort.json');
  const { writeFileSync } = await import('node:fs');
  require(join(APP, 'js/engine/performance-zones.js'));
  require(join(APP, 'js/engine/week-plan-designer.js'));
  require(join(APP, 'js/engine/week-plan-policy.js'));
  const reg = {
    loadHistory: require(join(APP, 'js/engine/load-history.js')),
    sessionDebrief: require(join(APP, 'js/engine/session-debrief.js')),
    evidence: require(join(APP, 'js/engine/evidence.js')),
    loadProfile: require(join(APP, 'js/engine/load-profile.js')),
    progression: PR, goalFeasibility: GF,
    planTranslator: require(join(APP, 'js/engine/plan-translator.js')),
    weekPlanDesigner: require(join(APP, 'js/engine/week-plan-designer.js')),
    weekPlanPolicy: require(join(APP, 'js/engine/week-plan-policy.js')),
    /* @7: der Eingangsadapter gehoert zum Abnahmevertrag. */
    observerInput: require(join(APP, 'js/engine/observer-input.js')),
    observerSource: require(join(APP, 'js/engine/observer-source.js'))
  };
  const jetzt = S.currentCohort(reg);
  ok('die Kohorte ist vollständig bestimmbar (kein „absent")',
    Object.values(jetzt.versions).every(v => v !== 'absent'),
    JSON.stringify(jetzt.versions));
  /* BEFUND 2026-08-13: Bis hierher galt „Datei fehlt → schreib sie neu und sei
     grün". Damit war der Weg, die Prüfung abzuschalten, identisch mit dem Weg,
     sie zu bestätigen — ein versehentlich gelöschtes Manifest (oder ein Lauf im
     anderen Layout, wo es nie lag) fror die Kohorte still neu ein und meldete
     einen Haken. Zwei Fehler in einer Zeile: das automatische Schreiben, und
     die FESTEN Werte darin — ein am 13.08. neu gesetzter Pin behauptete,
     seit dem 08.08. eingefroren zu sein.

     Ab jetzt fail-closed. Fehlt das Manifest, ist die Kohorte UNGEPRÜFT, und
     das ist rot. Neu einfrieren geht weiterhin, aber nur als ausdrückliche
     Ansage — und dann mit ehrlichem Datum und der Version, die wirklich
     ausgeliefert wird:

         ORVIA_REPIN_COHORT=2026-08-13 node supabase/tests/shadow_adaptive_test.mjs
  */
  const repin = (process.env.ORVIA_REPIN_COHORT || '').trim();
  if (!existsSync(PIN) && repin) {
    const swQuelle = readFileSync(join(APP, 'sw.js'), 'utf8');
    const swTreffer = swQuelle.match(/const C = 'orvia-(v8-\d+)'/);
    writeFileSync(PIN, JSON.stringify({ frozenAt: repin,
      appVersion: swTreffer ? swTreffer[1] : 'unbekannt',
      key: jetzt.key, versions: jetzt.versions }, null, 2));
    ok('Kohorte AUSDRÜCKLICH neu eingefroren — die Belegsammlung beginnt bei null',
      true, jetzt.key + ' (' + repin + ', ' + (swTreffer ? swTreffer[1] : 'Version unbekannt') + ')');
  } else if (!existsSync(PIN)) {
    ok('die eingefrorene Kohorte ist unverändert', false,
      'MANIFEST FEHLT (_acceptance-cohort.json) — die Kohorte ist ungeprüft. ' +
      'Ein fehlender Pin ist kein bestätigter Pin. Bewusst neu einfrieren: ' +
      'ORVIA_REPIN_COHORT=JJJJ-MM-TT node supabase/tests/shadow_adaptive_test.mjs');
  } else {
    const pin = JSON.parse(readFileSync(PIN, 'utf8'));
    ok('die eingefrorene Kohorte ist unverändert', pin.key === jetzt.key,
      pin.key === jetzt.key ? pin.key + ' (seit ' + pin.frozenAt + ')'
        : 'KOHORTENÄNDERUNG! Die Belegsammlung beginnt neu. Geändert: ' +
          Object.keys(jetzt.versions).filter(k => pin.versions[k] !== jetzt.versions[k])
            .map(k => k + ': ' + pin.versions[k] + ' → ' + jetzt.versions[k]).join(', ') +
          ' — bewusst bestätigen: Datei löschen und mit ORVIA_REPIN_COHORT=JJJJ-MM-TT neu setzen');
  }
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
