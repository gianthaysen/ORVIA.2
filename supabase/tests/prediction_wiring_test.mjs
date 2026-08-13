/* ORVIA · Prediction Observer — VERDRAHTUNG als Verhalten (v8-293)

   Getestet wird der ECHTE Produktionscode aus js/ui.js: Die Funktionen
   O.logWeekPredictions / O.resolveDebriefPrediction werden per
   Klammerbilanz aus dem Quelltext geschnitten (gm61-Muster — kein Kopieren
   von Logik in den Test, kein Testhaken in ORVIA) und in Node ausgefuehrt.

   Die vier Zusagen der Freigabeordnung:
     1. FAIL-CLOSED: Ohne serverseitiges Flag 'prediction_observer' entsteht
        NICHTS — kein Aufruf, kein Log-Eintrag. Der Client kann das Flag
        nicht setzen (0031/0034).
     2. Der Plan bleibt byte-fuer-byte identisch — auch wenn der Observer
        WIRFT. Ein Beobachtungsfehler ist nie ein Planfehler.
     3. Debrief-Speichern hat Vorrang: resolve() laeuft NACH upsert +
        saveProfile, verzoegert; fehlende Vorhersage ⇒ pending; die
        Reconciliation verbindet spaeter ueber die exakte Identitaet.
     4. Nur Einheiten STRIKT nach heute werden versucht; bereits debriefte
        Einheiten nie (debriefExists fail-closed, Lookup-Fehler ⇒ true).

   KALENDERABHAENGIGKEIT, BEWUSST: predictedAt ist die echte Uhr (wie im
   Schatten — kein injizierbarer Testhaken). Die erwartete Anzahl
   Vorhersagen ist deshalb KEINE Konstante, sondern wird aus dem realen
   Datum berechnet: an einem Sonntag gibt es in der laufenden Woche keinen
   strikt kuenftigen Tag mehr — dann ist NULL die korrekte Erwartung.

   node supabase/tests/prediction_wiring_test.mjs [appRoot] */
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

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const P = require(join(APP, 'js/engine/prediction-observer.js'));
require(join(APP, 'js/engine/evidence.js'));
require(join(APP, 'js/engine/load-profile.js'));
const SD = require(join(APP, 'js/engine/session-debrief.js'));
const DR = require(join(APP, 'js/engine/debrief-record.js'));
const OI = require(join(APP, 'js/engine/observer-input.js'));

const uiRaw = readFileSync(join(APP, 'js/ui.js'), 'utf8');

/* ---- Produktionsslice per Klammerbilanz (gm61-Muster) ------------------- */
function sliceBalanced(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('Slice fehlt: ' + marker);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') { d++; started = true; }
    else if (ch === '}') { d--; if (started && d === 0) {
      /* Zuweisungen enden mit `};` DIREKT nach der Klammer; Funktions-
         deklarationen enden mit der Klammer selbst. NICHT weiterscannen —
         sonst wandert Fremdtext bis zum naechsten Semikolon in den Slice. */
      let k = j + 1; while (k < src.length && /\s/.test(src[k])) k++;
      return src.slice(i, src[k] === ';' ? k + 1 : j + 1);
    } }
  }
  throw new Error('unbalancierter Slice: ' + marker);
}
const helperSrc =
  sliceBalanced(uiRaw, 'function _poIsoAdd(') + '\n' +
  sliceBalanced(uiRaw, 'function _poMondayOf(') + '\n';
const lwpSrc = sliceBalanced(uiRaw, 'O.logWeekPredictions=function');
const rdpSrc = sliceBalanced(uiRaw, 'O.resolveDebriefPrediction=function');
const rppSrc = sliceBalanced(uiRaw, 'O.reconcilePendingPredictions=function');
const sportSrc = sliceBalanced(uiRaw, 'function gmSportIdOfUnit(');

/* ---- Instanziierung mit kontrollierter Umwelt --------------------------- */
function instantiate(opts) {
  const o = opts || {};
  const log = [];
  const ring = o.ring || [];
  const O = {
    featureFlags: { isEnabled: f => o.flagOn === true && f === 'prediction_observer' },
    predictionObserver: o.observer || P,
    decisionLog: { logDecision: e => { log.push(e); return true; }, recent: () => ring },
    sessionDebrief: SD, debriefRecord: DR,
    /* Echte Zonenaufloesung — ohne sie koennte ein Global-Leck der
       Prescription-Zone in der Sandbox nie sichtbar werden. */
    performanceZones: require(join(APP, 'js/engine/performance-zones.js')),
    user: { id: o.uid !== undefined ? o.uid : 'u1' }
  };
  const code = 'var _predSeen=[];\n' + helperSrc + sportSrc + '\n' + lwpSrc + '\n' + rdpSrc + '\n' + rppSrc + '\nreturn O;';
  const fn = new Function('O', 'gmDbFind', 'gmDbKey', code);
  const gmDbKey = (dateIso, unit) => String(dateIso) + '|' + ((unit && unit.t) || '') + '|' + ((unit && unit.l) || '');
  return { O: fn(O, o.gmDbFind || (() => null), gmDbKey), log, ring };
}
const tick = ms => new Promise(r => setTimeout(r, ms || 25));

/* EHRLICHER SUPABASE-DOPPELGAENGER: wendet die Filter WIRKLICH auf einen
   Datenbestand an (eq auch auf 'derived_state->>feld', in auf JSON-Pfade,
   order desc nach decided_at, limit) — nur so kann ein Test beweisen, dass
   die SERVERSEITIGE Einschraenkung die Session rettet, die ein zu breites
   Fenster verloren haette. */
function mkSb(dataset, seen) {
  const val = (row, k) => {
    const m = k.match(/^derived_state->>(.+)$/);
    return m ? (row.derived_state ? row.derived_state[m[1]] : undefined) : row[k];
  };
  return { from: () => { const q = { eqs: [], ins: [] };
    const chain = {
      select: () => chain,
      eq: (k, v) => { q.eqs.push([k, v]); return chain; },
      in: (k, vs) => { q.ins.push([k, vs]); return chain; },
      order: (k, o) => { q.order = [k, o && o.ascending]; return chain; },
      limit: n => { q.limit = n; return chain; },
      then: (res, rej) => {
        if (seen) seen.push(q);
        let rows = dataset.filter(r =>
          q.eqs.every(([k, v]) => val(r, k) === v) &&
          q.ins.every(([k, vs]) => vs.indexOf(val(r, k)) >= 0));
        rows = rows.slice().sort((a, b) => String(b.decided_at || '').localeCompare(String(a.decided_at || '')));
        if (q.limit != null) rows = rows.slice(0, q.limit);
        return Promise.resolve({ data: rows.map(r => ({ derived_state: r.derived_state })), error: null }).then(res, rej);
      }
    }; return chain; } };
}

/* ---- Kalenderfixture: FEST INJIZIERTER WOCHENTAG (v8-308) ---------------
   Gians Befund: das Fixture hing an der ECHTEN Uhr — am Sonntag gab die
   Woche keinen strikt kuenftigen Tag her, mehrere wichtige Produktketten
   liefen als „entfaellt" und wurden trotzdem als bestanden gezaehlt.
   Jetzt ist der Wochentag fest: der MITTWOCH DER NAECHSTEN realen Woche.
   Fest am Mittwoch ⇒ immer genau 4 strikt kuenftige Tage (Do–So), die
   Ketten laufen an JEDEM Wochentag. Naechste Woche (nicht ein absolutes
   Datum) deshalb, weil lwp predictedAt aus der echten Uhr nimmt und
   predict() eine Vorhersage am oder nach dem Einheitstag ablehnt
   (predicted_on_or_after_session_day) — ein fixes Datum in der
   Vergangenheit wuerde ab dem Folgetag alles abweisen. Z0 unten wacht:
   degradiert das Fixture je wieder, wird es ROT statt still gruen. */
const mondayOf = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const today = addD(mondayOf(new Date().toISOString().slice(0, 10)), 9); /* Mi. naechste Woche */
const monday = mondayOf(today);
const dayDates = [...Array(7)].map((_, i) => addD(monday, i));
const futureIdx = dayDates.map((d, i) => (d > today ? i : -1)).filter(i => i >= 0);
sec('Z0 · Kalenderfixture (fest injizierter Wochentag)');
ok('das Fixture ist ein Mittwoch mit GENAU 4 strikt kuenftigen Tagen — keine Sonntags-Degradation mehr',
  futureIdx.length === 4 && new Date(today + 'T12:00:00Z').getUTCDay() === 3, today);
const mkPlan = () => dayDates.map((_, i) =>
  [{ id: 'psg:' + i + ':0:lauf', t: 'Laufen', l: 'Dauerlauf easy', d: '45 min' }]);
const ctxOf = plan => ({ weekId: '2026-W99', planId: 'p1', planRevision: 'r1',
  today, currentPlan: plan, debriefs: [] });

/* ══════════════════════════════════════════════════════════════ */
sec('Z1 · Fail-closed: ohne Flag entsteht NICHTS');
{
  const { O, log } = instantiate({ flagOn: false });
  const plan = mkPlan(); const before = JSON.stringify(plan);
  O.logWeekPredictions(ctxOf(plan));
  await tick();
  ok('Flag aus ⇒ kein einziger Log-Eintrag', log.length === 0, String(log.length));
  ok('… und der Plan ist byte-identisch', JSON.stringify(plan) === before);
  O.resolveDebriefPrediction({ id: 'db:x', sessionId: 'po:x' });
  await tick();
  ok('Flag aus ⇒ auch resolve() schreibt nichts', log.length === 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z2 · Mit Flag: Vorhersagen NUR fuer strikt kuenftige Einheiten');
{
  const { O, log } = instantiate({ flagOn: true });
  const plan = mkPlan(); const before = JSON.stringify(plan);
  O.logWeekPredictions(ctxOf(plan));
  await tick();
  const preds = log.filter(e => e.decisionType === 'prediction_record');
  ok('genau die kuenftigen Tage werden vorhergesagt (' + futureIdx.length + ' im realen Kalender)',
    preds.length === futureIdx.length, preds.length + '/' + futureIdx.length);
  ok('der Plan ist nach der Beobachtung byte-identisch', JSON.stringify(plan) === before);
  if (preds.length) {
    const d = preds[0].derivedState;
    ok('… jede Vorhersage ist ein echter ok-Record mit Tagesbasis',
      preds.every(e => e.derivedState && e.derivedState.ok === true &&
        e.derivedState.timingBasis === 'day_level_only'));
    ok('… mit po:-Occurrence, Plan-Identitaet und decisionId = predictionId',
      /^po:/.test(d.sessionId) && d.planId === 'p1' && d.planRevision === 'r1' &&
      preds.every(e => e.decisionId === e.derivedState.predictionId));
    ok('… und die Integritaet ist nachrechenbar', P.verifyIntegrity(d) === true);
  } else {
    ok('(Sonntag: keine kuenftigen Tage in dieser Woche — 0 ist die korrekte Erwartung)', true);
    ok('(entfaellt am Sonntag)', true); ok('(entfaellt am Sonntag)', true);
  }
  /* Wiederholter Lauf: dieselben Vorhersagen entstehen NICHT doppelt. */
  O.logWeekPredictions(ctxOf(mkPlan()));
  await tick();
  ok('ein zweiter Planlauf erzeugt keine Dubletten',
    log.filter(e => e.decisionType === 'prediction_record').length === preds.length);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z3 · Bereits debriefte Einheiten werden NIE versucht');
{
  /* v8-300: Der Lookup laeuft im SNAPSHOT (ctx.debriefs), nicht mehr im
     lebenden Speicher — die Fixture liefert die Debriefs deshalb im ctx,
     mit der ECHTEN Occurrence-Identitaet. */
  const ctx3 = ctxOf(mkPlan());
  ctx3.debriefs = dayDates.map((d, i) => ({ id: 'db:' + d + ':psg:' + i + ':0:lauf' }));
  const { O, log } = instantiate({ flagOn: true });
  O.logWeekPredictions(ctx3);
  await tick();
  ok('vorhandenes Debrief (im Snapshot) ⇒ keine Vorhersage', log.length === 0, String(log.length));
  /* Fehlerpfad: ein Eintrag, der beim Lesen WIRFT ⇒ fail-closed kein Versuch. */
  const ctx3b = ctxOf(mkPlan());
  ctx3b.debriefs = [new Proxy({}, { get() { throw new Error('kaputt'); } })];
  const { O: O2, log: log2 } = instantiate({ flagOn: true });
  O2.logWeekPredictions(ctx3b);
  await tick();
  ok('Lookup-Fehler ⇒ fail-closed (KEINE Vorhersage, statt „wird schon fehlen")',
    log2.length === 0, String(log2.length));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z4 · Ein WERFENDER Observer beruehrt weder Plan noch Aufrufer');
{
  const kaputt = { predict: () => { throw new Error('observer kaputt'); },
    resolve: () => { throw new Error('observer kaputt'); }, reconcile: () => { throw new Error('x'); } };
  const { O, log } = instantiate({ flagOn: true, observer: kaputt });
  const plan = mkPlan(); const before = JSON.stringify(plan);
  let threw = false;
  try { O.logWeekPredictions(ctxOf(plan)); } catch (_e) { threw = true; }
  await tick();
  ok('logWeekPredictions wirft nie nach aussen', threw === false);
  ok('… kein Log-Eintrag aus dem kaputten Lauf', log.length === 0);
  ok('… der Plan ist byte-identisch', JSON.stringify(plan) === before);
  let threw2 = false;
  try { O.resolveDebriefPrediction({ id: 'db:x', sessionId: 'po:x', planId: 'p1' }); } catch (_e) { threw2 = true; }
  await tick();
  ok('resolveDebriefPrediction wirft nie nach aussen', threw2 === false);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z5 · Fehlende Identitaet ⇒ gar kein Versuch (fail-closed)');
{
  for (const [feld, ctx] of [
    ['userId', { ...ctxOf(mkPlan()) }],
    ['planId', { ...ctxOf(mkPlan()), planId: null }],
    ['planRevision', { ...ctxOf(mkPlan()), planRevision: null }],
    ['today', { ...ctxOf(mkPlan()), today: null }]]) {
    const { O, log } = instantiate({ flagOn: true, uid: feld === 'userId' ? null : 'u1' });
    O.logWeekPredictions(ctx);
    await tick();
    ok('ohne ' + feld + ' entsteht nichts', log.length === 0, String(log.length));
  }
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z6 · resolve nach Debrief: scored / pending / Reconciliation');
{
  /* Ein ECHTES Debrief (kanonischer Builder) + eine dazu passende Vorhersage. */
  const unit = { id: 'psg:3:0:intervalle', t: 'Laufen', l: 'Intervalle', d: '40 min' };
  const rec = DR.build({ key: '2026-08-06|Laufen|Intervalle', date: '2026-08-06', unit,
    planned: { t: 'Laufen', l: 'Intervalle', d: '40 min', sportId: 'running', durationMin: 40 },
    actual: { durationMin: 38, completedAt: '2026-08-06T18:00:00Z' },
    rpe: 8, pain: false, userId: 'u1', planId: 'p1', planRevision: 'r1',
    now: '2026-08-06T19:00:00Z', SD });
  const rx = SD.prescriptionOf(unit, { durationMin: DR.plannedDurationOf(unit), targetZone: null }); /* v8-308: DIE eine Funktion — keine handkopierte Feldliste (sessionType fehlte) */
  const pred = P.predict({ userId: 'u1', sessionId: rec.sessionId, planId: 'p1', planRevision: 'r1',
    sport: 'running', prescription: rx,
    predictedAt: '2026-08-05T20:00:00Z', sessionDate: '2026-08-06' });
  ok('Vorbedingung: die Fixture-Vorhersage entsteht', pred.ok === true, pred.reason || '');

  /* a) Vorhersage im Ring ⇒ scored, und zwar GEGEN GENAU DIESE Vorhersage. */
  const fremd = P.predict({ userId: 'u1', sessionId: 'po:2026-08-06:psg:9:9:anders', planId: 'p1',
    planRevision: 'r1', sport: 'running', prescription: rx,
    predictedAt: '2026-08-05T20:00:00Z', sessionDate: '2026-08-06' });
  /* REIHENFOLGE ALS FALLE: Die richtige Vorhersage steht ZUERST, die fremde
     ZULETZT. Eine Verdrahtung, die den Session-Filter verliert und einfach
     die letzte Nutzer-Vorhersage nimmt, griffe hier die FALSCHE — genau die
     Mutation, die diese Anordnung fangen muss. */
  const ringA = [
    { decisionType: 'prediction_record', derivedState: pred },
    { decisionType: 'prediction_record', derivedState: fremd }];
  const { O: Oa, log: logA } = instantiate({ flagOn: true, ring: ringA });
  Oa.resolveDebriefPrediction(rec);
  await tick();
  const evA = logA.filter(e => e.decisionType === 'prediction_evaluation');
  ok('mit Vorhersage im Ring ⇒ genau eine Auswertung', evA.length === 1, String(evA.length));
  ok('… scored, gegen die RICHTIGE Vorhersage (Session-Identitaet, nicht Reihenfolge)',
    evA.length === 1 && evA[0].derivedState.resolution === 'scored' &&
    evA[0].derivedState.predictionId === pred.predictionId,
    evA.length ? evA[0].derivedState.resolution : '');

  /* b) Keine Vorhersage ⇒ pending. */
  const { O: Ob, log: logB, ring: ringB } = instantiate({ flagOn: true, ring: [] });
  Ob.resolveDebriefPrediction(rec);
  await tick();
  const evB = logB.filter(e => e.decisionType === 'prediction_evaluation');
  ok('ohne Vorhersage ⇒ pending (kein Endzustand)',
    evB.length === 1 && evB[0].derivedState.resolution === 'pending',
    evB.length ? evB[0].derivedState.resolution : '0');

  /* c) Die Vorhersage trifft SPAETER ein ⇒ die Reconciliation verbindet. */
  ringB.push(...logB.map(e => ({ decisionType: e.decisionType, derivedState: e.derivedState })));
  ringB.push({ decisionType: 'prediction_record', derivedState: pred });
  Ob.resolveDebriefPrediction(rec);
  await tick();
  const reconciled = logB.filter(e => e.decisionType === 'prediction_evaluation' &&
    e.derivedState.resolution === 'scored');
  ok('nachgelieferte Vorhersage ⇒ die Reconciliation liefert die Auswertung nach',
    reconciled.length >= 1 &&
    reconciled.every(e => e.derivedState.predictionId === pred.predictionId),
    String(reconciled.length));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z8 · Der Snapshot friert im Tick ein — spaetere Mutation ist wirkungslos');
if (futureIdx.length) {
  /* LEBENSZYKLUS-BEFUND (v8-293-Review): sel speicherte Referenzen. Wer
     zwischen Plan-Tick und verzoegertem Callback den Plan bearbeitet, haette
     eine Vorhersage aus dem NEUEN Zustand mit dem ALTEN Stempel erzeugt —
     zeitlich verunreinigtes Lernmaterial. */
  const { O: Oc, log: logC } = instantiate({ flagOn: true });
  const planC = mkPlan(); const ctxC = ctxOf(planC);
  Oc.logWeekPredictions(ctxC);
  /* JETZT — vor dem Callback — Plan UND Historie veraendern. */
  const fi = futureIdx[0];
  planC[fi][0].id = 'psg:' + fi + ':0:MANIPULIERT';
  planC[fi][0].l = 'MANIPULIERT';
  planC[fi][0].d = '999 min';
  /* FUENF vergleichbare Extrem-Debriefs — genug fuer die Personalisierung
     (expectedRPE: own.length >= 5 ⇒ Median ersetzt die Tabelle). Fluesse die
     Historie per REFERENZ in den Callback, spraenge die Erwartung auf 10 und
     die Evidenz auf moderate — exakt das, was der Kontrollvergleich fangen
     muss. */
  for (let m = 0; m < 5; m++) {
    /* OHNE explizites sessionType: comparable() leitet den Typ dann per
       typeOf() aus t/l ab — exakt wie beim Referenz-Objekt der Vorhersage.
       Ein hartes 'easy' hier traefe typeOf('Dauerlauf easy')='unknown' nicht. */
    ctxC.debriefs.push({ t: 'Laufen', l: 'Dauerlauf easy', d: '45 min', rpe: 10, date: today });
  }
  await tick();
  const predsC = logC.filter(e => e.decisionType === 'prediction_record');
  ok('die Vorhersage traegt die Occurrence des EINGEFRORENEN Zustands',
    predsC.length === futureIdx.length &&
    predsC.every(e => !/MANIPULIERT/.test(e.derivedState.sessionId)),
    predsC.map(e => e.derivedState.sessionId).join(' '));
  /* Kontrolllauf ohne Mutation: die Prognose muss identisch ausfallen. */
  const { O: Od, log: logD } = instantiate({ flagOn: true });
  Od.logWeekPredictions(ctxOf(mkPlan()));
  await tick();
  const byS = {};
  logD.filter(e => e.decisionType === 'prediction_record')
    .forEach(e => { byS[e.derivedState.sessionId] = e.derivedState; });
  ok('… und rechnet mit der EINGEFRORENEN Erwartung (identisch zum Kontrolllauf)',
    predsC.every(e => { const k = byS[e.derivedState.sessionId];
      return k && JSON.stringify(k.modelPrediction) === JSON.stringify(e.derivedState.modelPrediction) &&
        k.prescriptionHash === e.derivedState.prescriptionHash; }));
} else {
  ok('(Sonntag: kein kuenftiger Tag — Z8 entfaellt kalendarisch)', true);
  ok('(entfaellt am Sonntag)', true);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z9 · Neustart: Ring leer, Vorhersage persistiert ⇒ trotzdem scored');
{
  const unit9 = { id: 'psg:2:0:tempo', t: 'Laufen', l: 'Tempolauf', d: '35 min' };
  const rec9 = DR.build({ key: '2026-08-06|Laufen|Tempolauf', date: '2026-08-06', unit: unit9,
    planned: { t: 'Laufen', l: 'Tempolauf', d: '35 min', sportId: 'running', durationMin: 35 },
    actual: { durationMin: 35, completedAt: '2026-08-06T18:00:00Z' },
    rpe: 7, pain: false, userId: 'u1', planId: 'p1', planRevision: 'r1',
    now: '2026-08-06T19:00:00Z', SD });
  const rx9 = SD.prescriptionOf(unit9, { durationMin: DR.plannedDurationOf(unit9), targetZone: null }); /* v8-308: DIE eine Funktion — keine handkopierte Feldliste (sessionType fehlte) */
  const pred9 = P.predict({ userId: 'u1', sessionId: rec9.sessionId, planId: 'p1', planRevision: 'r1',
    sport: 'running', prescription: rx9,
    predictedAt: '2026-08-05T20:00:00Z', sessionDate: '2026-08-06' });
  ok('Vorbedingung: die persistierte Vorhersage entsteht', pred9.ok === true, pred9.reason || '');

  /* Supabase-Doppelgaenger: liefert die GESPEICHERTE Vorhersage — der Ring
     ist leer (Neustart). Abgefragt werden muss serverseitig nach Typ+Plan. */
  const seenQ = [];
  const sbStub = { from: t => { const q = { table: t, eqs: [] };
    const chain = {
      select: c => { q.select = c; return chain; },
      eq: (k, v) => { q.eqs.push([k, v]); return chain; },
      order: (k, o) => { q.order = [k, o && o.ascending]; return chain; },
      limit: n => { q.limit = n; return chain; },
      then: (res, rej) => { seenQ.push(q);
        return Promise.resolve({ data: [{ derived_state: pred9 }], error: null }).then(res, rej); }
    }; return chain; } };
  const { O: Oe, log: logE } = instantiate({ flagOn: true, ring: [] });
  Oe.sb = sbStub;
  Oe.resolveDebriefPrediction(rec9);
  await tick();
  const evE = logE.filter(e => e.decisionType === 'prediction_evaluation');
  ok('nach dem Neustart wird die PERSISTIERTE Vorhersage gefunden ⇒ scored',
    evE.length === 1 && evE[0].derivedState.resolution === 'scored' &&
    evE[0].derivedState.predictionId === pred9.predictionId,
    evE.length ? evE[0].derivedState.resolution : '0');
  ok('… mit serverseitigem Typ- und Plan-Filter vor dem Limit',
    seenQ.length === 1 && seenQ[0].eqs.some(e => e[0] === 'decision_type' && e[1] === 'prediction_record') &&
    seenQ[0].eqs.some(e => e[0] === 'plan_id' && e[1] === 'p1') &&
    seenQ[0].order && seenQ[0].order[1] === false && seenQ[0].limit === 50);

  /* Abfragefehler ⇒ ehrlich pending, nie ein Verlust ohne Beleg. */
  const sbKaputt = { from: () => { const c = { select: () => c, eq: () => c, order: () => c,
    limit: () => c, then: (r, j) => Promise.reject(new Error('offline')).then(r, j) }; return c; } };
  const { O: Of, log: logF } = instantiate({ flagOn: true, ring: [] });
  Of.sb = sbKaputt;
  Of.resolveDebriefPrediction(rec9);
  await tick();
  const evF = logF.filter(e => e.decisionType === 'prediction_evaluation');
  ok('Abfragefehler ⇒ pending (Reconciliation holt es spaeter)',
    evF.length === 1 && evF[0].derivedState.resolution === 'pending',
    evF.length ? evF[0].derivedState.resolution : '0');
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z10 · Zwei Revisionen derselben Session: die EXAKTE gewinnt');
{
  const unitX = { id: 'psg:4:0:lang', t: 'Laufen', l: 'Langer Lauf', d: '90 min' };
  const recX = DR.build({ key: '2026-08-07|Laufen|Langer Lauf', date: '2026-08-07', unit: unitX,
    planned: { t: 'Laufen', l: 'Langer Lauf', d: '90 min', sportId: 'running', durationMin: 90 },
    actual: { durationMin: 88, completedAt: '2026-08-07T18:00:00Z' },
    rpe: 6, pain: false, userId: 'u1', planId: 'p1', planRevision: 'r2',
    now: '2026-08-07T19:00:00Z', SD });
  const rxX = SD.prescriptionOf(unitX, { durationMin: DR.plannedDurationOf(unitX), targetZone: null }); /* v8-308: DIE eine Funktion — keine handkopierte Feldliste (sessionType fehlte) */
  const mkP = rev => P.predict({ userId: 'u1', sessionId: recX.sessionId, planId: 'p1',
    planRevision: rev, sport: 'running', prescription: rxX,
    predictedAt: '2026-08-05T20:00:00Z', sessionDate: '2026-08-07' });
  const pR2 = mkP('r2'), pR1 = mkP('r1');
  ok('Vorbedingung: beide Revisions-Vorhersagen entstehen', pR1.ok === true && pR2.ok === true);
  /* DIE FALLE: r2 (die richtige) steht ZUERST, r1 ZULETZT — „nimm die
     letzte" griffe r1 und ergaebe superseded statt scored. */
  const ringX = [
    { decisionType: 'prediction_record', derivedState: pR2 },
    { decisionType: 'prediction_record', derivedState: pR1 }];
  const { O: Og, log: logG } = instantiate({ flagOn: true, ring: ringX });
  Og.resolveDebriefPrediction(recX);
  await tick();
  const evG = logG.filter(e => e.decisionType === 'prediction_evaluation');
  ok('das Debrief (r2) trifft die r2-Vorhersage ⇒ scored, nicht superseded',
    evG.length === 1 && evG[0].derivedState.resolution === 'scored' &&
    evG[0].derivedState.predictionId === pR2.predictionId,
    evG.length ? evG[0].derivedState.resolution + '/' + (evG[0].derivedState.predictionId === pR2.predictionId ? 'r2' : 'FALSCHE') : '0');
  /* Existiert NUR die alte Revision, ist superseded die ehrliche Antwort. */
  const { O: Oh, log: logH } = instantiate({ flagOn: true,
    ring: [{ decisionType: 'prediction_record', derivedState: pR1 }] });
  Oh.resolveDebriefPrediction(recX);
  await tick();
  const evH = logH.filter(e => e.decisionType === 'prediction_evaluation');
  ok('nur die alte Revision vorhanden ⇒ ehrlich superseded (kein stilles scored)',
    evH.length === 1 && evH[0].derivedState.resolution === 'superseded',
    evH.length ? evH[0].derivedState.resolution : '0');
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z11 · Offline beim Debrief → spaeter online → automatisch scored');
{
  /* RESTPROBLEM (v8-294-Review): Der Fehlerpfad endete bei pending — und
     ohne ERNEUTES Speichern kam nie ein zweiter Versuch. Der Herzschlag
     haengt am Planlauf und muss das pending OHNE Nutzerzutun schliessen. */
  const unit11 = { id: 'psg:1:0:iv', t: 'Laufen', l: 'Intervalle', d: '40 min' };
  const rec11 = DR.build({ key: '2026-08-06|Laufen|Intervalle', date: '2026-08-06', unit: unit11,
    planned: { t: 'Laufen', l: 'Intervalle', d: '40 min', sportId: 'running', durationMin: 40 },
    actual: { durationMin: 39, completedAt: '2026-08-06T18:00:00Z' },
    rpe: 8, pain: false, userId: 'u1', planId: 'p1', planRevision: 'r1',
    now: '2026-08-06T19:00:00Z', SD });
  const rx11 = SD.prescriptionOf(unit11, { durationMin: DR.plannedDurationOf(unit11), targetZone: null }); /* v8-308: DIE eine Funktion — keine handkopierte Feldliste (sessionType fehlte) */
  const pred11 = P.predict({ userId: 'u1', sessionId: rec11.sessionId, planId: 'p1', planRevision: 'r1',
    sport: 'running', prescription: rx11,
    predictedAt: '2026-08-05T20:00:00Z', sessionDate: '2026-08-06' });
  ok('Vorbedingung: die persistierte Vorhersage existiert', pred11.ok === true, pred11.reason || '');

  /* Schritt 1: OFFLINE beim Debrief ⇒ pending im Ring. */
  const sbOffline = { from: () => { const c = { select: () => c, eq: () => c, order: () => c,
    limit: () => c, then: (r, j) => Promise.reject(new Error('offline')).then(r, j) }; return c; } };
  const { O: Ok, log: logK, ring: ringK } = instantiate({ flagOn: true, ring: [] });
  Ok.sb = sbOffline;
  Ok.resolveDebriefPrediction(rec11);
  await tick();
  ok('offline ⇒ pending', logK.length === 1 && logK[0].derivedState.resolution === 'pending');
  /* Der Ring traegt das pending (wie im echten Log). */
  ringK.push({ decisionType: 'prediction_evaluation', derivedState: logK[0].derivedState });

  /* Schritt 2: ONLINE — Planlauf-Herzschlag, KEIN erneutes Speichern.
     Die Datenbank kennt die Vorhersage (und die pending-Auswertung). */
  Ok.sb = mkSb([
    { decision_type: 'prediction_record', decided_at: '2026-08-05T20:01:00Z', derived_state: pred11 },
    { decision_type: 'prediction_evaluation', decided_at: '2026-08-06T19:01:00Z', derived_state: logK[0].derivedState }
  ]);
  Ok.reconcilePendingPredictions([rec11]);
  await tick();
  const scored11 = logK.filter(e => e.decisionType === 'prediction_evaluation' &&
    e.derivedState.resolution === 'scored');
  ok('der Herzschlag schliesst das pending automatisch ⇒ scored',
    scored11.length === 1 && scored11[0].derivedState.predictionId === pred11.predictionId,
    String(scored11.length));
  /* Idempotenz: das scored liegt jetzt im Ring — ein weiterer Herzschlag
     darf NICHT erneut aufloesen. */
  ringK.push({ decisionType: 'prediction_evaluation', derivedState: scored11[0].derivedState });
  Ok.reconcilePendingPredictions([rec11]);
  await tick();
  ok('… und der Herzschlag ist idempotent (kein Doppel-scored)',
    logK.filter(e => e.derivedState.resolution === 'scored').length === 1);

  /* Neustart-Variante: Ring KOMPLETT leer — pending UND Vorhersage nur noch
     persistiert. Der Herzschlag muss beides aus der Datenbank holen. */
  const { O: Om, log: logM } = instantiate({ flagOn: true, ring: [] });
  Om.sb = mkSb([
    { decision_type: 'prediction_record', decided_at: '2026-08-05T20:01:00Z', derived_state: pred11 },
    { decision_type: 'prediction_evaluation', decided_at: '2026-08-06T19:01:00Z', derived_state: logK[0].derivedState }
  ]);
  Om.reconcilePendingPredictions([rec11]);
  await tick();
  ok('auch nach Neustart (Ring leer): persistiertes pending ⇒ scored',
    logM.filter(e => e.derivedState.resolution === 'scored').length === 1);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z12 · Viele fremde Vorhersagen: die Session ueberlebt das 50er-Fenster');
{
  const unit12 = { id: 'psg:2:0:tempo2', t: 'Laufen', l: 'Tempolauf', d: '35 min' };
  const rec12 = DR.build({ key: '2026-08-06|Laufen|Tempolauf', date: '2026-08-06', unit: unit12,
    planned: { t: 'Laufen', l: 'Tempolauf', d: '35 min', sportId: 'running', durationMin: 35 },
    actual: { durationMin: 35, completedAt: '2026-08-06T18:00:00Z' },
    rpe: 7, pain: false, userId: 'u1', planId: 'p1', planRevision: 'r1',
    now: '2026-08-06T19:00:00Z', SD });
  const rx12 = SD.prescriptionOf(unit12, { durationMin: DR.plannedDurationOf(unit12), targetZone: null }); /* v8-308: DIE eine Funktion — keine handkopierte Feldliste (sessionType fehlte) */
  const pred12 = P.predict({ userId: 'u1', sessionId: rec12.sessionId, planId: 'p1', planRevision: 'r1',
    sport: 'running', prescription: rx12,
    predictedAt: '2026-08-01T20:00:00Z', sessionDate: '2026-08-06' });
  ok('Vorbedingung: die aeltere Session-Vorhersage existiert', pred12.ok === true);

  /* 60 FREMDE Vorhersagen derselben Plan-ID, alle NEUER als die gesuchte —
     ohne serverseitigen Session-Filter fiele pred12 aus dem 50er-Fenster. */
  const dataset = [{ decision_type: 'prediction_record', plan_id: 'p1',
    decided_at: '2026-08-01T20:00:00Z', derived_state: pred12 }];
  for (let m = 0; m < 60; m++) {
    dataset.push({ decision_type: 'prediction_record', plan_id: 'p1',
      decided_at: '2026-08-0' + (2 + (m % 5)) + 'T0' + (m % 10) + ':00:00Z',
      derived_state: { ok: true, userId: 'u1', sessionId: 'po:2026-08-0' + (2 + (m % 5)) + ':psg:9:' + m + ':x',
        planId: 'p1', planRevision: 'r' + m } });
  }
  const seenQ12 = [];
  const { O: On, log: logN } = instantiate({ flagOn: true, ring: [] });
  On.sb = mkSb(dataset, seenQ12);
  On.resolveDebriefPrediction(rec12);
  await tick();
  const evN = logN.filter(e => e.decisionType === 'prediction_evaluation');
  ok('trotz 60 neuerer fremder Vorhersagen wird die richtige Session gefunden ⇒ scored',
    evN.length === 1 && evN[0].derivedState.resolution === 'scored' &&
    evN[0].derivedState.predictionId === pred12.predictionId,
    evN.length ? evN[0].derivedState.resolution : '0');
  ok('… weil die Session SERVERSEITIG vor dem Limit eingeschraenkt wird',
    seenQ12.some(q => q.eqs.some(e => e[0] === 'derived_state->>sessionId' && e[1] === rec12.sessionId)));
}

  const awpSrc = sliceBalanced(uiRaw, 'var _gmObsLast=') + '\n' +
  sliceBalanced(uiRaw, 'function gmPlanIdentity(') + '\n' +
  sliceBalanced(uiRaw, 'function gmObserveWeekPlan(') + '\n' +
  sliceBalanced(uiRaw, 'function activeWeekPlan(');
function runAWP(env) {
  const calls = { shadow: [], preds: [], beat: [] };
  const OO = {
    logWeekShadow: c => calls.shadow.push(c),
    logWeekPredictions: c => calls.preds.push(c),
    reconcilePendingPredictions: s => calls.beat.push(s),
    planDomain: { weekKeyFor: () => '2026-W99' },
    /* v8-299: gmObserveWeekPlan laeuft ueber das ECHTE Eingangsmodul und
       den ECHTEN activityStore-Vertrag — genau die zwei toten Quellen,
       die vorher nur der Test-Stub lebendig erscheinen liess. */
    observerInput: OI,
    observerSource: require(join(APP, 'js/engine/observer-source.js')),
    activityStore: { listActivities: () => env.acts || [] },
    _lastPlanPerf: env.perf !== undefined ? env.perf : undefined
  };
  const fn = new Function('window', 'ORVIA', 'PROFILE', 'DB', 'todayStr', 'goalOf',
    'gmCanonPlanOn', 'gmCanonPlanEnsure', 'gmCanonPlanDomain', '_gmCanonPlan',
    'ensurePlannedSessionIds', 'ensureGeneratedPlanIds', 'saveProfile',
    'alignPlanToAvailability', 'generateWeekPlan', 'gmDbStore',
    awpSrc + '\nreturn { activeWeekPlan: activeWeekPlan };');
  const api = fn({ ORVIA: OO }, OO, env.PROFILE, env.DB || { activities: [], sessionDebriefs: [] },
    d => d ? d.toISOString().slice(0, 10) : today, () => env.goal !== undefined ? env.goal : null,
    () => env.canonOn === true, () => {}, () => env.PD || null, env.canon || { plan: null },
    () => false, () => false, () => {},
    p => p, () => env.generated || null, () => env.dbStore || []);
  /* BEWUSST KEIN activitiesAll-Parameter: Die Funktion existiert im Produkt
     nicht — ein Harness, der sie stellt, liesse tote Quellpfade gruen
     erscheinen (genau der v8-298-Fehler von Z19). */
  return { api, calls, OO };
}


  const idSrc = sliceBalanced(uiRaw, 'function gmPlanIdentity(');
const mkId = (canon, profile) => new Function('_gmCanonPlan', 'PROFILE', 'window', 'todayStr',
  idSrc + '\nreturn gmPlanIdentity;')(canon, profile,
  { ORVIA: { planDomain: { weekKeyFor: () => '2026-W99' } } }, () => today);


/* ══════════════════════════════════════════════════════════════ */
sec('Z13 · PRODUKTPFAD: gespeicherter und kanonischer Plan erreichen den Observer');
{
  /* DER ENTSCHEIDENDE BEFUND (v8-295-Review): Die drei Observer-Funktionen
     waren getestet — aber der Weg dorthin nicht. activeWeekPlan() kehrt bei
     kanonischem oder gespeichertem Plan VOR dem Generator zurueck, und dort
     hing die Beobachtung. Dieser Test fuehrt das ECHTE activeWeekPlan aus. */
  /* a) GESPEICHERTER Plan (PROFILE.weekPlan) — der Normalfall. */
  const stored = mkPlan();
  const rA = runAWP({ PROFILE: { weekPlan: stored } });
  const outA = rA.api.activeWeekPlan();
  ok('gespeicherter Plan: Schatten, Vorhersagen UND Herzschlag laufen',
    rA.calls.shadow.length === 1 && rA.calls.preds.length === 1 && rA.calls.beat.length === 1,
    [rA.calls.shadow.length, rA.calls.preds.length, rA.calls.beat.length].join('/'));
  ok('… mit dem GESPEICHERTEN Plan als Vergleichsgroesse',
    rA.calls.preds.length === 1 && JSON.stringify(rA.calls.preds[0].currentPlan) === JSON.stringify(stored));
  ok('… und der Rueckgabewert ist der Plan selbst (Beobachtung veraendert nichts)',
    JSON.stringify(outA) === JSON.stringify(stored));

  /* b) KANONISCHER Plan. */
  const canonPlan = mkPlan();
  const rB = runAWP({ PROFILE: {}, canonOn: true,
    canon: { plan: { planId: 'p1', revision: 'r1', baseline: { sessions: [{ x: 1 }] } }, weekKey: '2026-W99' },
    PD: { weekKeyFor: () => '2026-W99', effectiveSessions: () => ({ days: canonPlan }) } });
  rB.api.activeWeekPlan();
  ok('kanonischer Plan: die Beobachtung laeuft ebenfalls',
    rB.calls.shadow.length === 1 && rB.calls.preds.length === 1 && rB.calls.beat.length === 1,
    [rB.calls.shadow.length, rB.calls.preds.length, rB.calls.beat.length].join('/'));

  /* c) RENDER-STURM-DROSSEL: derselbe Plan im selben Fenster nur EINMAL —
     ein GEAENDERTER Plan sofort wieder. */
  rA.api.activeWeekPlan(); rA.api.activeWeekPlan();
  ok('unveraenderter Plan wird im Drossel-Fenster nicht erneut beobachtet',
    rA.calls.shadow.length === 1, String(rA.calls.shadow.length));
  stored[0].push({ id: 'psg:0:1:neu', t: 'Laufen', l: 'Neu', d: '30 min' });
  rA.api.activeWeekPlan();
  ok('ein geaenderter Plan wird SOFORT wieder beobachtet',
    rA.calls.shadow.length === 2, String(rA.calls.shadow.length));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z14 · superseded zuerst, exakte Vorhersage spaeter ⇒ Herzschlag liefert scored');
{
  /* IDENTITAETSLUECKE (v8-295-Review): Das Dedup galt fuer JEDE nicht-
     pending-Auswertung — ein fruehes superseded (alte Revision) haette das
     spaetere scored gegen die exakte Vorhersage fuer immer blockiert.
     superseded ist ein Urteil ueber EINE Kandidatin, kein Endzustand. */
  const unit14 = { id: 'psg:5:0:berg', t: 'Laufen', l: 'Berglauf', d: '50 min' };
  const rec14 = DR.build({ key: '2026-08-06|Laufen|Berglauf', date: '2026-08-06', unit: unit14,
    planned: { t: 'Laufen', l: 'Berglauf', d: '50 min', sportId: 'running', durationMin: 50 },
    actual: { durationMin: 49, completedAt: '2026-08-06T18:00:00Z' },
    rpe: 8, pain: false, userId: 'u1', planId: 'p1', planRevision: 'r2',
    now: '2026-08-06T19:00:00Z', SD });
  const rx14 = SD.prescriptionOf(unit14, { durationMin: DR.plannedDurationOf(unit14), targetZone: null }); /* v8-308: DIE eine Funktion — keine handkopierte Feldliste (sessionType fehlte) */
  const mk14 = rev => P.predict({ userId: 'u1', sessionId: rec14.sessionId, planId: 'p1',
    planRevision: rev, sport: 'running', prescription: rx14,
    predictedAt: '2026-08-05T20:00:00Z', sessionDate: '2026-08-06' });
  const p14alt = mk14('r1'), p14exakt = mk14('r2');
  ok('Vorbedingung: beide Vorhersagen entstehen', p14alt.ok === true && p14exakt.ok === true);

  /* Schritt 1: Nur die ALTE Revision ist da ⇒ resolve ergibt superseded. */
  const { O: Op, log: logP, ring: ringP } = instantiate({ flagOn: true,
    ring: [{ decisionType: 'prediction_record', derivedState: p14alt }] });
  Op.resolveDebriefPrediction(rec14);
  await tick();
  ok('alte Revision zuerst ⇒ ehrlich superseded',
    logP.length === 1 && logP[0].derivedState.resolution === 'superseded');
  ringP.push({ decisionType: 'prediction_evaluation', derivedState: logP[0].derivedState });

  /* Schritt 2: Die EXAKTE Vorhersage erscheint spaeter (persistiert) —
     der naechste Herzschlag muss das superseded zu scored aufwerten. */
  Op.sb = mkSb([
    { decision_type: 'prediction_record', decided_at: '2026-08-05T20:02:00Z', derived_state: p14exakt },
    { decision_type: 'prediction_evaluation', decided_at: '2026-08-06T19:01:00Z', derived_state: logP[0].derivedState }
  ]);
  Op.reconcilePendingPredictions([rec14]);
  await tick();
  const scored14 = logP.filter(e => e.derivedState.resolution === 'scored');
  ok('der Herzschlag wertet superseded zur EXAKTEN Vorhersage auf ⇒ scored',
    scored14.length === 1 && scored14[0].derivedState.predictionId === p14exakt.predictionId,
    String(scored14.length));
  /* Idempotenz: scored ist endgueltig — kein weiterer Eintrag. */
  ringP.push({ decisionType: 'prediction_evaluation', derivedState: scored14[0].derivedState });
  Op.reconcilePendingPredictions([rec14]);
  await tick();
  ok('… und scored bleibt endgueltig (kein Doppel-Eintrag)',
    logP.filter(e => e.derivedState.resolution === 'scored').length === 1);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z15 · GESPEICHERTER ALTPLAN: die volle Kette bis scored — nachgewiesen');
{
  /* BEFUND (v8-296-Review): Bei gespeichertem Altplan war der Observer zwar
     ERREICHT, aber wirkungslos — _gmCanonPlan lieferte null fuer
     planId/planRevision, predict() lehnte fail-closed ab. Und selbst mit
     Identitaet waere jede Aufloesung not_comparable gewesen: Die Wiring-
     Prescription (ohne durationMin, mit Historie) hashte NIE gleich dem
     C3-Snapshot (mit durationMin, ohne Historie). Dieser Test weist die
     VOLLE Kette nach: Altplan -> Identitaet -> Vorhersage -> Debrief ->
     scored. */
  /* a) Identitaet: Altplan traegt Woche + Inhalts-Revision; Bearbeitung
     aendert die Revision; kanonisch gewinnt. */
  const wp = mkPlan();
  const id1 = mkId({ plan: null }, { weekPlan: wp })(null);
  ok('Altplan-Identität: weekplan:<Woche> + Inhalts-Revision',
    id1.planId === 'weekplan:2026-W99' && /^wp:[0-9a-f]+$/.test(id1.planRevision) &&
    id1.basis === 'stored_weekplan', JSON.stringify(id1));
  const wp2 = mkPlan(); wp2[0].push({ id: 'psg:0:9:neu', t: 'Laufen', l: 'Neu', d: '20 min' });
  const id2 = mkId({ plan: null }, { weekPlan: wp2 })(null);
  ok('… eine Planbearbeitung ist eine NEUE Revision', id2.planRevision !== id1.planRevision);
  ok('… unveränderter Inhalt bleibt DIESELBE Revision',
    mkId({ plan: null }, { weekPlan: mkPlan() })(null).planRevision === id1.planRevision);
  ok('… kanonisch geladen gewinnt das Modell',
    mkId({ plan: { planId: 'pk', revision: 'rk' } }, { weekPlan: wp })(null).planId === 'pk');

  /* b) Der ECHTE Produktpfad liefert die Identitaet an die Vorhersage … */
  const rC = runAWP({ PROFILE: { weekPlan: mkPlan() } });
  rC.api.activeWeekPlan();
  ok('activeWeekPlan übergibt dem Observer die Altplan-Identität',
    rC.calls.preds.length === 1 && rC.calls.preds[0].planId === 'weekplan:2026-W99' &&
    /^wp:/.test(rC.calls.preds[0].planRevision),
    rC.calls.preds.length ? rC.calls.preds[0].planId + '/' + rC.calls.preds[0].planRevision : '0');

  /* c) … und die Kette laeuft BIS SCORED durch (nur wenn der Kalender einen
     kuenftigen Tag hergibt — am Sonntag entfaellt der Nachweis ehrlich). */
  if (futureIdx.length) {
    /* BEWUSST eine Einheit, deren Dauer VOM Typ-Referenzwert abweicht
       (60 min bei ref 45): Nur dann unterscheidet der Dauerfaktor die
       Erwartung — und nur dann kann dieser Test eine verlorene
       durationMin-Paritaet ueberhaupt fangen (die 45-min-Einheit hat
       work==ref, Faktor 0, und liesse die Mutation entkommen). */
    const fi0 = futureIdx[0];
    const planX = mkPlan();
    planX[fi0] = [{ id: 'psg:' + fi0 + ':0:lang', t: 'Laufen', l: 'Long Run', d: '60 min' }];
    const rX = runAWP({ PROFILE: { weekPlan: planX } });
    rX.api.activeWeekPlan();
    const { O: Oq, log: logQ, ring: ringQ } = instantiate({ flagOn: true });
    Oq.logWeekPredictions(rX.calls.preds[0]);
    await tick();
    const predsQ = logQ.filter(e => e.decisionType === 'prediction_record');
    ok('die Vorhersagen ENTSTEHEN wirklich (nicht nur der Aufruf)',
      predsQ.length === futureIdx.length &&
      predsQ.every(e => e.derivedState.ok === true && /^weekplan:/.test(e.derivedState.planId)),
      predsQ.length + '/' + futureIdx.length);
    /* Debrief derselben Einheit — wie der echte Debrief-Pfad: planned mit
       plannedDurationOf, Identitaet aus gmPlanIdentity. */
    const fi = fi0;
    const du = { id: 'psg:' + fi + ':0:lang', t: 'Laufen', l: 'Long Run', d: '60 min' };
    const idD = mkId({ plan: null }, { weekPlan: planX })(dayDates[fi]);
    const recS = DR.build({ key: dayDates[fi] + '|Laufen|Long Run', date: dayDates[fi], unit: du,
      planned: { t: du.t, l: du.l, d: du.d, sportId: 'running', durationMin: DR.plannedDurationOf(du) },
      actual: { durationMin: 58, completedAt: dayDates[fi] + 'T18:00:00Z' },
      rpe: 4, pain: false, userId: 'u1', planId: idD.planId, planRevision: idD.planRevision,
      now: dayDates[fi] + 'T19:00:00Z', SD });
    ringQ.push(...logQ.map(e => ({ decisionType: e.decisionType, derivedState: e.derivedState })));
    Oq.resolveDebriefPrediction(recS);
    await tick();
    const evQ = logQ.filter(e => e.decisionType === 'prediction_evaluation');
    ok('ALTPLAN-KETTE VOLLSTÄNDIG: Debrief trifft die Vorhersage ⇒ scored',
      evQ.length === 1 && evQ[0].derivedState.resolution === 'scored',
      evQ.length ? evQ[0].derivedState.resolution + '/' + (evQ[0].derivedState.reason || '') : '0');
  } else {
    ok('(Sonntag: kein kuenftiger Tag — Ketten-Nachweis entfaellt kalendarisch)', true);
    ok('(entfaellt am Sonntag)', true);
  }

  /* d) C3-PARITAET als eigener Vertrag: Prescription-Hash der Vorhersage ==
     Hash des C3-Snapshots, fuer eine Einheit MIT Minutenfeld. */
  const pu = { id: 'psg:4:0:lang', t: 'Laufen', l: 'Long Run', d: '90 min' };
  const recP = DR.build({ key: 'k', date: '2026-08-06', unit: pu,
    planned: { t: pu.t, l: pu.l, d: pu.d, sportId: 'running', durationMin: DR.plannedDurationOf(pu) },
    actual: { durationMin: 88, completedAt: '2026-08-06T18:00:00Z' }, rpe: 6, pain: false,
    userId: 'u1', planId: 'p1', planRevision: 'r1', now: '2026-08-06T19:00:00Z', SD });
  /* v8-307: BEIDE Seiten beziehen die Vertragsfelder aus SD.prescriptionOf —
     die Paritaet prueft jetzt, dass der DR.build→SD.debrief-Pfad (mit all
     seiner Zwischenverarbeitung) dieselben Felder einfriert wie der direkte
     Aufruf, den das Wiring macht. */
  const rxP = SD.prescriptionOf(pu, { durationMin: DR.plannedDurationOf(pu), targetZone: null, history: [] });
  ok('die Wiring-Prescription hasht GLEICH dem C3-Snapshot (durationMin-Parität, keine Historie)',
    P.prescriptionHashOf(rxP) === P.prescriptionHashOf(recP.snapshot),
    rxP.expectedRpe + ' vs ' + recP.snapshot.expectedRpe);
  /* GIANS GEGENPROBE (v8-307, der Live-Test-Befund): 'Intervalle · 40 min'
     wurde als unknown klassifiziert, weil typeOf den ERSTEN WAHREN Text
     (d vor l!) nahm und nur ihn matchte — '40 min' trifft kein Muster.
     Reihenfolge ist jetzt Vertrag: expliziter Typ -> Label -> Detailtext. */
  const iv = { id: 'psg:x', t: 'Laufen', l: 'Intervalle', d: '40 min' };
  ok('GEGENPROBE: Intervalle + 40 min ergibt vo2 — nicht unknown',
    SD.typeOf(iv) === 'vo2', SD.typeOf(iv));
  ok('… und die Erwartung ist eine Intervall-Erwartung, keine unknown-Konvention',
    SD.prescriptionOf(iv, { durationMin: 40 }).expectedRpe > SD.BASE_RPE.unknown + 1,
    String(SD.prescriptionOf(iv, { durationMin: 40 }).expectedRpe));
  ok('… expliziter Typ schlaegt weiterhin jeden Text',
    SD.typeOf({ type: 'easy', l: 'Intervalle', d: '40 min' }) === 'easy');
  ok('… und ein Label ohne Signal faellt zum Detailtext durch',
    SD.typeOf({ t: 'Laufen', l: 'Einheit', d: '6x3 min Intervalle' }) === 'vo2');
  /* C3 uebergibt KEINE Historie an expectedRPE — eine einseitig wieder
     eingefuehrte Personalisierung im Wiring braeche die Hash-Paritaet genau
     dann, wenn genug eigene Daten da sind (im Feld, nie in der Sandbox).
     Deshalb als Quelltext-Vertrag: die EINE Funktion, leere Historie,
     wortwörtlich — und keine inline-Prescription mehr. */
  const lwpQ = uiRaw.slice(uiRaw.indexOf('O.logWeekPredictions=function'),
    uiRaw.indexOf('O.resolveDebriefPrediction=function'))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('… und das Wiring nutzt wortwörtlich SD.prescriptionOf OHNE Historie',
    /rx=SD\.prescriptionOf\(u,\{durationMin:_pdm,targetZone:zone,history:\[\]\}\);/.test(lwpQ) &&
    !/prescriptionVersion:SD\.VERSION/.test(lwpQ));
  ok('… mit durationMin aus derselben Quelle wie der Debrief-Pfad',
    /_pdm=DR\.plannedDurationOf\?DR\.plannedDurationOf\(u\):null;/.test(lwpQ));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z16 · Die Drossel verschluckt keine Beobachtung nach neuen Daten');
{
  /* BEFUND (v8-296-Review): Der Drossel-Schluessel kannte nur den PLAN —
     ein unveraenderter Plan mit NEUEM Debrief blieb bis zu 60s unbeobachtet
     (und bei Tab-Schluss fuer immer). Jetzt: Datenstand im Schluessel UND
     direkter Bust in gmDbSave. */
  const dbStore = [];
  const rD = runAWP({ PROFILE: { weekPlan: mkPlan() }, dbStore });
  rD.api.activeWeekPlan();
  rD.api.activeWeekPlan();
  ok('Grundzustand: unveraenderter Plan + unveraenderte Daten ⇒ eine Beobachtung',
    rD.calls.shadow.length === 1, String(rD.calls.shadow.length));
  /* Neues Debrief im Speicher — Plan UNVERAENDERT. */
  dbStore.push({ id: 'db:x', debriefedAt: '2026-08-08T19:00:00Z' });
  rD.api.activeWeekPlan();
  ok('neues Debrief ⇒ die naechste Beobachtung laeuft SOFORT (Datenstand im Schluessel)',
    rD.calls.shadow.length === 2, String(rD.calls.shadow.length));
  /* Und der direkte Bust: gmDbSave setzt den Drossel-Schluessel zurueck. */
  const srcQ = uiRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  const saveQ = srcQ.slice(srcQ.indexOf('function gmDbSave'), srcQ.indexOf('function gmDbSave') + 5000);
  ok('gmDbSave bustet die Drossel direkt nach dem Speichern',
    /_gmObsLast\)_gmObsLast\.key=null;/.test(saveQ) &&
    saveQ.indexOf('_gmObsLast.key=null') > saveQ.indexOf('saveProfile'));
  ok('… und nutzt die GEMEINSAME Identitätsquelle für planId/planRevision',
    /gmPlanIdentity\(c\.date\)\.planId/.test(saveQ) && /gmPlanIdentity\(c\.date\)\.planRevision/.test(saveQ));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z17 · SPORTUEBERGREIFEND: Rad und Schwimmen sind keine unknown-Sportart');
{
  /* BEFUND (v8-297-Review): Der Debrief-Pfad mappte Rad->cycling und
     Schwimmen->swimming laengst, die Vorhersage nur das exakte 'Laufen' —
     Rad/Schwimmen wurden mit sport:null prognostiziert und in der
     Kalibrierung zu 'unknown' vermengt. Beide Seiten nutzen jetzt
     gmSportIdOfUnit. Und EHRLICH festgehalten: paceForUnit ist heute
     Laufen-only — auch mit ECHTEN FTP-/CSS-Zonen im Performance-Resolver
     bleibt targetZone fuer Rad/Schwimmen beidseitig null. Die Paritaet
     gilt GENAU DESHALB; eine spaetere Zonen-Integration ist eine bewusste
     C3-/Kohortenaenderung, kein Observer-Detail. */
  const spSrc = sliceBalanced(uiRaw, 'function gmSportIdOfUnit(');
  const spOf = new Function('u', spSrc + '\nreturn gmSportIdOfUnit(u);');
  ok('die gemeinsame Sportquelle mappt alle Plansportarten',
    spOf({ t: 'Laufen' }) === 'running' && spOf({ t: 'Rad' }) === 'cycling' &&
    spOf({ t: 'Radfahren' }) === 'cycling' && spOf({ t: 'Schwimmen' }) === 'swimming' &&
    spOf({ t: 'Gym' }) === null && spOf({ sportId: 'cycling', t: 'Egal' }) === 'cycling');
  /* Der Debrief-Callsite-Vertrag: dieselbe Funktion, kein zweites Mapping. */
  const srcS = uiRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('der Debrief-Pfad nutzt DIESELBE Quelle (kein Inline-Zweitmapping mehr)',
    /var sportId=\(typeof gmSportIdOfUnit==='function'\)\?gmSportIdOfUnit\(it\)/.test(srcS));
  const lwpS = srcS.slice(srcS.indexOf('O.logWeekPredictions=function'),
    srcS.indexOf('O.resolveDebriefPrediction=function'));
  ok('… und die Vorhersage-Seite ebenfalls (sport UND Zonen-Lookup)',
    (lwpS.match(/gmSportIdOfUnit\(u\)/g) || []).length >= 2);

  if (futureIdx.length) {
    /* Volle Kette fuer RAD mit echten FTP-Zonen im Performance-Kontext. */
    const fiR = futureIdx[0];
    const planR = mkPlan();
    planR[fiR] = [{ id: 'psg:' + fiR + ':0:rad', t: 'Rad', l: 'Easy Z2', d: '60 min' }];
    const rR = runAWP({ PROFILE: { weekPlan: planR } });
    rR.api.activeWeekPlan();
    const { O: Or, log: logR, ring: ringR } = instantiate({ flagOn: true });
    /* Echte FTP-Zonen liegen im Kontext — duerfen die Prescription heute
       NICHT beeinflussen (paceForUnit: Laufen-only, beidseitig). */
    Or._lastPlanPerf = { sports: { cycling: { ok: true, zones: { z2: { label: 'Z2', loW: 180, hiW: 220 } },
      confidence: 'moderate', freshness: 'fresh', ageRatio: 0.2 } } };
    Or.logWeekPredictions(rR.calls.preds[0]);
    await tick();
    const predsR = logR.filter(e => e.decisionType === 'prediction_record');
    /* v8-308: das Fixture hat jetzt IMMER 4 kuenftige Tage — die Zaehlung
       prueft alle, die Sport-Aussage genau die Rad-Vorhersage. Die alte
       Annahme predsR.length===1 galt nur samstags (1 kuenftiger Tag) —
       noch eine Wochentagsabhaengigkeit, vom festen Fixture aufgedeckt. */
    const predRad = predsR.filter(e => e.derivedState.sport === 'cycling');
    ok('RAD: die Vorhersage entsteht mit sport=cycling (nicht null/unknown)',
      predsR.length === futureIdx.length && predRad.length === 1 &&
      predRad[0].derivedState.ok === true,
      predsR.length + ' preds / ' + predRad.length + ' cycling');
    /* Debrief derselben Rad-Einheit — Callsite-Konstruktion. */
    const duR = { id: 'psg:' + fiR + ':0:rad', t: 'Rad', l: 'Easy Z2', d: '60 min' };
    const idR = mkId({ plan: null }, { weekPlan: planR })(dayDates[fiR]);
    const recR = DR.build({ key: dayDates[fiR] + '|Rad|Easy Z2', date: dayDates[fiR], unit: duR,
      planned: { t: duR.t, l: duR.l, d: duR.d, sportId: spOf(duR), durationMin: DR.plannedDurationOf(duR) },
      actual: { durationMin: 61, completedAt: dayDates[fiR] + 'T18:00:00Z' },
      rpe: 3, pain: false, userId: 'u1', planId: idR.planId, planRevision: idR.planRevision,
      now: dayDates[fiR] + 'T19:00:00Z', SD });
    ok('… das Rad-Debrief trägt sportId=cycling aus derselben Quelle', recR.sportId === 'cycling');
    ringR.push(...logR.map(e => ({ decisionType: e.decisionType, derivedState: e.derivedState })));
    Or.resolveDebriefPrediction(recR);
    await tick();
    const evR = logR.filter(e => e.decisionType === 'prediction_evaluation');
    ok('RAD-KETTE VOLLSTÄNDIG: Prescription-Parität hält auch mit FTP-Zonen im Kontext ⇒ scored',
      evR.length === 1 && evR[0].derivedState.resolution === 'scored' &&
      evR[0].derivedState.sport === 'cycling',
      evR.length ? evR[0].derivedState.resolution + '/' + (evR[0].derivedState.reason || '') : '0');

    /* SCHWIMMEN: dieselbe Kette mit CSS-Zonen im Kontext. */
    const planS = mkPlan();
    planS[fiR] = [{ id: 'psg:' + fiR + ':0:schwimm', t: 'Schwimmen', l: 'Technik', d: '45 min' }];
    const rS = runAWP({ PROFILE: { weekPlan: planS } });
    rS.api.activeWeekPlan();
    const { O: Os, log: logS, ring: ringS } = instantiate({ flagOn: true });
    Os._lastPlanPerf = { sports: { swimming: { ok: true, zones: { css: { label: 'CSS', loSecPer100: 105, hiSecPer100: 112 } },
      confidence: 'weak', freshness: 'fresh', ageRatio: 0.1 } } };
    Os.logWeekPredictions(rS.calls.preds[0]);
    await tick();
    const predsS = logS.filter(e => e.decisionType === 'prediction_record');
    const predSw = predsS.filter(e => e.derivedState.sport === 'swimming');
    ok('SCHWIMMEN: die Vorhersage entsteht mit sport=swimming',
      predsS.length === futureIdx.length && predSw.length === 1,
      predsS.length + ' preds / ' + predSw.length + ' swimming');
    const duS = { id: 'psg:' + fiR + ':0:schwimm', t: 'Schwimmen', l: 'Technik', d: '45 min' };
    const idS = mkId({ plan: null }, { weekPlan: planS })(dayDates[fiR]);
    const recSw = DR.build({ key: dayDates[fiR] + '|Schwimmen|Technik', date: dayDates[fiR], unit: duS,
      planned: { t: duS.t, l: duS.l, d: duS.d, sportId: spOf(duS), durationMin: DR.plannedDurationOf(duS) },
      actual: { durationMin: 45, completedAt: dayDates[fiR] + 'T18:00:00Z' },
      rpe: 4, pain: false, userId: 'u1', planId: idS.planId, planRevision: idS.planRevision,
      now: dayDates[fiR] + 'T19:00:00Z', SD });
    ringS.push(...logS.map(e => ({ decisionType: e.decisionType, derivedState: e.derivedState })));
    Os.resolveDebriefPrediction(recSw);
    await tick();
    const evS = logS.filter(e => e.decisionType === 'prediction_evaluation');
    ok('SCHWIMM-KETTE VOLLSTÄNDIG ⇒ scored mit sport=swimming',
      evS.length === 1 && evS[0].derivedState.resolution === 'scored' &&
      evS[0].derivedState.sport === 'swimming',
      evS.length ? evS[0].derivedState.resolution + '/' + (evS[0].derivedState.reason || '') : '0');
    /* Und die Kalibrierung trennt die Sportarten. */
    const calX = P.calibrate([evR[0] && evR[0].derivedState, evS[0] && evS[0].derivedState].filter(Boolean));
    ok('… die Kalibrierung trennt cycling und swimming in eigene Gruppen',
      calX.groups.length === 2 &&
      calX.groups.some(g => g.sport === 'cycling') && calX.groups.some(g => g.sport === 'swimming'),
      calX.groups.map(g => g.sport).join(','));
  } else {
    for (let s = 0; s < 6; s++) ok('(Sonntag: Ketten-Nachweis entfaellt kalendarisch)', true);
  }
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z18 · P0: der Schatten bekommt die ECHTEN C3-Debriefs');
{
  /* BEFUND (v8-297-Review): DB.sessionDebriefs wird NIRGENDS geschrieben —
     die Schatten-Kette bekam seit v8-279 eine leere Debrief-Liste, waehrend
     gmDbSave die echten Records laengst in den kanonischen Store schrieb.
     Speichern funktionierte, aber KEIN Konsument las die Daten. */
  const recZ = DR.build({ key: '2026-08-06|Laufen|Intervalle', date: '2026-08-06',
    unit: { id: 'psg:1:0:iv', t: 'Laufen', l: 'Intervalle', d: '40 min' },
    planned: { t: 'Laufen', l: 'Intervalle', d: '40 min', sportId: 'running', durationMin: 40 },
    actual: { durationMin: 39, completedAt: '2026-08-06T18:00:00Z' },
    rpe: 8, pain: false, userId: 'u1', planId: 'p1', planRevision: 'r1',
    now: '2026-08-06T19:00:00Z', SD });
  const dbStoreZ = [recZ];
  const rZ = runAWP({ PROFILE: { weekPlan: mkPlan() }, dbStore: dbStoreZ });
  rZ.api.activeWeekPlan();
  ok('der Schatten-Kontext trägt die Records aus dem KANONISCHEN Store',
    rZ.calls.shadow.length === 1 && Array.isArray(rZ.calls.shadow[0].debriefs) &&
    rZ.calls.shadow[0].debriefs.length === 1 && rZ.calls.shadow[0].debriefs[0].id === recZ.id,
    rZ.calls.shadow.length ? String(rZ.calls.shadow[0].debriefs.length) : '0');
  const srcZ = uiRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('… und das tote DB.sessionDebriefs speist den Schatten nicht mehr',
    !/logWeekShadow\(\{[\s\S]{0,1500}sessionDebriefs/.test(srcZ));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z19 · Die Drossel kennt ALLE Eingangsdaten');
{
  const acts = [];
  const rE = runAWP({ PROFILE: { weekPlan: mkPlan() }, acts });
  rE.api.activeWeekPlan(); rE.api.activeWeekPlan();
  ok('Grundzustand: eine Beobachtung', rE.calls.shadow.length === 1);
  /* Neue AKTIVITAET (Sync) bei unveraendertem Plan ⇒ sofort neu beobachten. */
  acts.push({ id: 'act:1', date: today, sportId: 'running' });
  rE.api.activeWeekPlan();
  ok('neue Aktivität ⇒ die nächste Beobachtung läuft SOFORT',
    rE.calls.shadow.length === 2, String(rE.calls.shadow.length));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z20 · DER EINE SNAPSHOT: observer-input speist Schatten, Prediction und Drossel');
{
  /* P0 (v8-298-Review): activitiesAll() existierte nie — Z19 bewies nur den
     Test-Stub. Jetzt laeuft die Kette ueber den ECHTEN activityStore-Vertrag
     (listActivities) und das ECHTE Eingangsmodul observer-input@1. */
  const acts20 = [{ id: 'act:9', date: today, sportId: 'running', durationMin: 50 }];
  /* PRODUKTFORM von goalOf(): distanceKm + targetMin (nicht targetTime). */
  const r20 = runAWP({ PROFILE: { weekPlan: mkPlan() }, acts: acts20,
    goal: { type: 'half_marathon', distanceKm: 21.0975, raceDate: '2026-11-01', targetMin: 110 } });
  r20.api.activeWeekPlan();
  const sctx = r20.calls.shadow[0];
  ok('der Schatten bekommt die Aktivitäten aus dem ECHTEN activityStore',
    r20.calls.shadow.length === 1 && Array.isArray(sctx.activities) &&
    sctx.activities.length === 1 && sctx.activities[0].id === 'act:9',
    r20.calls.shadow.length ? String((sctx.activities || []).length) : '0');
  ok('… und die Altplan-Identität steht jetzt auch im Schatten (planId nicht mehr null)',
    sctx.planId === 'weekplan:2026-W99', String(sctx.planId));
  ok('… mit Hash, Version und Herkunftsausweis des Eingangsmoduls',
    /^[0-9a-f]{8}$/.test(sctx.inputHash) && sctx.inputVersion === 'observer-input@5' &&
    sctx.inputBasis && sctx.inputBasis.activities === 'provided');

  /* DROSSEL = SNAPSHOT-HASH: Performance- und Zielzeit-Änderungen, die der
     alte Schlüsselstring nicht kannte, zählen jetzt automatisch. */
  r20.api.activeWeekPlan();
  ok('Grundzustand: eine Beobachtung', r20.calls.shadow.length === 1);
  r20.OO._lastPlanPerf = { sports: { running: { ok: true, confidence: 'moderate', ageRatio: 0.3,
    halfMarathonEquivalentMin: 112, reference: { distanceKm: 10, durationMin: 50, date: '2026-07-20', source: 'race' },
    zones: {} } } };
  r20.api.activeWeekPlan();
  ok('der Resolver setzt _lastPlanPerf ⇒ die nächste Beobachtung läuft SOFORT (mit Performance)',
    r20.calls.shadow.length === 2 && r20.calls.shadow[1].currentPerformance != null,
    String(r20.calls.shadow.length));
  /* P0 (v8-299-Review): Die Stufe-5-FORM — nicht das rohe {sports}-Objekt. */
  const cp20 = r20.calls.shadow[1].currentPerformance;
  ok('… und zwar in der STUFE-5-FORM {value, metric, evidence, ageRatio}',
    cp20.value > 0 && cp20.metric === 'time' && cp20.evidence === 'moderate' &&
    cp20.ageRatio === 0.3 && cp20.basis === 'riegel_from_reference',
    JSON.stringify(cp20));

  const r21 = runAWP({ PROFILE: { weekPlan: mkPlan() },
    goal: { type: 'half_marathon', distanceKm: 21.0975, raceDate: '2026-11-01', targetMin: 110 } });
  r21.api.activeWeekPlan();
  /* Zielzeit ändern — Typ und Datum bleiben (der alte Schlüssel sah nur die). */
  const g2 = { type: 'half_marathon', distanceKm: 21.0975, raceDate: '2026-11-01', targetMin: 105 };
  const r21b = runAWP({ PROFILE: { weekPlan: mkPlan() }, goal: g2 });
  r21b.api.activeWeekPlan();
  ok('eine geänderte ZIELZEIT ist ein anderer Snapshot-Hash',
    r21.calls.shadow[0].inputHash !== r21b.calls.shadow[0].inputHash);

  /* Fehlende Quelle wird AUSGEWIESEN, nicht als leer gedeutet. */
  const r22 = runAWP({ PROFILE: { weekPlan: mkPlan() } });
  r22.OO.activityStore = null;
  r22.api.activeWeekPlan();
  ok('ohne activityStore: basis=unavailable statt stiller leerer Liste',
    r22.calls.shadow.length === 1 && r22.calls.shadow[0].inputBasis.activities === 'unavailable');
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z21 · PRODUKTFORM-E2E: die ECHTE Kette bewertet Stufe 5 wirklich');
{
  /* DER KERN DES v8-299-Reviews: goalOf()-Form + Resolver-Form durch den
     ECHTEN Produktpfad (activeWeekPlan → gmObserveWeekPlan → Adapter) und
     dann durch die ECHTE Shadow-Kette (SA.snapshot → SA.observe mit echtem
     Registry) — Stufe 5 muss BEWERTEN, nicht insufficient_data melden. */
  require(join(APP, 'js/engine/load-history.js'));
  require(join(APP, 'js/engine/progression.js'));
  require(join(APP, 'js/engine/goal-feasibility.js'));
  require(join(APP, 'js/engine/plan-translator.js'));
  require(join(APP, 'js/engine/week-plan-designer.js'));
  require(join(APP, 'js/engine/week-plan-policy.js'));
  const SA21 = require(join(APP, 'js/engine/shadow-adaptive.js'));
  const REG21 = {
    loadHistory: require(join(APP, 'js/engine/load-history.js')),
    sessionDebrief: SD, evidence: require(join(APP, 'js/engine/evidence.js')),
    loadProfile: require(join(APP, 'js/engine/load-profile.js')),
    progression: require(join(APP, 'js/engine/progression.js')),
    goalFeasibility: require(join(APP, 'js/engine/goal-feasibility.js')),
    planTranslator: require(join(APP, 'js/engine/plan-translator.js')),
    weekPlanDesigner: require(join(APP, 'js/engine/week-plan-designer.js')),
    weekPlanPolicy: require(join(APP, 'js/engine/week-plan-policy.js')),
    observerInput: OI,
    observerSource: require(join(APP, 'js/engine/observer-source.js'))
  };
  /* 28 Tage echte Aktivitaeten (Form wie activityStore-Records). */
  const acts21 = [];
  for (let i = 0; i < 28; i++) {
    const d = addD(today, -(27 - i));
    acts21.push({ id: 'a' + i, localDate: d, sport: 'running', subType: 'easy',
      durationMin: 60, distanceKm: 10, source: 'sync' });
  }
  const r23 = runAWP({ PROFILE: { weekPlan: mkPlan(), level: 'ambitioniert' }, acts: acts21,
    goal: { type: 'half_marathon', distanceKm: 21.0975, raceDate: addD(today, 90), targetMin: 110 } });
  r23.OO._lastPlanPerf = { sports: { running: { ok: true, confidence: 'strong', ageRatio: 0.2,
    halfMarathonEquivalentMin: 112,
    reference: { distanceKm: 21.0975, durationMin: 112, date: addD(today, -14), source: 'race' }, zones: {} } } };
  r23.api.activeWeekPlan(); r23.api.activeWeekPlan();  /* 2. Lauf: mit Performance */
  const ctx21 = r23.calls.shadow[r23.calls.shadow.length - 1];
  ok('der Produktpfad liefert die Stufe-5-Formen',
    ctx21.goal && ctx21.goal.targetValue === 110 && ctx21.goal.metricType === 'time' &&
    ctx21.currentPerformance && ctx21.currentPerformance.value > 0 &&
    ctx21.targetDate === addD(today, 90),
    JSON.stringify({ tv: ctx21.goal && ctx21.goal.targetValue, cp: !!ctx21.currentPerformance }));
  const obs21 = SA21.observe(SA21.snapshot(ctx21), { registry: REG21 });
  ok('DIE ECHTE KETTE: Stufe 5 ist ok, nicht insufficient_data',
    obs21.stages.s5.status === 'ok' &&
    obs21.feasibility && obs21.feasibility.status !== 'insufficient_data',
    obs21.stages.s5.status + '/' + (obs21.feasibility ? obs21.feasibility.status : 'null') +
    '/' + ((obs21.feasibility && obs21.feasibility.limitingFactors) || []).join(','));
  ok('… und die Beobachtung persistiert die Eingangs-Herkunft (@8)',
    obs21.inputVersion === 'observer-input@5' && /^[0-9a-f]{8}$/.test(obs21.inputHash) &&
    obs21.inputBasis && obs21.inputBasis.activities === 'provided',
    String(obs21.inputVersion));
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z22 · Die Vorhersage liest NUR den Snapshot — nichts Globales, nichts Lebendes');
{
  if (futureIdx.length) {
    const fiZ = futureIdx[0];
    const planZ = mkPlan();
    planZ[fiZ] = [{ id: 'psg:' + fiZ + ':0:lang', t: 'Laufen', l: 'Long Run', d: '60 min' }];
    const rZ2 = runAWP({ PROFILE: { weekPlan: planZ } });
    rZ2.api.activeWeekPlan();
    const pctx = rZ2.calls.preds[0];
    ok('der Prediction-Kontext traegt Performance und Debriefs aus dem Snapshot',
      'performance' in pctx && 'debriefs' in pctx);
    /* Kontrolllauf: sauberer Zustand, keine globale Performance. */
    const { O: Oc2, log: logC2 } = instantiate({ flagOn: true });
    Oc2.logWeekPredictions(pctx);
    await tick();
    /* v8-308: 4 kuenftige Tage im festen Fixture — verglichen wird die
       Long-Run-Vorhersage des Zieltags, identifiziert ueber die Occurrence. */
    const isLang = e => String(e.derivedState.sessionId || '').indexOf(':psg:' + fiZ + ':0:lang') >= 0;
    const ctrl = logC2.filter(e => e.decisionType === 'prediction_record').filter(isLang)[0];
    /* Manipulationslauf: Nach dem Anstoss bekommt das GLOBALE _lastPlanPerf
       eine Zone, die paceForUnit fuer 'Long Run' TREFFEN wuerde ('long') —
       laese der Callback global, wanderte sie in die Prescription und der
       Hash wiche vom Kontrolllauf ab. */
    const { O: Oz, log: logZ } = instantiate({ flagOn: true });
    Oz.logWeekPredictions(pctx);
    Oz._lastPlanPerf = { sports: { running: { ok: true, confidence: 'strong',
      zones: { long: { label: 'Long', loSecPerKm: 330, hiSecPerKm: 360 } } } } };
    await tick();
    const predZall = logZ.filter(e => e.decisionType === 'prediction_record');
    const predZ = predZall.filter(isLang);
    ok('die Vorhersage entsteht aus dem SNAPSHOT-Zustand (Manipulation nach Anstoss wirkungslos)',
      predZall.length === futureIdx.length && predZ.length === 1 &&
      predZ[0].derivedState.ok === true &&
      ctrl && predZ[0].derivedState.prescriptionHash === ctrl.derivedState.prescriptionHash,
      predZall.length + ' preds; hashGleich=' + String(predZ.length === 1 && ctrl &&
        predZ[0].derivedState.prescriptionHash === ctrl.derivedState.prescriptionHash));
  } else {
    ok('(Sonntag: entfaellt kalendarisch)', true); ok('(entfaellt)', true); ok('(entfaellt)', true);
  }
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z23 · PRODUKTKETTE der Sicherheitssignale: DB-Check-ins → C2-Formen');
{
  /* Der v8-300-Review: Getestet waren nur direkt eingesetzte Werte —
     die Kette morning.ill / morning.redFlags / PROFILE.constraints fehlte.
     Hier laeuft sie ECHT: DB-Tagesstruktur → ui-Extraktion → Adapter →
     Schatten-Kontext. */
  const DBfix = {};
  /* v8-308: relativ zum FEST INJIZIERTEN today — mit der echten Uhr laegen
     die Check-ins neben dem Fixture-Kalender und „heute" waere nie heute. */
  const dIso = n => addD(today, -n);
  DBfix[dIso(5)] = { morning: { ill: true } };
  DBfix[dIso(4)] = { morning: { ill: false } };
  DBfix[dIso(3)] = { morning: { ill: false } };
  /* dIso(2): LUECKE — unknown */
  DBfix[dIso(1)] = { morning: { ill: false } };
  DBfix[dIso(0)] = { morning: { ill: false, redFlags: { chestPain: true } } };
  /* v8-302: Die KANONISCHE Quelle ist constraintsList — PROFILE.constraints
     existiert im Produkt nirgends. Das Testprofil setzt AUSDRUECKLICH nur
     constraintsList; ein Zurueckfallen auf die Phantom-Eigenschaft koennte
     hier nie wieder gruen erscheinen. */
  const r24 = runAWP({ PROFILE: { weekPlan: mkPlan(),
    constraintsList: [{ bodyRegion: 'knee', intensity: 5, currentlyTrainable: false, status: 'active' }] },
    DB: DBfix });
  r24.api.activeWeekPlan();
  const s24 = r24.calls.shadow[0];
  ok('die Krankheits-EPISODE erreicht den Schatten (aus echten DB-Check-ins)',
    s24.interruption && s24.interruption.reason === 'illness' &&
    s24.interruption.lastPositiveDay === dIso(5),
    JSON.stringify(s24.interruption));
  ok('… mit korrekt gezählter Streak (Lücke bricht: 2, nicht 4)',
    s24.interruption.symptomFreeDays === 2, String(s24.interruption.symptomFreeDays));
  ok('der heutige Brustschmerz-Red-Flag wird zur systemischen Vollsperre',
    Array.isArray(s24.constraints) &&
    s24.constraints.some(c => c.source === 'red_flag:chestPain' && c.severity === 3),
    JSON.stringify((s24.constraints || []).map(c => c.source)));
  ok('die Profilbeschwerde (nicht trainierbar) kommt als severity 3 an',
    s24.constraints.some(c => c.region === 'knee' && c.severity === 3 && c.blocks.indexOf('all') >= 0));
  const uiC = uiRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('… und ui beschafft die Quellen NUR über observer-source (v8-303)',
    /ORVIA\.observerSource/.test(uiC) && /safetyConstraints\(/.test(uiC) &&
    /checkinSeries\(/.test(uiC) &&
    !/Array\.isArray\(PROFILE\.constraints\)/.test(uiC) &&
    !/for\(var b=0;b<28;b\+\+\)/.test(uiC));
  /* Und die ECHTE C2 blockiert damit. */
  const PR23 = require(join(APP, 'js/engine/progression.js'));
  const dec23 = PR23.progressionDecision({ loadHistory: null, toleranceState: null,
    constraints: s24.constraints });
  ok('die echte C2 blockiert auf diesem Kontext', dec23.status === 'blocked', dec23.status);
  /* UND DURCH DIE SA-KETTE — nicht nur im Direktaufruf: Laesst der
     Schatten die constraints auf dem Weg zu C2 fallen, faellt genau
     dieser Test. */
  const SA23 = require(join(APP, 'js/engine/shadow-adaptive.js'));
  const REG23 = {
    loadHistory: require(join(APP, 'js/engine/load-history.js')),
    sessionDebrief: SD, evidence: require(join(APP, 'js/engine/evidence.js')),
    loadProfile: require(join(APP, 'js/engine/load-profile.js')),
    progression: PR23,
    goalFeasibility: require(join(APP, 'js/engine/goal-feasibility.js')),
    planTranslator: require(join(APP, 'js/engine/plan-translator.js')),
    weekPlanDesigner: require(join(APP, 'js/engine/week-plan-designer.js')),
    weekPlanPolicy: require(join(APP, 'js/engine/week-plan-policy.js')),
    observerInput: OI,
    observerSource: require(join(APP, 'js/engine/observer-source.js'))
  };
  const obs23 = SA23.observe(SA23.snapshot(s24), { registry: REG23 });
  ok('… und durch die ECHTE Schatten-Kette ebenfalls (constraints erreichen C2)',
    obs23.progression && obs23.progression.status === 'blocked',
    obs23.progression ? obs23.progression.status : 'null');

  /* DER 29-TAGE-PRODUKTFALL (v8-303, Gians Gegenprobe): DB[heute-29] krank,
     sonst nichts — durch das ECHTE activeWeekPlan. Die alte ui-Extraktion
     brach nach 28 Tagen ab und KONNTE Tag 29 nie finden; der Adaptertest
     bestand nur, weil er seine Serie selbst konstruierte. */
  const DB29 = {};
  DB29[dIso(29)] = { morning: { ill: true } };
  const r29 = runAWP({ PROFILE: { weekPlan: mkPlan() }, DB: DB29 });
  r29.api.activeWeekPlan();
  const s29 = r29.calls.shadow[0];
  ok('DER 29-TAGE-FALL: die Episode erreicht den Schatten durch den ECHTEN Produktpfad',
    s29.interruption && s29.interruption.reason === 'illness' &&
    s29.interruption.lastPositiveDay === dIso(29) && s29.interruption.symptomFreeDays === 0,
    JSON.stringify(s29.interruption));

  /* HASH-STABILITAET BEI AKTIVEN BESCHWERDEN (v8-303, Gians Gegenprobe):
     unveraendertes Profil mit constraintsList UND Legacy-issue, zwei
     Planlaeufe mit Abstand — EIN Snapshot-Hash, EINE Beobachtung. Die alte
     profileModel-Normalisierung zog Uhr (updatedAt) und Zufalls-IDs in den
     Hash: Drossel wirkungslos, Log laeuft voll. */
  const rHash = runAWP({ PROFILE: { weekPlan: mkPlan(),
    constraintsList: [{ bodyRegion: 'knee', intensity: 6, currentlyTrainable: true, status: 'active' }],
    issues: ['achilles'] } });
  rHash.api.activeWeekPlan();
  await tick(25);
  rHash.api.activeWeekPlan();
  ok('unverändertes Profil mit aktiven Beschwerden ⇒ EIN Hash, EINE Beobachtung (25 ms Abstand)',
    rHash.calls.shadow.length === 1 &&
    rHash.calls.shadow[0].inputBasis.profileConstraints === 'provided',
    'obs=' + rHash.calls.shadow.length);
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z24 · DIE VOLLE KETTE mit dem ECHTEN logWeekShadow — bis in den Log-Record');
{
  /* DER v8-303-P0: gmObserveWeekPlan uebergab constraints/inputHash/
     inputVersion/inputBasis korrekt — aber O.logWeekShadow baute einen
     ZWEITEN, handgepflegten Feldkatalog fuer SA.snapshot() und verwarf
     alle vier. Die Tests sahen es nicht, weil runAWP logWeekShadow durch
     einen Sammler ersetzte und Z23 SA.snapshot selbst aufrief. Dieser
     Test fuehrt die ECHTE Kette: activeWeekPlan → gmObserveWeekPlan →
     ECHTES O.logWeekShadow → SA.snapshot → SA.observe → Decision Log,
     und prueft den FERTIGEN Record. */
  const SA24 = require(join(APP, 'js/engine/shadow-adaptive.js'));
  const shadowSlices =
    sliceBalanced(uiRaw, 'function _decisionId(') + '\n' +
    'var _shadowSeen = [];\n' +
    sliceBalanced(uiRaw, 'O.logWeekShadow=function');
  const DBs = {};
  /* v8-308: relativ zum fest injizierten today (siehe Z0). */
  const dI = n => addD(today, -n);
  DBs[dI(0)] = { morning: { ill: false, redFlags: { chestPain: true } } };
  const acts24 = [];
  for (let i = 0; i < 28; i++) acts24.push({ id: 'a' + i, localDate: dI(27 - i),
    sport: 'running', subType: 'easy', durationMin: 60, distanceKm: 10, source: 'sync' });
  const r25 = runAWP({ PROFILE: { weekPlan: mkPlan(), level: 'ambitioniert',
    constraintsList: [{ bodyRegion: 'knee', intensity: 5, currentlyTrainable: false, status: 'active' }] },
    DB: DBs, acts: acts24,
    goal: { type: 'half_marathon', distanceKm: 21.0975, raceDate: addD(today, 90), targetMin: 110 } });
  /* Das ECHTE logWeekShadow ersetzt den Sammler; Registry + Log am OO. */
  /* DER SAMMLER BAUT DEN ECHTEN RECORD (v8-304c, Gians Praezisierung):
     Ein blosses push(e) prueft die toLogEntry-EINGABE — nicht das, was
     decisionLog.build() daraus macht und die Senke persistiert. Jeder
     Eintrag laeuft deshalb durch das ECHTE DL.build(); gesammelt wird der
     GEBAUTE Record (mit decisionHash, decisionRuntimeHash, v) plus
     valid-Flag. Ein Feld, das build() verwirft oder das die
     NOT-NULL-Spalten der Senke verletzt, faellt hier auf. */
  const DL24 = require(join(APP, 'js/engine/decision-log.js'));
  const logged24 = [];
  Object.assign(r25.OO, {
    shadowAdaptive: SA24,
    decisionLog: { logDecision: e => {
      const built = DL24.build(Object.assign({}, e, { registry: e.registry || r25.OO }));
      logged24.push({ valid: built.valid, errors: built.errors || null, record: built.record });
      return built.valid;
    }, recent: () => [] },
    loadHistory: require(join(APP, 'js/engine/load-history.js')),
    sessionDebrief: SD, evidence: require(join(APP, 'js/engine/evidence.js')),
    loadProfile: require(join(APP, 'js/engine/load-profile.js')),
    progression: require(join(APP, 'js/engine/progression.js')),
    goalFeasibility: require(join(APP, 'js/engine/goal-feasibility.js')),
    planTranslator: require(join(APP, 'js/engine/plan-translator.js')),
    weekPlanDesigner: require(join(APP, 'js/engine/week-plan-designer.js')),
    weekPlanPolicy: require(join(APP, 'js/engine/week-plan-policy.js')),
    observerInput: OI,
    observerSource: require(join(APP, 'js/engine/observer-source.js')),
    user: { id: 'u1' }
  });
  new Function('O', 'var _n=0;\n' + shadowSlices)(r25.OO);
  /* ERSTER RENDER OHNE AUFGELOESTE PERFORMANCE (v8-304-Restluecke, jetzt
     GEPRUEFT statt nur behauptet): basis.performance ist ehrlich
     'unavailable' — der Record ENTSTEHT (beobachten ist erlaubt), aber das
     Gate schliesst ihn aus der Abnahme aus. */
  r25.api.activeWeekPlan();
  await tick(60);
  const bFirst = logged24.find(e => e.record && e.record.decisionType === 'shadow_observation');
  ok('erster Render: DL.build() akzeptiert den Eintrag (valid, keine Fehler)',
    bFirst && bFirst.valid === true, bFirst ? JSON.stringify(bFirst.errors) : 'null');
  const recFirst = bFirst && bFirst.record;
  ok('… der GEBAUTE Record trägt die Senken-Pflichtfelder (decisionHash/RuntimeHash/v)',
    recFirst && recFirst.decisionHash != null && recFirst.decisionRuntimeHash != null &&
    recFirst.v != null,
    recFirst ? [recFirst.decisionHash, recFirst.decisionRuntimeHash, recFirst.v].join('/') : 'null');
  ok('… mit basis.performance=unavailable im PERSISTIERTEN derivedState',
    recFirst && recFirst.derivedState.inputBasis &&
    recFirst.derivedState.inputBasis.performance === 'unavailable',
    recFirst ? JSON.stringify(recFirst.derivedState.inputBasis && recFirst.derivedState.inputBasis.performance) : 'null');
  const SAg = require(join(APP, 'js/engine/shadow-adaptive.js'));
  ok('… und das Gate schließt GENAU diesen Record aus der Abnahme aus',
    (() => { const acc = SAg.acceptance([recFirst.derivedState],
      { cohort: SAg.cohortOf(recFirst.derivedState.versions) });
      return acc.excludedMissingSources === 1 &&
        acc.criteria.find(c => c.id === 'full_chain').realCases === 0; })());
  /* ZWEITER RENDER: der Resolver hat die Performance gesetzt — der
     Snapshot-Hash aendert sich, die Beobachtung laeuft SOFORT erneut. */
  r25.OO._lastPlanPerf = { sports: { running: { ok: true, confidence: 'strong', ageRatio: 0.2,
    halfMarathonEquivalentMin: 112,
    reference: { distanceKm: 21.0975, durationMin: 112, date: addD(today, -14), source: 'race' }, zones: {} } } };
  r25.api.activeWeekPlan();
  await tick(60);
  const b24 = logged24.filter(e => e.record && e.record.decisionType === 'shadow_observation')[1];
  ok('der ECHTE Log-Record entsteht (zweiter Render, mit Performance, valid)',
    b24 && b24.valid === true, String(logged24.length));
  const rec24 = b24 && b24.record;
  const d24 = rec24 && rec24.derivedState;
  ok('… und trägt die EINGANGS-HERKUNFT (inputBasis/-Version/-Hash — vorher verworfen)',
    d24 && d24.inputVersion === OI.VERSION && /^[0-9a-f]{8}$/.test(d24.inputHash) &&
    d24.inputBasis && d24.inputBasis.checkins === 'provided' &&
    d24.inputBasis.profileConstraints === 'provided',
    d24 ? String(d24.inputVersion) + '/' + JSON.stringify(d24.inputBasis || null) : 'null');
  ok('… C2 ist BLOCKIERT (Beschwerde + Red Flag erreichen die Progression)',
    d24 && d24.progression && d24.progression.status === 'blocked',
    d24 && d24.progression ? d24.progression.status : 'null');
  ok('… und das fail-closed-Gate NIMMT diesen Record AN (Basis vollständig)',
    (() => { const acc = SA24.acceptance([d24], { cohort: SA24.cohortOf(d24.versions) });
      return acc.excludedMissingSources === 0; })());
}

/* ══════════════════════════════════════════════════════════════ */
sec('Z7 · Quelltext-Vertraege der Einhaengung');
{
  const src = uiRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  ok('der Planlauf ruft logWeekPredictions NACH logWeekShadow',
    src.indexOf('ORVIA.logWeekShadow({') > 0 &&
    src.indexOf('ORVIA.logWeekPredictions({') > src.indexOf('ORVIA.logWeekShadow({'));
  const lwp = src.slice(src.indexOf('O.logWeekPredictions=function'),
    src.indexOf('O.resolveDebriefPrediction=function'));
  ok('logWeekPredictions weist dem Plan NIE etwas zu (kein w= / plan[..]=)',
    !/\bw\s*=/.test(lwp) && !/currentPlan\s*\[/.test(lwp) && !/plan\s*\[\s*\w+\s*\]\s*=/.test(lwp));
  ok('beide Funktionen pruefen das Flag als ERSTE Bedingung',
    /isEnabled\('prediction_observer'\)/.test(lwp) &&
    /isEnabled\('prediction_observer'\)/.test(src.slice(src.indexOf('O.resolveDebriefPrediction=function'))));
  ok('der Planlauf traegt den Retry-Herzschlag (reconcilePendingPredictions mit Profil-Speicher)',
    src.indexOf('ORVIA.reconcilePendingPredictions((') > src.indexOf('ORVIA.logWeekPredictions({') &&
    /reconcilePendingPredictions\(\(function\(\)\{\s*try\{return \(typeof gmDbStore==='function'&&gmDbStore\(\)\)\|\|\[\];/.test(src));
  const save = src.slice(src.indexOf('function gmDbSave'), src.indexOf('function gmDbSave') + 4000);
  ok('gmDbSave: resolve laeuft NACH upsert und saveProfile',
    save.indexOf('debriefRecord.upsert') > 0 && save.indexOf('saveProfile') > 0 &&
    save.indexOf('resolveDebriefPrediction') > save.indexOf('saveProfile'));

  /* Flag-Infrastruktur: Modul und Migration fuehren dasselbe Flag; 0031
     bleibt unangetastet (Geschichtsfaelschungs-Verbot). */
  const ff = readFileSync(join(APP, 'js/engine/feature-flags.js'), 'utf8');
  ok('feature-flags@2 kennt prediction_observer',
    /feature-flags@2/.test(ff) && /'prediction_observer'/.test(ff));
  const mig34 = join(HERE, '..', 'migrations', '0034_prediction_observer_flag.sql');
  ok('Migration 0034 existiert und fuehrt das Flag',
    existsSync(mig34) && /'prediction_observer'/.test(readFileSync(mig34, 'utf8')));
  ok('0031 bleibt unveraendert',
    !/prediction_observer/.test(readFileSync(join(HERE, '..', 'migrations', '0031_feature_flags.sql'), 'utf8')));
}

console.log('\n' + '═'.repeat(62));
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
