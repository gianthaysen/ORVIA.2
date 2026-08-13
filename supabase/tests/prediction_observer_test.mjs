/* ORVIA · Prediction Observer — Vorhersage und Kalibrierung als Messinstrument

   Geprüfte Invarianten:
   V1  Erwartung ≠ Vorhersage: getrennte Konzepte im Record
   V2  Keine Toleranz je Einheit — nur beobachtbare Größen
   V3  Eingefroren vor dem Ergebnis, unveränderlich, deterministische ID
   V4  Future Leakage wird fail-closed abgewiesen
   V5  Auflösung: scored/unresolved/superseded/not_comparable, mit Gründen;
       kein Debrief ist NIEMALS „nicht geschafft"
   V6  Append-only: Auswertung ist ein eigener Record, Vorhersage bleibt
   V7  Kalibrierung: nie über Modellversionen, nie unkontrolliert über
       Sportarten; jede Kennzahl mit Fallzahlen
   V8  Außerhalb der Kohorte: keines der 15 eingefrorenen Module berührt
   V9  Purität und Log-Integration (eigener Typ, von explain() ausgeschlossen)

   node supabase/tests/prediction_observer_test.mjs [appRoot-absolut] */
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

const P = require(join(APP, 'js/engine/prediction-observer.js'));
const DL = require(join(APP, 'js/engine/decision-log.js'));

const RX = (o = {}) => Object.assign({
  /* v8-309: sessionType gehoert in die Prescription — sie ist die EINZIGE
     autoritative Quelle fuer Hash UND Kalibrierungsgruppe. */
  prescriptionVersion: 'rx-7', sessionType: 'threshold',
  expectedRpe: 7, targetZone: 'threshold',
  expectedRpeEvidence: 'moderate', resolvedAt: '2026-08-07T06:00:00Z'
}, o);
const IN = (o = {}) => Object.assign({
  userId: 'u1', sessionId: 'ps:2026-08-08:0:intervalle', planId: 'p1', planRevision: 'r1',
  sport: 'running', sessionType: 'threshold',
  prescription: RX(), predictedAt: '2026-08-08T06:00:00Z',
  sessionStartAt: '2026-08-08T17:00:00Z'
}, o);
const DEBRIEF = (o = {}) => Object.assign({
  id: 'db1', userId: 'u1', sessionId: 'ps:2026-08-08:0:intervalle',
  planId: 'p1', planRevision: 'r1',
  /* v8-308: sportId gehoert zum Vergleichsvertrag — ohne ihn ist die
     Aufloesung not_comparable/sport_unknown (fail-closed, kein Default). */
  sportId: 'running',
  createdAt: '2026-08-08T18:00:00Z',
  snapshot: { prescriptionVersion: 'rx-7', sessionType: 'threshold', expectedRpe: 7,
    expectedRpeEvidence: 'moderate', targetZone: 'threshold' },
  rpe: 8, completed: true, zoneHit: 0.9
}, o);

/* ══════════════════════════════════════════════════════════════ */
sec('V1 · Erwartung ist nicht Vorhersage');
{
  const r = P.predict(IN());
  ok('die Vorhersage entsteht', r.ok === true);
  ok('die Erwartung steht als eigenes Konzept im Record',
    r.prescriptionExpectation.expectedRpe === 7 && r.prescriptionExpectation.evidence === 'moderate');
  ok('die Prognose ist davon getrennt',
    r.modelPrediction !== r.prescriptionExpectation && r.modelPrediction.rpeRange != null);
  ok('… als Band, nicht als Punkt',
    r.modelPrediction.rpeRange.max > r.modelPrediction.rpeRange.min,
    JSON.stringify(r.modelPrediction.rpeRange));
  ok('… mit Modellkennung und ehrlicher Selbstauskunft',
    r.modelPrediction.model === 'population_prior' &&
    r.modelPrediction.individualized === false &&
    r.modelPrediction.evidence === 'weak');
  ok('… und eigener Modellversion (trennt spätere Kalibrierungsgruppen)',
    r.modelVersion === 'prediction-model@1' && r.modelVersion !== r.version);
  ok('die Completion ist eine echte Wahrscheinlichkeit in (0,1)',
    r.modelPrediction.completionProbability > 0 && r.modelPrediction.completionProbability < 1);
  /* Schwächere Evidenz ⇒ breiteres Band — Unsicherheit wird nicht versteckt. */
  const schwach = P.predict(IN({ prescription: RX({ expectedRpeEvidence: 'weak' }) }));
  ok('schwächere Evidenz ⇒ breiteres RPE-Band',
    (schwach.modelPrediction.rpeRange.max - schwach.modelPrediction.rpeRange.min) >
    (r.modelPrediction.rpeRange.max - r.modelPrediction.rpeRange.min));
}

/* ══════════════════════════════════════════════════════════════ */
sec('V2 · Keine Toleranz je Einheit');
{
  const r = P.predict(IN());
  const s = JSON.stringify(r);
  ok('kein Toleranzfeld im Record', !/tolerance/i.test(s));
  ok('nur beobachtbare Größen werden prognostiziert',
    Object.keys(r.modelPrediction).sort().join(',') ===
    'assumptions,completionProbability,evidence,individualized,model,rpeRange,zoneHitRange');
  ok('jede Zahl trägt ihre Herkunft — Prior oder Policy-Annahme',
    r.modelPrediction.assumptions.completionProbability === 'population_prior' &&
    r.modelPrediction.assumptions.rpeBand === 'policy_assumption');
}

/* ══════════════════════════════════════════════════════════════ */
sec('V3 · Eingefroren, unveränderlich, deterministisch');
{
  const r = P.predict(IN());
  ok('der Record ist tief eingefroren',
    Object.isFrozen(r) && Object.isFrozen(r.modelPrediction) && Object.isFrozen(r.modelPrediction.rpeRange));
  ok('die Integrität ist nachrechenbar', P.verifyIntegrity(r) === true);
  const manipuliert = JSON.parse(JSON.stringify(r)); manipuliert.modelPrediction.rpeRange.max = 10;
  ok('eine Manipulation fällt beim Nachrechnen auf', P.verifyIntegrity(manipuliert) === false);

  ok('dieselbe Session + Revision + Modellversion ⇒ dieselbe ID',
    P.predict(IN()).predictionId === r.predictionId);
  ok('eine andere Planrevision ⇒ andere ID',
    P.predict(IN({ planRevision: 'r2' })).predictionId !== r.predictionId);
  ok('eine andere Session ⇒ andere ID',
    P.predict(IN({ sessionId: 'ps:andere' })).predictionId !== r.predictionId);
  ok('ein anderer Nutzer ⇒ andere ID',
    P.predict(IN({ userId: 'u2' })).predictionId !== r.predictionId);
  ok('gleiche Eingabe ⇒ byte-identischer Record',
    JSON.stringify(P.predict(IN())) === JSON.stringify(r));
}

/* ══════════════════════════════════════════════════════════════ */
sec('V4 · Future Leakage wird abgewiesen');
{
  ok('eine Prescription aus der Zukunft wird abgelehnt',
    P.predict(IN({ prescription: RX({ resolvedAt: '2026-08-08T07:00:00Z' }) })).ok === false);
  ok('… mit benannter Quelle',
    /future_leakage:prescription/.test(P.predict(IN({ prescription: RX({ resolvedAt: '2026-08-09T00:00:00Z' }) })).reason));
  ok('Zonendaten aus der Zukunft werden abgelehnt',
    P.predict(IN({ zonesMeasuredAt: '2026-08-08T12:00:00Z' })).ok === false);
  ok('jeder Eingangszeitstempel wird geprüft',
    P.predict(IN({ inputTimestamps: ['2026-08-07T10:00:00Z', '2026-08-08T06:00:01Z'] })).ok === false);
  ok('Eingänge VOR der Vorhersage sind zulässig',
    P.predict(IN({ inputTimestamps: ['2026-08-07T10:00:00Z'] })).ok === true);
  ok('ohne predictedAt keine Vorhersage', P.predict(IN({ predictedAt: null })).ok === false);
  /* UNLESBAR IST NICHT UNSCHULDIG (Befund 6): kein stilles Überspringen. */
  ok('unlesbarer Zeitstempel ⇒ abgelehnt, nicht ignoriert',
    P.predict(IN({ prescription: RX({ resolvedAt: 'kein-datum' }) })).reason === 'unreadable_timestamp:prescription.resolvedAt');
  ok('… auch in deklarierten Eingängen',
    /unreadable_timestamp|input_without_timestamp/.test(
      P.predict(IN({ inputs: [{ name: 'hrv', at: 'gestern' }] })).reason));
}

/* ══════════════════════════════════════════════════════════════ */
sec('V5 · Auflösung mit ehrlichen Zuständen');
{
  const p = P.predict(IN());
  const AT = { evaluatedAt: '2026-08-09T08:00:00Z' };

  const scored = P.resolve(p, DEBRIEF(), AT);
  ok('passendes Debrief ⇒ scored', scored.resolution === 'scored');
  ok('… mit Residuen je Dimension',
    scored.residuals.rpe != null && scored.residuals.completion != null && scored.residuals.zoneHit != null);
  ok('… RPE-Residuum gegen die Bandmitte, mit Abdeckung',
    scored.residuals.rpe.error === 1 && scored.residuals.rpe.inRange === true,
    JSON.stringify(scored.residuals.rpe));
  ok('… Brier je Fall aus echter Wahrscheinlichkeit',
    scored.residuals.completion.brier === Math.round(Math.pow(0.85 - 1, 2) * 100) / 100);
  ok('… und der Record trägt Modellversion und Gruppe',
    scored.predictionModelVersion === 'prediction-model@1' &&
    scored.sport === 'running' && scored.sessionType === 'threshold');

  /* GIANS P0 (v8-308): sessionType gehoert in den Vergleichsvertrag.
     Seine Gegenprobe: Tempo- und Threshold-Verordnung mit identischem
     expectedRpe/Evidenz/Zone hashten GLEICH (beide 0c77ef96) — eine
     Threshold-Einheit scorte als Tempo und haette die Kalibrierung
     verunreinigt, denn calibrate() trennt genau nach sessionType. */
  const rxT = { prescriptionVersion: 'v', sessionType: 'tempo', expectedRpe: 6.5,
    expectedRpeEvidence: 'weak', targetZone: null };
  ok('GEGENPROBE: Tempo- und Threshold-Verordnung hashen VERSCHIEDEN',
    P.prescriptionHashOf(rxT) !== P.prescriptionHashOf(Object.assign({}, rxT, { sessionType: 'threshold' })),
    P.prescriptionHashOf(rxT));
  ok('… ein Threshold-Debrief gegen die Tempo-Vorhersage ist not_comparable',
    (() => {
      const pT = P.predict(IN({ sessionType: 'tempo', prescription: RX({ sessionType: 'tempo' }) }));
      const r2 = P.resolve(pT, DEBRIEF({ snapshot: { prescriptionVersion: 'rx-7',
        sessionType: 'threshold', expectedRpe: 7, expectedRpeEvidence: 'moderate',
        targetZone: 'threshold' } }), AT);
      return r2.resolution === 'not_comparable' && r2.reason === 'prescription_mismatch';
    })());

  /* SPORT IST VERGLEICHSVERTRAG: die Occurrence bindet an den Slot, nicht
     an die Sportart — eine umgewidmete Einheit darf nicht scoren. */
  ok('ein Rad-Debrief gegen die Lauf-Vorhersage ist not_comparable/sport_mismatch',
    (() => { const r2 = P.resolve(p, DEBRIEF({ sportId: 'cycling' }), AT);
      return r2.resolution === 'not_comparable' && r2.reason === 'sport_mismatch'; })());
  ok('… Debrief ohne sportId: fail-closed sport_unknown, kein Default',
    (() => { const r2 = P.resolve(p, DEBRIEF({ sportId: null }), AT);
      return r2.resolution === 'not_comparable' && r2.reason === 'sport_unknown'; })());
  ok('… Vorhersage mit sport unknown: ebenso fail-closed',
    (() => { const pU = P.predict(IN({ sport: null }));
      const r2 = P.resolve(pU, DEBRIEF(), AT);
      return r2.resolution === 'not_comparable' && r2.reason === 'sport_unknown'; })());

  /* EINE QUELLE FUER DEN SESSIONTYP (v8-309, Gians P0 nach @6): der Typ
     stand im Hash, der Record las seine Kalibrierungsgruppe aber aus
     input.sessionType — prescription 'threshold' + input 'tempo' ergab
     scored in der Gruppe 'tempo'. Jetzt: Prescription autoritativ,
     Widerspruch und Fehlen fail-closed, kein Rueckfall auf 'unknown'. */
  ok('OHNE separaten Input uebernimmt der Record prescription.sessionType',
    (() => { const p2 = P.predict(IN({ sessionType: undefined }));
      return p2.ok === true && p2.sessionType === 'threshold'; })());
  ok('widerspruechlicher zweiter Typ wird abgewiesen: session_type_mismatch',
    (() => { const p2 = P.predict(IN({ sessionType: 'tempo' }));
      return p2.ok === false && p2.reason === 'session_type_mismatch'; })());
  ok('fehlender Prescription-Typ wird abgewiesen: no_prescription_session_type — kein stilles unknown',
    (() => { const p2 = P.predict(IN({ sessionType: undefined, prescription: RX({ sessionType: null }) }));
      return p2.ok === false && p2.reason === 'no_prescription_session_type'; })());

  /* KEIN DEBRIEF ⇒ UNRESOLVED — niemals ein Misserfolg. */
  const offen = P.resolve(p, null, AT);
  ok('kein Debrief ⇒ unresolved', offen.resolution === 'unresolved' && offen.reason === 'no_debrief');
  ok('… und nirgends ein Misserfolgs-Wort',
    !/fail|nicht geschafft|missed|verpasst/i.test(JSON.stringify(offen)));

  ok('neue Planrevision ⇒ superseded',
    P.resolve(p, DEBRIEF({ planRevision: 'r2' }), AT).resolution === 'superseded');
  ok('geänderte Prescription ⇒ not_comparable',
    P.resolve(p, DEBRIEF({ snapshot: { prescriptionVersion: 'rx-8', expectedRpe: 6, targetZone: 'tempo' } }), AT)
      .resolution === 'not_comparable');
  ok('fremder Nutzer ⇒ not_comparable',
    P.resolve(p, DEBRIEF({ userId: 'u2' }), AT).resolution === 'not_comparable');
  /* BEHAUPTETE IDENTITAET VOLLSTÄNDIG: fehlende Felder sind fail-closed —
     ein Debrief ohne Nutzer könnte jedem gehören. */
  ok('Debrief OHNE Nutzer ⇒ not_comparable',
    P.resolve(p, DEBRIEF({ userId: null }), AT).reason === 'debrief_user_unknown');
  ok('falscher Plan ⇒ not_comparable',
    P.resolve(p, DEBRIEF({ planId: 'p2' }), AT).reason === 'plan_mismatch');
  ok('Debrief OHNE Plan ⇒ not_comparable',
    P.resolve(p, DEBRIEF({ planId: null }), AT).reason === 'debrief_plan_unknown');
  ok('andere Session ⇒ not_comparable',
    P.resolve(p, DEBRIEF({ sessionId: 'ps:andere' }), AT).resolution === 'not_comparable');
  ok('Debrief VOR der Vorhersage ⇒ not_comparable (Zeitrichtung)',
    P.resolve(p, DEBRIEF({ createdAt: '2026-08-07T18:00:00Z' }), AT).resolution === 'not_comparable');
  const kaputtRec = Object.assign(JSON.parse(JSON.stringify(p)), { prescriptionHash: 'ffffffff' });
  const kaputtRes = P.resolve(kaputtRec, DEBRIEF(), AT);
  ok('veränderter Record ⇒ integrity_mismatch — ehrlich benannt, keine behauptete Manipulationssicherheit',
    P.resolve(JSON.parse(JSON.stringify(p)), DEBRIEF(), AT).resolution === 'scored' &&
    kaputtRes.resolution === 'not_comparable' && kaputtRes.reason === 'integrity_mismatch',
    kaputtRes.reason);
  ok('… und nirgends wird „tampered" behauptet',
    !/tampered/.test(JSON.stringify(kaputtRes)) &&
    !/tampered/.test(readFileSync(join(APP, 'js/engine/prediction-observer.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')));
  /* FEHLENDE Vorhersage ist KEIN Endzustand — predict() läuft verzögert. */
  const offen2 = P.resolve(null, DEBRIEF(), AT);
  ok('fehlende Vorhersage ⇒ pending, nicht endgültig',
    offen2.resolution === 'pending' && offen2.debriefId === 'db1', offen2.resolution);
  ok('Debrief ohne beobachtbare Größen ⇒ unresolved',
    P.resolve(p, DEBRIEF({ rpe: null, completed: null, zoneHit: null }), AT).resolution === 'unresolved');
}

/* ══════════════════════════════════════════════════════════════ */
sec('V6 · Append-only');
{
  const p = P.predict(IN());
  const vorher = JSON.stringify(p);
  const e = P.resolve(p, DEBRIEF(), { evaluatedAt: '2026-08-09T08:00:00Z' });
  ok('die Vorhersage bleibt byte-identisch', JSON.stringify(p) === vorher);
  ok('die Auswertung ist ein EIGENER Record',
    e !== p && e.predictionId === p.predictionId && e.evaluatedAt === '2026-08-09T08:00:00Z');
  ok('… und selbst eingefroren', Object.isFrozen(e) && Object.isFrozen(e.residuals || {}));
  ok('die Vorhersage enthält kein Ergebnisfeld',
    p.residuals === undefined && p.resolution === undefined && p.debriefId === undefined);
}

/* ══════════════════════════════════════════════════════════════ */
sec('V7 · Kalibrierung: Gruppen, nie Vermischung, immer Fallzahlen');
{
  const p1 = P.predict(IN());
  const evs = [
    P.resolve(p1, DEBRIEF(), { evaluatedAt: 't' }),
    P.resolve(p1, DEBRIEF({ rpe: 6 }), { evaluatedAt: 't' }),
    P.resolve(p1, null, { evaluatedAt: 't' }),
    P.resolve(p1, DEBRIEF({ planRevision: 'r2' }), { evaluatedAt: 't' })
  ];
  const c = P.calibrate(evs);
  ok('eine Gruppe für {Modell, Sport, Typ}', c.groups.length === 1);
  const g = c.groups[0];
  ok('… mit vollständigen Fallzahlen',
    g.counts.n === 4 && g.counts.scored === 2 && g.counts.unresolved === 1 && g.counts.superseded === 1,
    JSON.stringify(g.counts));
  ok('… Auflösungsquote ausgewiesen', g.resolutionRate === 0.5);
  /* pending zählt in n UND wird als eigener Zähler ausgewiesen — vorher war
     n:1 möglich, während alle Unterzähler null waren. */
  const mitPend = P.calibrate([...evs, P.resolve(null, DEBRIEF(), { evaluatedAt: 't' })]);
  const gp = mitPend.groups.find(x => x.counts.pending > 0) || mitPend.groups[0];
  ok('pending erscheint als eigener Zähler',
    mitPend.groups.reduce((a, x) => a + x.counts.pending, 0) === 1 &&
    mitPend.groups.every(x => x.counts.n === x.counts.scored + x.counts.unresolved +
      x.counts.pending + x.counts.superseded + x.counts.notComparable),
    JSON.stringify(gp.counts));
  ok('… RPE mit mittlerem Fehler und Intervallabdeckung',
    g.rpe.n === 2 && g.rpe.meanError != null && g.rpe.intervalCoverage != null);
  ok('… Completion mit Brier und Basisrate',
    g.completion.brier != null && g.completion.baseRate === 1);

  /* NIE ÜBER MODELLVERSIONEN HINWEG. */
  const fremd = JSON.parse(JSON.stringify(evs[0])); fremd.predictionModelVersion = 'prediction-model@2';
  const c2 = P.calibrate([...evs, fremd]);
  ok('eine zweite Modellversion ⇒ eine zweite Gruppe', c2.groups.length === 2);
  ok('… ohne gemeinsame Mittelung',
    c2.groups.every(x => x.modelVersion !== undefined) &&
    new Set(c2.groups.map(x => x.modelVersion)).size === 2);
  /* NIE UNKONTROLLIERT ÜBER SPORTARTEN. */
  const rad = JSON.parse(JSON.stringify(evs[0])); rad.sport = 'cycling';
  ok('eine zweite Sportart ⇒ eine eigene Gruppe',
    P.calibrate([...evs, rad]).groups.length === 2);
  const anderTyp = JSON.parse(JSON.stringify(evs[0])); anderTyp.sessionType = 'long';
  ok('ein zweiter Sessiontyp ⇒ eine eigene Gruppe',
    P.calibrate([...evs, anderTyp]).groups.length === 2);
  ok('die Kalibrierung hat keinen Rückkanal (reine Rückgabe)',
    /kein Rueckkanal/.test(c.note));
}

/* ══════════════════════════════════════════════════════════════ */
sec('V10 · Eine Vorhersage entsteht VOR dem Ereignis — wirklich');
{
  ok('nach Beginn der Einheit ⇒ abgelehnt',
    P.predict(IN({ predictedAt: '2026-08-08T17:30:00Z' })).reason === 'session_already_started');
  ok('exakt zum Start ⇒ abgelehnt (kein Grenzfall-Schlupf)',
    P.predict(IN({ predictedAt: '2026-08-08T17:00:00Z' })).ok === false);
  ok('bereits absolvierte Einheit ⇒ abgelehnt',
    P.predict(IN({ completedAt: '2026-08-08T18:00:00Z' })).reason === 'session_already_completed');
  ok('vorhandenes Debrief ⇒ abgelehnt',
    P.predict(IN({ debriefExists: true })).reason === 'session_already_debriefed');
  ok('gar kein Zeitbezug zur Einheit ⇒ abgelehnt, nicht still akzeptiert',
    P.predict(IN({ sessionStartAt: null })).reason === 'no_session_time_reference');
  /* Nur Tagesdatum: zulässig NUR VOR dem Tag — eine „Vorhersage" um 18 Uhr
     für denselben Tag ist nicht prüfbar vor dem Ereignis (Befund 5: die
     erste Fassung akzeptierte bis Tagesende, gegen den eigenen Kommentar). */
  const tag = P.predict(IN({ sessionStartAt: null, sessionDate: '2026-08-09' }));
  ok('nur Tagesdatum ⇒ zulässig mit day_level_only',
    tag.ok === true && tag.timingBasis === 'day_level_only');
  ok('… DERSELBE Tag ⇒ abgelehnt, auch morgens',
    P.predict(IN({ sessionStartAt: null, sessionDate: '2026-08-08' })).reason === 'predicted_on_or_after_session_day');
  ok('… nach dem Tag ⇒ abgelehnt',
    P.predict(IN({ sessionStartAt: null, sessionDate: '2026-08-07' })).reason === 'predicted_on_or_after_session_day');
  ok('verlässliche Startzeit wird als solche ausgewiesen',
    P.predict(IN()).timingBasis === 'verified_start_time');
}

/* ══════════════════════════════════════════════════════════════ */
sec('V11 · Zeittragende Eingänge sind deklarationspflichtig');
{
  ok('ein deklarierter Eingang ohne Zeitpunkt ⇒ abgelehnt — Modulregel, keine Aufruferentscheidung',
    P.predict(IN({ inputs: [{ name: 'hrv', at: null }] })).reason === 'input_without_timestamp:hrv');
  ok('… auch ohne Namen, mit Position benannt',
    P.predict(IN({ inputs: [{ at: '2026-08-07T10:00:00Z' }, {}] })).reason === 'input_without_timestamp:#1');
  ok('deklarierte Eingänge laufen durch die Leakage-Prüfung',
    /future_leakage:inputs\.hrv/.test(P.predict(IN({ inputs: [{ name: 'hrv', at: '2026-08-08T07:00:00Z' }] })).reason));
  ok('gültige Eingänge vor der Vorhersage ⇒ zulässig',
    P.predict(IN({ inputs: [{ name: 'hrv', at: '2026-08-07T22:00:00Z' }] })).ok === true);
}

/* ══════════════════════════════════════════════════════════════ */
sec('V12 · Reconciliation: predict und resolve dürfen sich überholen');
{
  const AT = { evaluatedAt: '2026-08-09T08:00:00Z' };
  const d = DEBRIEF({ planId: 'p1' });
  /* Das Debrief kam zuerst: pending. */
  const pend = P.resolve(null, d, AT);
  ok('Debrief vor der Vorhersage ⇒ pending mit Debrief-Verweis',
    pend.resolution === 'pending' && pend.debriefId === 'db1');

  /* Später existiert die Vorhersage — Reconciliation verbindet beide über
     die EXAKTE Kombination. */
  const pr = P.predict(IN());
  const rec = P.reconcile([pend], [pr], [d], AT);
  ok('die Reconciliation löst den Fall', rec.counts.resolved === 1 && rec.resolved[0].resolution === 'scored');
  ok('… und zählt ehrlich', rec.counts.input === 1 && rec.counts.stillPending === 0);

  /* Die exakte Kombination ist Pflicht: eine Vorhersage anderer Revision
     oder anderer Prescription verbindet NICHT. */
  const andereRev = P.predict(IN({ planRevision: 'r2' }));
  ok('andere Planrevision verbindet nicht',
    P.reconcile([pend], [andereRev], [d], AT).counts.stillPending === 1);
  const andereRx = P.predict(IN({ prescription: RX({ expectedRpe: 5 }) }));
  ok('andere Prescription verbindet nicht',
    P.reconcile([pend], [andereRx], [d], AT).counts.stillPending === 1);
  ok('fehlendes Debrief bleibt pending',
    P.reconcile([pend], [pr], [], AT).counts.stillPending === 1);
  ok('nur pending-Einträge werden angefasst',
    P.reconcile([P.resolve(pr, d, AT)], [pr], [d], AT).counts.input === 1 &&
    P.reconcile([P.resolve(pr, d, AT)], [pr], [d], AT).counts.resolved === 0);
  /* NACH EINEM MODELLWECHSEL bleibt ein alter Pending-Fall auflösbar: Die
     Modellversion kommt aus der VORHERSAGE, nie aus dem heute geladenen
     Modul (Befund 8). Simuliert über eine Vorhersage mit fremder Version. */
  const altModell = JSON.parse(JSON.stringify(pr));
  altModell.modelVersion = 'prediction-model@0';
  const recAlt = P.reconcile([pend], [altModell], [d], AT);
  ok('eine Vorhersage älterer Modellversion wird trotzdem verbunden',
    recAlt.counts.resolved === 1 &&
    recAlt.resolved[0].predictionModelVersion === 'prediction-model@0',
    JSON.stringify(recAlt.counts));

  ok('der Schlüssel umfasst alle sechs Felder',
    P.matchKey({ userId: 'u', sessionId: 's', planId: 'p', planRevision: 'r', prescriptionHash: 'h', modelVersion: 'm' }) !==
    P.matchKey({ userId: 'u', sessionId: 's', planId: 'p', planRevision: 'r', prescriptionHash: 'h2', modelVersion: 'm' }));
}

/* ══════════════════════════════════════════════════════════════ */
sec('V15 · Identität und Zeit sind vollständig fail-closed (Befunde 3+4+6)');
{
  const AT = { evaluatedAt: '2026-08-09T08:00:00Z' };
  /* Befund 3: Plan-Identität ist Pflicht — keine Vorhersage ohne Plan. */
  ok('ohne planId keine Vorhersage', P.predict(IN({ planId: null })).reason === 'no_plan_id');
  ok('ohne planRevision keine Vorhersage', P.predict(IN({ planRevision: null })).reason === 'no_plan_revision');
  ok('ein anderer Plan ⇒ andere predictionId',
    P.predict(IN({ planId: 'p2' })).predictionId !== P.predict(IN()).predictionId);
  ok('eine andere Prescription ⇒ andere predictionId',
    P.predict(IN({ prescription: RX({ expectedRpe: 5 }) })).predictionId !== P.predict(IN()).predictionId);

  /* Befund 4: vorhanden-aber-unlesbar ist nicht fehlend. */
  ok('completedAt "not-a-date" ⇒ abgelehnt, nicht als „nicht absolviert" gedeutet',
    P.predict(IN({ completedAt: 'not-a-date' })).reason === 'unreadable_timestamp:completedAt');
  ok('unlesbare Startzeit ⇒ abgelehnt, kein Rückfall auf Tagesbasis',
    P.predict(IN({ sessionStartAt: 'irgendwann' })).reason === 'unreadable_timestamp:sessionStartAt');
  const p = P.predict(IN());
  ok('Debrief mit unlesbarem createdAt ⇒ not_comparable',
    P.resolve(p, DEBRIEF({ createdAt: 'not-a-date' }), AT).reason === 'unreadable_timestamp:debrief.createdAt');
  ok('Debrief OHNE Zeit ⇒ not_comparable',
    P.resolve(p, DEBRIEF({ createdAt: null }), AT).reason === 'debrief_time_unknown');
  ok('Debrief ohne Revision ⇒ not_comparable, nicht superseded',
    P.resolve(p, DEBRIEF({ planRevision: null }), AT).reason === 'debrief_revision_unknown');

  /* Befund 6: Das MODELL deklariert seine Pflichteingänge, nicht der Aufrufer. */
  ok('jede Modellversion führt eine Pflichteingangs-Liste',
    Array.isArray(P.REQUIRED_INPUTS[P.MODEL_VERSION]));
  ok('prediction-model@1 ist ein reiner Prescription-Prior (keine Pflichteingänge)',
    P.REQUIRED_INPUTS['prediction-model@1'].length === 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('V13 · Die Prioren sind Vertrag, kein Laufzeitparameter');
{
  let veraendert = false;
  try { P.PRIOR.completionProbability = 0.1; veraendert = P.PRIOR.completionProbability === 0.1; }
  catch (e) { veraendert = false; }
  ok('PRIOR lässt sich zur Laufzeit nicht verändern',
    !veraendert && P.PRIOR.completionProbability === 0.85);
  try { P.PRIOR.rpeBand.weak = 99; } catch (e) {}
  ok('… auch nicht in der Tiefe', P.PRIOR.rpeBand.weak === 2.0);
  try { P.predict = function () { return { ok: true }; }; } catch (e) {}
  ok('… und die API selbst ist eingefroren', P.predict(IN({ userId: null })).ok === false);
  /* Befund: REQUIRED_INPUTS war zur Laufzeit erweiterbar — dieselbe
     Modellversion verhielt sich danach anders. Jetzt eingefroren: Eine andere
     Pflichtliste IST eine andere Modellversion. */
  try { P.REQUIRED_INPUTS['prediction-model@1'].push('hrv'); } catch (e) {}
  ok('REQUIRED_INPUTS ist unveränderbar',
    P.REQUIRED_INPUTS['prediction-model@1'].length === 0);
  try { P.REQUIRED_INPUTS['prediction-model@99'] = ['x']; } catch (e) {}
  ok('… auch keine neuen Modellversionen zur Laufzeit',
    P.REQUIRED_INPUTS['prediction-model@99'] === undefined);
  /* Und die Prognose rechnet nur aus der expliziten Modellsicht — der
     Quelltext-Vertrag dazu: */
  const src5 = readFileSync(join(APP, 'js/engine/prediction-observer.js'), 'utf8');
  ok('die Prognoserechnung liest aus modelView, nicht aus input',
    /var modelView = \{/.test(src5) && /modelView\.expectedRpe - band/.test(src5));
}

/* ══════════════════════════════════════════════════════════════ */
sec('V14 · Der ECHTE Debrief-Builder statt einer Ideal-Fixture');
{
  /* Die handgebaute DEBRIEF-Fixture hatte die Integrationslücken verdeckt:
     Der echte Speicherpfad lieferte weder id noch userId noch planRevision.
     Jetzt bauen die Tests ihr Debrief mit DERSELBEN Funktion, die produktiv
     schreibt (debrief-record@1), inklusive echtem C3-Urteil. */
  require(join(APP, 'js/engine/evidence.js'));
  require(join(APP, 'js/engine/load-profile.js'));
  const SD = require(join(APP, 'js/engine/session-debrief.js'));
  const DR = require(join(APP, 'js/engine/debrief-record.js'));

  const unit = { id: 'psg:3:0:intervalle', t: 'Laufen', l: 'Intervalle', d: '40 min' };
  const rec = DR.build({
    key: '2026-08-08|Laufen|Intervalle', date: '2026-08-08', unit,
    planned: { t: 'Laufen', l: 'Intervalle', d: '40 min', sportId: 'running', durationMin: 40 },
    actual: { durationMin: 38, completedAt: '2026-08-08T17:45:00Z' },
    zones: null, rpe: 8, pain: false,
    userId: 'u1', planId: 'p1', planRevision: 'r1',
    now: '2026-08-08T18:00:00Z', SD
  });
  ok('der kanonische Record trägt die volle Verbindungsidentität',
    rec.id === 'db:2026-08-08:psg:3:0:intervalle' && rec.userId === 'u1' &&
    rec.planId === 'p1' && rec.planRevision === 'r1' && rec.createdAt === '2026-08-08T18:00:00Z',
    JSON.stringify({ id: rec.id, u: rec.userId, p: rec.planId, r: rec.planRevision }));
  /* DIE OCCURRENCE NUTZT DIE BESTEHENDE APP-IDENTITAET po:<datum>:<templateId>
     (Plan-Actual-Link) — Datum + Template-ID sind gemeinsam eindeutig, auch
     bei zwei gleich benannten Einheiten am selben Tag. */
  ok('die Session-ID ist die po:-Occurrence (Datum + Template-ID)',
    rec.sessionId === 'po:2026-08-08:psg:3:0:intervalle' &&
    rec.sessionTemplateId === 'psg:3:0:intervalle' &&
    rec.sessionIdBasis === 'template_id');
  /* KOLLISIONSPROBE (Befund 2): zwei gleich benannte Einheiten am selben Tag
     mit verschiedenen Template-IDs ⇒ verschiedene Occurrences. */
  const zwilling1 = DR.occurrenceIdOf('2026-08-08', { id: 'psg:3:0:intervalle', t: 'Laufen', l: 'Intervalle' });
  const zwilling2 = DR.occurrenceIdOf('2026-08-08', { id: 'psg:3:1:intervalle', t: 'Laufen', l: 'Intervalle' });
  ok('zwei gleich benannte Einheiten am selben Tag kollidieren NICHT',
    zwilling1 !== zwilling2, zwilling1 + ' vs ' + zwilling2);
  ok('… ohne Template-ID wird die schwächere Basis AUSGEWIESEN',
    DR.occurrenceBasisOf({ t: 'Laufen', l: 'x' }) === 'label_fallback' &&
    DR.build({ key: 'k', date: '2026-08-08', unit: { t: 'Laufen', l: 'x' },
      rpe: 4, userId: 'u1', planId: 'p1', planRevision: 'r1',
      now: '2026-08-08T18:00:00Z', SD }).sessionIdBasis === 'label_fallback');
  ok('completed und completionPct stammen aus dem echten C3-Urteil',
    rec.completed === true && rec.completionPct === 0.95,
    rec.completed + '/' + rec.completionPct);
  ok('der Snapshot ist der echte C3-Snapshot',
    rec.snapshot && rec.snapshot.expectedRpe != null && rec.snapshot.expectedRpeEvidence != null);

  /* KEIN OUTCOME LEAKAGE: kopierte Ist-Dauer ohne Planquelle wird verworfen. */
  const unitOhnePlan = { id: 'psg:3:1:x', t: 'Laufen', l: 'Dauerlauf easy', d: 'iv' };
  const leak = DR.build({
    key: 'k', date: '2026-08-08', unit: unitOhnePlan,
    planned: { t: 'Laufen', l: 'Dauerlauf easy', sportId: 'running', durationMin: 62 },
    actual: { durationMin: 62 }, rpe: 4, pain: false,
    userId: 'u1', planId: 'p1', planRevision: 'r1', now: '2026-08-08T18:00:00Z', SD
  });
  ok('eine hineingekopierte Ist-Dauer wird verworfen — completionPct ist nicht konstruktionsbedingt 1',
    leak.completionPct !== 1 || leak.snapshot == null,
    'completionPct=' + leak.completionPct);
  ok('die Plandauer kommt nur aus einem echten Minutenfeld',
    DR.plannedDurationOf({ d: '45 min' }) === 45 && DR.plannedDurationOf({ d: 'iv' }) === null &&
    DR.plannedDurationOf({ d: '6:00 Uhr · ~900 m' }) === null);

  /* DIE VOLLE KETTE mit dem echten Record: predict → resolve ⇒ scored.
     v8-308: KEINE handkopierte Feldliste aus dem Snapshot mehr (die vierte
     ihrer Art — sie haette sessionType still verloren): die Prescription
     kommt aus SD.prescriptionOf, exakt wie im Produkt und im Live-Test. */
  const rx = SD.prescriptionOf(unit, { durationMin: DR.plannedDurationOf(unit), targetZone: null });
  const pr = P.predict({ userId: 'u1', sessionId: rec.sessionId, planId: 'p1', planRevision: 'r1',
    sport: 'running', sessionType: rx.sessionType, prescription: rx,
    predictedAt: '2026-08-07T20:00:00Z', sessionDate: '2026-08-08' });
  ok('die Vorhersage gegen die echte Prescription entsteht', pr.ok === true, pr.reason || '');
  const ev = P.resolve(pr, rec, { evaluatedAt: '2026-08-09T08:00:00Z' });
  ok('ECHTES Debrief + Vorhersage ⇒ scored', ev.resolution === 'scored', ev.resolution + '/' + (ev.reason || ''));
  ok('… mit RPE- und Completion-Residuum aus echten Werten',
    ev.residuals && ev.residuals.rpe != null && ev.residuals.completion != null);
  /* Und die Reconciliation findet den echten Record. */
  const pend2 = P.resolve(null, rec, { evaluatedAt: 't' });
  ok('… und die Reconciliation verbindet den echten Record',
    P.reconcile([pend2], [pr], [rec], { evaluatedAt: 't' }).counts.resolved === 1);
}

/* ══════════════════════════════════════════════════════════════ */
sec('V16 · Der SPEICHERPFAD dedupliziert nach Identität, nicht nach Label');
{
  /* BEFUND 3 (v8-290): Der Builder erzeugte laengst verschiedene po:-IDs,
     aber gmDbSave suchte den Vorgaenger weiter ueber Datum|Sport|Label —
     Zwillinge ueberschrieben sich IM PROFIL trotzdem. Die Dedup-Regel lebt
     jetzt als reine Funktion im Modul und wird hier als VERHALTEN geprueft. */
  require(join(APP, 'js/engine/evidence.js'));
  require(join(APP, 'js/engine/load-profile.js'));
  const SD = require(join(APP, 'js/engine/session-debrief.js'));
  const DR = require(join(APP, 'js/engine/debrief-record.js'));
  const mk = (tid, rpe) => DR.build({
    key: '2026-08-08|Laufen|Intervalle', date: '2026-08-08',
    unit: { id: tid, t: 'Laufen', l: 'Intervalle', d: '40 min' },
    planned: { t: 'Laufen', l: 'Intervalle', d: '40 min', sportId: 'running', durationMin: 40 },
    actual: { durationMin: 38, completedAt: '2026-08-08T17:45:00Z' },
    rpe, pain: false, userId: 'u1', planId: 'p1', planRevision: 'r1',
    now: '2026-08-08T18:00:00Z', SD });

  /* Zwillinge: gleicher Tag, gleiches Label, VERSCHIEDENE Template-IDs. */
  const st = [];
  DR.upsert(st, mk('psg:3:0:intervalle', 7));
  DR.upsert(st, mk('psg:3:1:intervalle', 9));
  ok('zwei Zwillinge landen als ZWEI Records im Store', st.length === 2, 'len=' + st.length);
  ok('… und behalten beide ihre eigenen Werte',
    st[0].rpe === 7 && st[1].rpe === 9 && st[0].id !== st[1].id);

  /* Idempotenz: derselbe Record erneut ⇒ ersetzt, kein Duplikat. */
  const r3 = DR.upsert(st, mk('psg:3:0:intervalle', 5));
  ok('erneutes Speichern DERSELBEN Occurrence ersetzt statt anzuhaengen',
    r3.replaced === true && st.length === 2 && st[0].rpe === 5);

  /* Legacy-Migration: Bestandsrecord OHNE ID wird ueber den Schluessel
     gefunden, EINMALIG migriert — danach greift die ID-Regel. */
  const st2 = [{ key: '2026-08-08|Laufen|Intervalle', rpe: 3, pain: false }];
  const r4 = DR.upsert(st2, mk('psg:3:0:intervalle', 8));
  ok('ein Alt-Record ohne ID wird per Schluessel migriert',
    r4.legacyMigrated === true && st2.length === 1 && st2[0].rpe === 8 && st2[0].id != null);
  DR.upsert(st2, mk('psg:3:1:intervalle', 6));
  ok('… und der migrierte Record schluckt den Zwilling danach NICHT mehr',
    st2.length === 2, 'len=' + st2.length);

  /* GANZHEITLICH, NICHT FELDWEISE (@4): Ein Altrecord MIT Urteil, dann ein
     neuer Build OHNE Urteil (kaputtes SD ⇒ judgeError) — der gespeicherte
     Record darf NICHT neues RPE mit altem Snapshot kombinieren. */
  const stC = [];
  DR.upsert(stC, mk('psg:3:0:intervalle', 7));
  ok('Vorbedingung: der erste Record trägt das echte C3-Urteil',
    stC[0].snapshot != null && stC[0].completionPct != null);
  const kaputt = DR.build({
    key: '2026-08-08|Laufen|Intervalle', date: '2026-08-08',
    unit: { id: 'psg:3:0:intervalle', t: 'Laufen', l: 'Intervalle', d: '40 min' },
    planned: { t: 'Laufen', l: 'Intervalle', d: '40 min', sportId: 'running', durationMin: 40 },
    actual: { durationMin: 38 }, rpe: 9, pain: false,
    userId: 'u1', planId: 'p1', planRevision: 'r1',
    now: '2026-08-08T19:00:00Z',
    SD: { debrief: function () { throw new Error('kaputt'); } } });
  DR.upsert(stC, kaputt);
  ok('ein Folge-Record OHNE Urteil hinterlässt KEINE Chimäre aus neuem RPE und altem Snapshot',
    stC.length === 1 && stC[0].rpe === 9 && stC[0].judgeError === true &&
    stC[0].snapshot === undefined && stC[0].completionPct === undefined,
    JSON.stringify({ rpe: stC[0].rpe, snap: stC[0].snapshot != null, cp: stC[0].completionPct }));

  /* Der LESEPFAD folgt derselben Identitaet: gmDbFind sucht zuerst die
     Occurrence-ID; bei template_id-Basis gibt es KEINEN Label-Rueckfall —
     sonst faende der Zwilling das Debrief seines Bruders als Prefill. */
  const uiSrc = readFileSync(join(APP, 'js/ui.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  const fnd = uiSrc.slice(uiSrc.indexOf('function gmDbFind'), uiSrc.indexOf('function gmOpenDebrief'));
  ok('gmDbFind sucht zuerst über die Occurrence-ID',
    /occurrenceIdOf\(dateIso,unit\)/.test(fnd) && /st\[j\]\.id===id/.test(fnd));
  ok('… und bricht bei template_id-Basis OHNE Label-Rückfall ab',
    /occurrenceBasisOf\(unit\)==='template_id'\)return null/.test(fnd));
  ok('gmDbSave dedupliziert über upsert, nicht mehr über das Label',
    /ORVIA\.debriefRecord\.upsert\(st,rec\)/.test(uiSrc));
  ok('… der Prefill-Aufruf übergibt Einheit und Datum',
    /gmDbFind\(key,unit,dateIso\)/.test(uiSrc));

  /* DAS DECISION LOG folgt derselben Identitaet: unique(user_id, decision_id)
     ist append-only — 'db:'+key kollidierte fuer Zwillinge UND fuer jedes
     erneute Speichern. Jetzt Occurrence-ID + Ereigniszeit. */
  ok('das Decision Log nutzt Occurrence-ID + Ereigniszeit, nicht mehr das Label',
    /decisionId:\(rec\.id\|\|\('db:'\+c\.key\)\)\+'@'\+\(rec\.debriefedAt/.test(uiSrc) &&
    !/decisionId:'db:'\+c\.key,/.test(uiSrc));

  /* BEFUNDE 2+4 (v8-290): Der LIVE-TEST selbst ist Vertragsgegenstand — er
     laeuft hier nicht (env-gesteuert), aber sein QUELLTEXT muss beweisen:
     (a) Inserts entstehen ueber DL.build() — mit decision_runtime_hash und
         decision_hash, die 0032 NOT NULL verlangt. Ein handgebauter Insert
         waere nach 0033 am NAECHSTEN Constraint gestorben.
     (b) resolve() rechnet mit der GESPEICHERTEN Vorhersage (SELECT vor
         resolve), nicht mit der In-Memory-Kopie — sonst testet der
         „Roundtrip" nur den Arbeitsspeicher. */
  const live = readFileSync(join(HERE, 'prediction_observer_live_test.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  /* v8-305: NICHT mehr die handgepflegte Abbildung fordern — genau die war
     der Befund (sie hatte parent/supersedes/week_id bereits verloren).
     Der Vertrag ist jetzt staerker: DL.build() UND die GEMEINSAME
     Spaltenabbildung DL.toRow(); eine eigene Spaltenzuweisung im Live-Test
     ist verboten. Verhaltensbeweis der Abbildung: decision_sink_test. */
  ok('der Live-Test baut seine Inserts über DL.build() + DL.toRow() — keine Eigenabbildung',
    /DL\.build\(\{/.test(live) &&
    /DL\.toRow\(built\.record/.test(live) &&
    !/decision_runtime_hash\s*:/.test(live) &&
    !/parent_decision_id\s*:/.test(live));
  ok('… und löst gegen die GELESENE Vorhersage auf, nicht die In-Memory-Kopie',
    /P\.resolve\(storedPred/.test(live) &&
    live.indexOf("eq('decision_type', 'prediction_record')") < live.indexOf('P.resolve(storedPred') &&
    /P\.verifyIntegrity\(storedPred\)/.test(live));
  ok('… und kalibriert aus dem ZURÜCKGELESENEN Auswertungsrecord',
    /backEval\s*&&\s*backEval\.derived_state/.test(live));
  /* v8-307 (Gians Live-Test-Befund): die handgebaute rx
     (rx-live/7/moderate/threshold) lief gegen den echten C3-Snapshot
     not_comparable und VERDECKTE den typeOf-Fehler. Der Live-Test muss
     seine Prescription aus der EINEN gemeinsamen Funktion beziehen —
     feste Werte im Test wuerden den naechsten Klassifikationsfehler
     wieder verstecken statt ihn zu finden. */
  ok('… und die Prescription kommt aus SD.prescriptionOf — keine handgebauten Werte',
    /SD\.prescriptionOf\(unit/.test(live) &&
    !/expectedRpe:\s*\d/.test(live) && !/prescriptionVersion:\s*'/.test(live));
  ok('… mit der Gegenprobe Intervalle+40min ⇒ vo2 als Abbruchbedingung',
    /sessionType !== 'vo2'/.test(live));
}

/* ══════════════════════════════════════════════════════════════ */
sec('V8 · Außerhalb der Kohorte');
{
  /* DIE ZUSAGE, DIE DIE PARALLELE ENTWICKLUNG ERLAUBT: Dieses Modul darf die
     eingefrorene Kohorte nicht berühren. Der Pin-Test wacht ohnehin — hier
     zusätzlich: Der Observer importiert kein Kohortenmodul. */
  const raw = readFileSync(join(APP, 'js/engine/prediction-observer.js'), 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein Import eines Kohortenmoduls',
    !/load-history|session-debrief|goal-feasibility|progression|plan-translator|shadow-adaptive|week-plan|load-profile|evidence\.js/.test(src));
  const pin = JSON.parse(readFileSync(join(HERE, '_acceptance-cohort.json'), 'utf8'));
  ok('die eingefrorene Kohorte kennt den Observer nicht',
    !JSON.stringify(pin.versions).includes('prediction'));
}

/* ══════════════════════════════════════════════════════════════ */
sec('V9 · Purität, Log-Integration, Einhängung');
{
  const raw = readFileSync(join(APP, 'js/engine/prediction-observer.js'), 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('kein DOM', !/document\.|window\.|localStorage/.test(src));
  ok('keine eigene Uhr', !/Date\.now|new Date\(/.test(src));
  ok('kein Zufall, kein Netz', !/Math\.random|fetch\(|supabase/.test(src));

  let geworfen = null;
  [undefined, null, {}, IN({ prescription: null }), IN({ userId: null })].forEach(x => {
    try { P.predict(x); } catch (e) { geworfen = e.message; }
  });
  [[null, null], [P.predict(IN()), {}], [P.predict(IN()), { snapshot: null }]].forEach(([a, b]) => {
    try { P.resolve(a, b, {}); } catch (e) { geworfen = 'resolve: ' + e.message; }
  });
  try { P.calibrate([null, {}, { resolution: 'scored' }]); } catch (e) { geworfen = 'cal: ' + e.message; }
  ok('kein Eingang wirft', geworfen === null, geworfen || '');

  /* Log-Typen: eigene, als Beobachtung markiert, von explain() ausgeschlossen. */
  ok('prediction_record ist ein bekannter Log-Typ', DL.TYPES.indexOf('prediction_record') >= 0);
  ok('prediction_evaluation ebenso', DL.TYPES.indexOf('prediction_evaluation') >= 0);
  ok('… beide sind Beobachtungstypen',
    DL.OBSERVATION_TYPES.indexOf('prediction_record') >= 0 &&
    DL.OBSERVATION_TYPES.indexOf('prediction_evaluation') >= 0);
  const rec = DL.build({ decisionType: 'prediction_record', decisionId: 'd1',
    timestamp: '2026-08-08T06:00:00Z', weekId: '2026-W32', derivedState: { x: 1 } });
  ok('das Log nimmt Vorhersagen an', rec.valid === true);
  ok('explain() ignoriert sie', DL.explain('2026-W32', [rec.record], {}).found === false);

  /* DAS 500er-FENSTER: Die Shadow-Abfrage filtert SERVERSEITIG vor dem Limit —
     Vorhersagen können die Shadow-Beobachtungen nicht verdrängen. */
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  const q = ui.indexOf("eq('decision_type','shadow_observation')");
  const l = ui.indexOf('.limit(500)');
  ok('der Typfilter steht VOR dem Limit in der Abfragekette', q > 0 && l > q);

  /* BEFUND 1: Der 0032-Constraint kannte die Beobachtungstypen nicht — jeder
     Insert scheiterte STILL. 0033 muss existieren und alle drei Typen fuehren
     (eine bestehende Migration zu aendern waere Geschichtsfaelschung). */
  /* Migrationen liegen IMMER neben den Tests (supabase/migrations neben
     supabase/tests) — unabhaengig davon, wo die App-Wurzel liegt. */
  const mig = join(HERE, '..', 'migrations', '0033_observation_types.sql');
  ok('Migration 0033 existiert', existsSync(mig));
  const migSql = readFileSync(mig, 'utf8');
  ok('… erlaubt alle drei Beobachtungstypen',
    /'shadow_observation'/.test(migSql) && /'prediction_record'/.test(migSql) &&
    /'prediction_evaluation'/.test(migSql));
  ok('… ersetzt den Constraint statt ihn zu doppeln',
    /drop constraint if exists engine_decision_log_type_known/.test(migSql));
  ok('… und traegt den Typ-Index fuer das 500er-Fenster',
    /user_id,\s*decision_type,\s*decided_at desc/.test(migSql));
  ok('0032 bleibt unveraendert (produktiv — keine Geschichtsfaelschung)',
    !/shadow_observation/.test(readFileSync(join(HERE, '..', 'migrations', '0032_decision_log.sql'), 'utf8')));

  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  ok('Modul ist eingehängt', /js\/engine\/prediction-observer\.js/.test(html));
  ok('der Debrief-Vertrag ist eingehängt', /js\/engine\/debrief-record\.js/.test(html));
  /* Die Verdrahtung von gmDbSave laeuft ueber den kanonischen Builder. */
  const ui2 = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  ok('gmDbSave delegiert an den kanonischen Builder',
    /ORVIA\.debriefRecord\.build\(\{/.test(ui2));
  ok('… und der Leakage-Copy existiert nicht mehr (Code, nicht Kommentar)',
    !/planned\.durationMin=actual\.durationMin/.test(
      ui2.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1')));
  ok('die Shadow-Verdrahtung uebergibt Wochen- und Plan-Identitaet',
    /weekId:\(function/.test(ui2) && /weekKeyFor/.test(ui2));
  ok('Modul ist im Cache-Manifest', /prediction-observer\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
  ok('Modul ist in der Versionsdrift-Bewachung',
    /prediction-observer\.js/.test(readFileSync(join(HERE, 'module_version_drift_test.mjs'), 'utf8')));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
