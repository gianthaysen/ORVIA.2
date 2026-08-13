/* ORVIA · Phase 8.4 — Aktivierungspfad und Canary-Gate-Auswerter.

   DER PUNKT, UM DEN ES GEHT: Im Umsetzungsplan stand unter 8.2 offen:
   „Test: manuelle Overrides des Nutzers überleben den Weg — setzt den
   Aktivierungspfad voraus". Genau dieser Pfad ist jetzt gebaut, und dieser Test
   ist der Beleg. Er prüft nicht, dass Overrides „meistens" überleben, sondern die
   härtere Zusage: sie gehen NIE still verloren. Entweder sie überleben, oder die
   Aktivierung findet nicht statt.

   Geprüft werden vier Klassen von Zusagen:
     1. Fail-closed — Flag aus und jeder Defekt der Kette lassen den Plan in Ruhe.
     2. Override-Erhalt — Buchhaltung geht auf, Verwerfen führt zur Verweigerung.
     3. Reinheit — pur, deterministisch, mutiert die Eingabe nicht.
     4. Canary-Auswerter — drei Zustände, insufficient_data ist nicht pass,
        Richtungsabhängigkeit bei der Abbruchrate, keine Begriffsdrift zwischen
        den Gründen, die der Aktivierungspfad sendet, und denen, die der
        Auswerter kennt.

   node supabase/tests/phase8_plan_activation_test.mjs [appRoot-absolut] */
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
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

globalThis.ORVIA = globalThis.ORVIA || {};
const PD = require(join(APP, 'js/plan-domain.js'));
const WP = require(join(APP, 'js/engine/week-projection.js'));
const PA = require(join(APP, 'js/engine/plan-activation.js'));
const CE = require(join(APP, 'js/engine/canary-eval.js'));
globalThis.ORVIA.planDomain = PD;
globalThis.ORVIA.weekProjection = WP;

const NOW = '2026-08-06T06:00:00.000Z';
const WEEK = '2026-W32';

/* Deterministische ID-Fabrik: ohne sie wäre jeder Lauf anders und „deterministisch"
   nicht prüfbar. */
const mkIdFactory = () => { let n = 0; return () => 'ps:en:' + (n++); };

const mkSession = (id, wd, sport, type, secs) => ({
  sessionId: id, weekday: wd, sportId: sport,
  prescription: { sport_id: sport, session_type: type, goal: 'g', priority: 'build',
    blocks: [{ type: 'work', completion: { type: 'duration', value: secs, unit: 's' } }] },
  flags: [], provenance: { scheduler: 'scheduler-v2@1', policy: 'p', solver: 's',
    factory: 'f', templateId: type, paceEvidenceUsed: false, requirementId: 'r' } });

const schedOut = (sessions) => ({ ok: true, weekKey: WEEK,
  provenance: { scheduler: 'scheduler-v2@1', policy: 'p' }, sessions: sessions });

const OUT_A = schedOut([
  mkSession('s0', 'mo', 'running', 'endurance_easy', 2700),
  mkSession('s1', 'mi', 'gym', 'strength_general', 3600),
  mkSession('s2', 'so', 'running', 'endurance_long', 6300)
]);
const OUT_B = schedOut([
  mkSession('s0', 'di', 'running', 'endurance_easy', 3000),
  mkSession('s1', 'mi', 'gym', 'strength_general', 3600),
  mkSession('s2', 'so', 'running', 'endurance_long', 7200)
]);

/* Ein kanonischer Plan mit einer stabilen ps:-Session, auf die ein Override zeigt. */
function mkPlan(overrides) {
  const days = [[{ id: 'ps:keep1', t: 'Laufen', l: 'Z2 Dauerlauf', d: 45 }], [], [], [], [], [], []];
  const baseline = PD.baselineFromDays(days, { source: 'legacy_migration', generatedAt: NOW, idFactory: () => 'ps:seed' });
  return { planId: 'p1', weekKey: WEEK, revision: 1, baseline: baseline,
    overrides: overrides || [], history: [] };
}
const mkOverride = (id, sessionId, type) => ({ overrideId: id, sessionId: sessionId,
  type: type || 'resize', durationMin: 30, reason: 'user_manual', createdAt: NOW });

/* ============ 1) Fail-closed ============ */
sec('1 · Fail-closed — ohne Freigabe passiert nichts');

const base = { plan: mkPlan(), schedulerOutput: OUT_A, now: NOW, idFactory: mkIdFactory(), weekKey: WEEK };

{
  const p = mkPlan([mkOverride('o1', 'ps:seed')]);
  const before = JSON.stringify(p);
  const r = PA.activate({ ...base, plan: p, enabled: false });
  ok('Flag aus ⇒ keine Aktivierung, Grund benannt', r.applied === false && r.reason === 'flag_off');
  ok('Flag aus ⇒ der Plan wird nicht angefasst (bitgenau)', JSON.stringify(p) === before);
  ok('Flag aus ⇒ der zurückgegebene Plan ist der unveränderte Eingabeplan', r.plan === p);
}
for (const [label, patch, expect] of [
  ['Flag fehlt (undefined statt true)', { enabled: undefined }, 'flag_off'],
  ['Flag ist die Zeichenkette "true"', { enabled: 'true' }, 'flag_off'],
  ['kein kanonischer Plan', { enabled: true, plan: null }, 'no_canonical_plan'],
  ['Plan ohne Baseline', { enabled: true, plan: { weekKey: WEEK } }, 'no_canonical_plan'],
  ['plan-domain fehlt', { enabled: true, planDomain: {} }, 'plan_domain_missing'],
  ['Projektionsmodul fehlt', { enabled: true, projection: {} }, 'projection_missing'],
  ['Projektion meldet nicht ok', { enabled: true, schedulerOutput: { ok: false, error: 'x' } }, 'projection_failed'],
  ['Projektion wirft', { enabled: true, projection: { projectWeek: () => { throw new Error('kaputt'); } } }, 'projection_threw'],
  ['leere Woche', { enabled: true, schedulerOutput: schedOut([]) }, 'projection_empty'],
  ['fremder Wochenschlüssel', { enabled: true, schedulerOutput: Object.assign(schedOut([mkSession('s0', 'mo', 'running', 'endurance_easy', 2700)]), { weekKey: '2026-W40' }) }, 'week_key_mismatch']
]) {
  const p = mkPlan([mkOverride('o1', 'ps:seed')]);
  const snap = JSON.stringify(p);
  const r = PA.activate({ ...base, plan: p, idFactory: mkIdFactory(), ...patch });
  if (patch.plan !== undefined) { /* Plan bewusst ersetzt */ }
  ok(label + ' ⇒ ' + expect, r.applied === false && r.reason === expect, 'war: ' + r.reason);
  if (patch.plan === undefined) ok('   … und der Plan bleibt unverändert', JSON.stringify(p) === snap);
}

{
  const out = { ok: false, weekKey: '2026-W40' };
  const r = PA.activate({ ...base, enabled: true, schedulerOutput: out });
  ok('ein fremder Wochenschlüssel wird vor der Projektion abgefangen', r.applied === false);
}

/* ============ 2) Aktivierung und Override-Erhalt ============ */
sec('2 · Aktivierung — manuelle Overrides überleben oder blockieren');

{
  const p = mkPlan();
  const r = PA.activate({ ...base, plan: p, enabled: true, idFactory: mkIdFactory() });
  ok('mit Freigabe und geänderter Woche wird aktiviert', r.applied === true && r.reason === 'applied');
  ok('die neue Baseline stammt erkennbar aus der Engine',
     r.plan.baseline.source === 'engine' && r.plan.baseline.engineVersion === 'scheduler-v2@1');
  ok('die Revision steigt um genau eins', r.plan.revision === 2);
  ok('die Historie hält den Vorgang fest (keine stille Änderung)',
     r.plan.history.length === 1 && r.plan.history[0].reason === 'engine_rebase');
  ok('previous ist eine echte Kopie des Zustands davor (Rückweg möglich)',
     r.previous && r.previous.revision === 1 && r.previous !== p);
  ok('der Eingabeplan wurde NICHT mutiert', p.revision === 1 && p.baseline.source === 'legacy_migration');
  ok('alle drei Engine-Sessions sind in der Baseline angekommen', r.plan.baseline.sessions.length === 3);

  const back = PA.revert(r.previous);
  ok('revert stellt den Zustand davor wieder her',
     back.ok === true && JSON.stringify(back.plan) === JSON.stringify(r.previous));
  ok('revert ohne Schnappschuss verweigert ehrlich', PA.revert(null).ok === false);

  /* Lücke aus dem Probenlauf v8-331 (Muster neighbour_guard): geprüft wurde
     nur die GLEICHHEIT von back.plan und r.previous — die erfüllt eine blosse
     Referenz genauso. Ohne echte Kopie zeigt der wiederhergestellte Plan auf
     denselben Schnappschuss; wer ihn danach bearbeitet, verändert rückwirkend
     den Rückweg und kann kein zweites Mal zurück. */
  ok('revert liefert eine echte KOPIE, nicht den Schnappschuss selbst',
     back.plan !== r.previous && JSON.stringify(back.plan) === JSON.stringify(r.previous));
  ok('  … eine Änderung am zurückgegebenen Plan lässt den Schnappschuss unberührt',
     (() => {
       /* Bezugswerte VOR der Mutation festhalten — `previous` ist der Zustand
          VOR der Aktivierung und hat nicht dieselbe Sessionzahl wie r.plan. */
       const revVorher = r.previous.revision;
       const anzahlVorher = r.previous.baseline.sessions.length;
       const zweiter = PA.revert(r.previous);
       zweiter.plan.revision = 999;
       zweiter.plan.baseline.sessions.length = 0;
       zweiter.plan.baseline.source = 'kaputt';
       return r.previous.revision === revVorher &&
         r.previous.baseline.sessions.length === anzahlVorher &&
         r.previous.baseline.source !== 'kaputt';
     })());
  ok('  … und derselbe Schnappschuss lässt sich mehrfach zurücknehmen (identisches Ergebnis)',
     JSON.stringify(PA.revert(r.previous).plan) === JSON.stringify(back.plan));
  ok('  … auch die Schnappschüsse zweier revert-Aufrufe sind voneinander unabhängig',
     PA.revert(r.previous).plan !== PA.revert(r.previous).plan);
  ok('revert weist untaugliche Eingaben ab statt sie durchzureichen',
     [null, undefined, 'plan', 42].every(v => PA.revert(v).ok === false && PA.revert(v).plan === null));
}

{
  /* Override auf eine Session, die die Engine NICHT mehr liefert ⇒ er würde verworfen. */
  const p = mkPlan([mkOverride('o1', 'ps:seed')]);
  const snap = JSON.stringify(p);
  const r = PA.activate({ ...base, plan: p, enabled: true, idFactory: mkIdFactory() });
  ok('ein Override, der verloren ginge, verhindert die Aktivierung',
     r.applied === false && r.reason === 'would_drop_overrides');
  ok('… und der Plan des Nutzers bleibt exakt so, wie er ihn hinterlassen hat', JSON.stringify(p) === snap);
  ok('… der Vorfall wird mit Detail protokolliert, nicht verschwiegen',
     r.event.droppedDetail && r.event.droppedDetail.length === 1 && r.event.droppedDetail[0].overrideId === 'o1');
}

{
  /* Override vom Typ 'add' hängt an keiner Baseline-Session und übersteht jeden Rebase. */
  const p = mkPlan([{ overrideId: 'oAdd', sessionId: 'ps:frei', type: 'add',
    session: { t: 'Schwimmen', l: 'Technik', d: 40 }, dayIndex: 4, reason: 'user_manual', createdAt: NOW }]);
  const r = PA.activate({ ...base, plan: p, enabled: true, idFactory: mkIdFactory() });
  ok('ein hinzugefügter Termin überlebt die Engine-Aktivierung',
     r.applied === true && r.plan.overrides.length === 1 && r.plan.overrides[0].overrideId === 'oAdd');
  ok('die Buchhaltung ist vollständig: 1 vorher = 1 kept',
     r.event.overrides.before === 1 && r.event.overrides.kept === 1 &&
     r.event.overrides.dropped === 0 && r.event.overrides.conflicts === 0);
  const eff = PD.effectiveSessions(r.plan);
  ok('der hinzugefügte Termin ist im effektiven Plan sichtbar',
     JSON.stringify(eff.days).indexOf('Technik') > 0);
}

{
  /* Buchhaltungsfehler simulieren: ein rebase, das einen Override verschluckt. */
  const p = mkPlan([{ overrideId: 'oAdd', sessionId: 'ps:frei', type: 'add', session: { t: 'X', l: 'Y', d: 10 }, dayIndex: 2, reason: 'r', createdAt: NOW }]);
  const brokenPD = Object.assign({}, PD, {
    rebase: (plan, nb) => ({ plan: Object.assign({}, plan, { baseline: nb, revision: (plan.revision || 1) + 1, overrides: [] }),
      kept: [], retargeted: [], conflicts: [], dropped: [] })   // 1 vorher, 0 verbucht
  });
  const r = PA.activate({ ...base, plan: p, enabled: true, idFactory: mkIdFactory(), planDomain: brokenPD });
  ok('ein Override, der aus der Buchhaltung verschwindet, blockiert die Aktivierung',
     r.applied === false && r.reason === 'override_accounting_mismatch');
  ok('… die Abweichung ist im Ereignis nachvollziehbar',
     r.event.overrides.before === 1 && r.event.overrides.kept === 0);
}

/* ============ 3) Reinheit und Idempotenz ============ */
sec('3 · Reinheit, Determinismus, Idempotenz');

{
  const p1 = mkPlan(), p2 = mkPlan();
  const a = PA.activate({ ...base, plan: p1, enabled: true, idFactory: mkIdFactory() });
  const b = PA.activate({ ...base, plan: p2, enabled: true, idFactory: mkIdFactory() });
  ok('gleiche Eingabe ⇒ byte-gleiche Ausgabe', JSON.stringify(a.plan) === JSON.stringify(b.plan));
}
{
  const p = mkPlan();
  const a = PA.activate({ ...base, plan: p, enabled: true, idFactory: mkIdFactory() });
  const again = PA.activate({ ...base, plan: a.plan, enabled: true, idFactory: mkIdFactory() });
  ok('dieselbe Engine-Woche ein zweites Mal ⇒ keine neue Revision (unchanged)',
     again.applied === false && again.reason === 'unchanged');
  const changed = PA.activate({ ...base, plan: a.plan, enabled: true, schedulerOutput: OUT_B, idFactory: mkIdFactory() });
  ok('eine wirklich geänderte Engine-Woche aktiviert erneut',
     changed.applied === true && changed.plan.revision === 3);
}

/* ── Befund v8-332b: der Fingerabdruck war blind für die Verordnung ──────
   Er verglich nur Tag, Sportart, Einheitenname und Umfangstext. Damit galten
   „4 × 5 min" und „5 × 4 min" als dieselbe Woche — ebenso zwei Einheiten mit
   identischer Struktur, aber verschobenem Pace-Fenster. Folge: Passt die
   Engine die Intervallstruktur an oder verschiebt sie das Tempo, weil eine
   neue Schwellenpace gemessen wurde, meldet activate() `unchanged` und
   aktiviert NICHT. Die neue Vorgabe erreicht den Nutzer nie. */
{
  const mkRx = (blocks) => ({ sport_id: 'running', session_type: 'endurance_intervals',
    goal: 'vo2max', priority: 'key', blocks: blocks });
  const w = (s, mi, ma) => ({ type: 'work', completion: { type: 'duration', value: s, unit: 's' },
    target: { type: 'pace', min: mi, max: ma } });
  const rec = (s) => ({ type: 'recovery', completion: { type: 'duration', value: s, unit: 's' },
    target: { type: 'open' } });
  const mkOut = (rx) => ({ ok: true, weekKey: WEEK, provenance: { scheduler: 'scheduler-v2@1', policy: 'p' },
    sessions: [{ sessionId: 'iv', weekday: 'di', sportId: 'running', prescription: rx,
      flags: [], provenance: { scheduler: 'scheduler-v2@1', policy: 'p', solver: 's',
        factory: 'f', templateId: 'endurance_intervals', paceEvidenceUsed: true, requirementId: 'r' } }] });

  /* Gleiche Gesamtdauer (4×5 = 5×4 = 20 min Arbeit, Pausen ebenso) — der alte
     Fingerabdruck sah hier keinen Unterschied. */
  const A = mkOut(mkRx([{ type: 'repeat', iterations: 4, blocks: [w(300, 276, 294), rec(180)] }]));
  const B = mkOut(mkRx([{ type: 'repeat', iterations: 5, blocks: [w(240, 276, 294), rec(144)] }]));
  /* Gleiche Struktur, NEUES Tempofenster (z. B. nach einem Schwellentest). */
  const C = mkOut(mkRx([{ type: 'repeat', iterations: 4, blocks: [w(300, 250, 268), rec(180)] }]));

  const p0 = mkPlan();
  const a = PA.activate({ ...base, plan: p0, enabled: true, schedulerOutput: A, idFactory: mkIdFactory() });
  ok('Ausgangslage: die Intervallwoche wird aktiviert', a.applied === true);
  ok('  … und ihre Umfangsangabe ist bei allen drei Fassungen dieselbe (deshalb war der alte Vergleich blind)',
     (() => {
       const d = (out) => WP.projectWeek(out).days[1][0].d;
       return d(A) === d(B) && d(B) === d(C);
     })(), 'd = ' + WP.projectWeek(A).days[1][0].d);

  const sameAgain = PA.activate({ ...base, plan: a.plan, enabled: true, schedulerOutput: A, idFactory: mkIdFactory() });
  ok('IDEMPOTENZ bleibt: dieselbe Verordnung erneut ⇒ unchanged (kein Revisions-Karussell)',
     sameAgain.applied === false && sameAgain.reason === 'unchanged');

  const struktur = PA.activate({ ...base, plan: a.plan, enabled: true, schedulerOutput: B, idFactory: mkIdFactory() });
  ok('4 × 5 min → 5 × 4 min wird als Änderung ERKANNT und aktiviert',
     struktur.applied === true, struktur.reason);

  const tempo = PA.activate({ ...base, plan: a.plan, enabled: true, schedulerOutput: C, idFactory: mkIdFactory() });
  ok('ein verschobenes Pace-Fenster bei gleicher Struktur wird ebenfalls erkannt',
     tempo.applied === true, tempo.reason);

  ok('die aktivierte Woche trägt die Verordnung bis in die persistierte Baseline',
     (() => {
       const s = tempo.plan.baseline.sessions.find(x => x.session && x.session.rx);
       return !!(s && s.session.rx.blocks && s.session.rx.blocks.length);
     })());

  /* Legacy-Einheiten ohne Verordnung dürfen sich durch die Erweiterung NICHT
     anders verhalten — sonst hätte der Fix eine stille Nebenwirkung. */
  /* Nebenbefund aus Probe A8: eine Verordnung, die sich nicht serialisieren
     lässt, darf NICHT alle auf denselben Ersatzwert werfen — dann wäre der
     Vergleich für genau diese Fälle wieder blind. */
  ok('eine nicht serialisierbare Verordnung bleibt trotzdem unterscheidbar',
     (() => {
       const zyk = (typ, val) => { const rx = { session_type: typ,
         blocks: [{ type: 'work', completion: { value: val }, target: { min: 280 } }] };
         rx.self = rx; return rx; };
       const fp = (rx) => PA.baselineFingerprint([{ dayIndex: 1, session: { t: 'L', l: 'I', d: '32 min', rx: rx } }]);
       const a = fp(zyk('endurance_intervals', 300));
       const b = fp(zyk('endurance_intervals', 240));
       const c = fp(zyk('endurance_tempo', 300));
       return a !== b && a !== c && a === fp(zyk('endurance_intervals', 300));
     })());
  ok('Einheiten OHNE Verordnung verhalten sich unverändert (leerer Anteil im Fingerabdruck)',
     PA.baselineFingerprint([{ dayIndex: 0, session: { t: 'Laufen', l: 'Dauerlauf', d: '45 min' } }]) ===
     '0|Laufen|Dauerlauf|45 min|');
}
{
  const src = readFileSync(join(APP, 'js/engine/plan-activation.js'), 'utf8');
  /* Erst am Abschnitt trennen, DANN Kommentare entfernen — sonst verschwindet die
     Trennmarke mit dem Kommentar und der Storage-Teil landet in der Prüfung. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  const pure = src.split('/* ---- Protokoll')[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  ok('activate() zieht keine eigene Uhr (Zeitstempel kommen herein)',
     !/new Date\(|Date\.now\(/.test(pure));
  ok('activate() würfelt nicht (ID-Fabrik ist injizierbar)', !/Math\.random/.test(pure));
  ok('activate() liest kein DOM und keinen Storage',
     !/document\./.test(pure) && !/localStorage/.test(pure));
  ok('das Modul liest das Flag nicht selbst — der Aufrufer übergibt die Schaltung',
     !/featureFlags\.isEnabled/.test(code));
}

/* ============ 4) Canary-Auswerter ============ */
sec('4 · Canary-Gate — drei Zustände, insufficient_data ist nicht pass');

const IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];
{
  const r = CE.evaluate({});
  ok('leere Eingabe ⇒ Gate NICHT bereit', r.gateReady === false);
  ok('alle sieben Kriterien werden gemeldet',
     JSON.stringify(r.criteria.map(c => c.id)) === JSON.stringify(IDS));
  ok('leere Eingabe ⇒ kein einziges pass, alles insufficient_data',
     r.criteria.every(c => c.status === 'insufficient_data') && r.blockers.length === 0);
  ok('der nächste Schritt benennt, was fehlt', /^collect_more_data:/.test(r.nextStep));
}

/* Vollbeleg-Grundlage: 30 Versuche, davon 25 angewandt, keine Fehler. */
const mkEv = (reason, extra) => Object.assign({ at: NOW, reason: reason, applied: reason === 'applied',
  overrides: { before: 1, kept: 1, retargeted: 0, conflicts: 0, dropped: 0 } }, extra || {});
const goodLog = []
  .concat(Array.from({ length: 25 }, () => mkEv('applied')))
  .concat(Array.from({ length: 5 }, () => mkEv('unchanged', { applied: false })))
  .concat(Array.from({ length: 40 }, () => mkEv('flag_off', { applied: false, overrides: null })));
const wk = (n, aborted) => Array.from({ length: n }, (_, i) => ({ status: i < aborted ? 'aborted' : 'completed' }));
const fullInput = {
  activationLog: goodLog,
  flag: { source: 'server', cohort: 'canary-1', enabled: true },
  channel: { clientWritable: false, serverAuthoritative: true, killSwitchAvailable: true },
  cohort: { size: 1, max: 5 },
  legacy: { generatorPresent: true, legacyPathIntact: true },
  revert: { tested: true, at: NOW, evidence: 'phase8_plan_activation_test' },
  workouts: { before: wk(20, 2), after: wk(20, 2) }
};
{
  const r = CE.evaluate(fullInput);
  ok('mit vollständigen Belegen schließt das Gate', r.gateReady === true, JSON.stringify(r.pending) + JSON.stringify(r.blockers));
  ok('… und der nächste Schritt ist die Live-Stufe', r.nextStep === 'canary_gate_passed_proceed_to_live');
}

/* Jede Belegquelle einzeln wegnehmen — das Gate muss jedes Mal aufgehen. */
for (const [label, patch, crit, expect] of [
  ['Kohortengröße unbekannt', { cohort: {} }, 'C1', 'insufficient_data'],
  ['Kohorte zu groß', { cohort: { size: 400 } }, 'C1', 'fail'],
  ['Flag kam nicht vom Server', { flag: { source: 'no_client_or_user' } }, 'C2', 'fail'],
  ['Client könnte selbst schreiben', { channel: { clientWritable: true } }, 'C2', 'fail'],
  ['Schreibrechte unbekannt', { channel: {} }, 'C2', 'insufficient_data'],
  ['Notabschaltung statt Serverbeleg', { flag: { source: 'kill_switch' } }, 'C2', 'fail'],
  ['Legacy-Generator fehlt', { legacy: { generatorPresent: false, legacyPathIntact: true } }, 'C3', 'fail'],
  ['Legacy-Zustand unbekannt', { legacy: {} }, 'C3', 'insufficient_data'],
  ['Rückweg nie ausgeführt', { revert: {} }, 'C4', 'insufficient_data'],
  ['Rückweg fehlgeschlagen', { revert: { tested: false } }, 'C4', 'fail'],
  ['zu wenige Versuche', { activationLog: goodLog.slice(0, 3) }, 'C5', 'insufficient_data'],
  ['zu wenige Workouts vorher', { workouts: { before: wk(3, 0), after: wk(20, 2) } }, 'C6', 'insufficient_data'],
  ['gar keine Workouts', { workouts: {} }, 'C6', 'insufficient_data']
]) {
  const r = CE.evaluate({ ...fullInput, ...patch });
  const c = r.criteria.find(x => x.id === crit);
  ok(label + ' ⇒ ' + crit + ' = ' + expect, c.status === expect, 'war: ' + c.status);
  ok('   … Gate schließt nicht', r.gateReady === false);
}

{
  const bad = goodLog.concat(Array.from({ length: 3 }, () => mkEv('projection_threw', { applied: false, error: 'x' })));
  const r = CE.evaluate({ ...fullInput, activationLog: bad });
  const c5 = r.criteria.find(c => c.id === 'C5');
  ok('Fehlerquote 3/33 ≈ 9 % über dem 2-%-Grenzwert ⇒ C5 fail', c5.status === 'fail');
  ok('… der Wert ist nachrechenbar ausgewiesen',
     c5.value === Math.round((3 / 33) * 10000) / 10000 && c5.evidence.attempts === 33);
  ok('… flag_off zählt nicht in den Nenner (sonst ließe sich die Quote kleinrechnen)',
     c5.evidence.totalEvents === 73 && c5.evidence.attempts === 33);
}
{
  const unknown = goodLog.concat([mkEv('irgendein_neuer_grund', { applied: false })]);
  const r = CE.evaluate({ ...fullInput, activationLog: unknown });
  const c5 = r.criteria.find(c => c.id === 'C5');
  ok('ein unbekannter Ausgangsgrund macht C5 zu insufficient_data statt still zu „kein Fehler"',
     c5.status === 'insufficient_data' && c5.evidence.unclassifiedReasons.length === 1);
}
{
  const r = CE.evaluate({ ...fullInput, workouts: { before: wk(20, 2), after: wk(20, 8) } });
  const c6 = r.criteria.find(c => c.id === 'C6');
  ok('Abbruchrate 10 % → 40 % ⇒ C6 fail', c6.status === 'fail' && c6.value === 0.3);
}
{
  const r = CE.evaluate({ ...fullInput, workouts: { before: wk(20, 8), after: wk(20, 2) } });
  const c6 = r.criteria.find(c => c.id === 'C6');
  ok('gesunkene Abbruchrate blockiert NICHT (richtungsabhängig wie S2)',
     c6.status === 'pass' && c6.value === -0.3);
}
{
  const lost = goodLog.concat([mkEv('override_accounting_mismatch', { applied: false })]);
  const r = CE.evaluate({ ...fullInput, activationLog: lost });
  const c7 = r.criteria.find(c => c.id === 'C7');
  ok('eine Buchhaltungsabweichung ⇒ C7 fail (der schwerwiegendste Befund)', c7.status === 'fail');
}
{
  const applied0 = goodLog.map(e => e.reason === 'applied'
    ? Object.assign({}, e, { overrides: { before: 0, kept: 0, retargeted: 0, conflicts: 0, dropped: 0 } }) : e);
  const r = CE.evaluate({ ...fullInput, activationLog: applied0 });
  const c7 = r.criteria.find(c => c.id === 'C7');
  ok('Aktivierungen ganz ohne Overrides belegen nichts ⇒ C7 insufficient_data',
     c7.status === 'insufficient_data');
}
{
  const guarded = goodLog.concat(Array.from({ length: 2 }, () => mkEv('would_drop_overrides', { applied: false })));
  const r = CE.evaluate({ ...fullInput, activationLog: guarded });
  const c5 = r.criteria.find(c => c.id === 'C5');
  const c7 = r.criteria.find(c => c.id === 'C7');
  ok('eine verhinderte Verlustsituation zählt NICHT als technischer Fehler', c5.status === 'pass');
  ok('… sie wird aber als verhinderter Verlust ausgewiesen', c7.evidence.preventedLosses === 2);
  ok('… und blockiert das Gate nicht, weil nichts verloren ging', c7.status === 'pass');
}
{
  const a = JSON.stringify(CE.evaluate(fullInput));
  const b = JSON.stringify(CE.evaluate(fullInput));
  ok('der Auswerter ist deterministisch', a === b);
  const snap = JSON.stringify(fullInput);
  CE.evaluate(fullInput);
  ok('der Auswerter mutiert seine Eingabe nicht', JSON.stringify(fullInput) === snap);
}

/* ---- Begriffsdrift zwischen Sender und Auswerter ---- */
sec('4b · Keine Begriffsdrift zwischen Aktivierungspfad und Auswerter');
{
  const src = readFileSync(join(APP, 'js/engine/plan-activation.js'), 'utf8');
  const emitted = new Set();
  (src.match(/no\('([a-z_]+)'/g) || []).forEach(m => emitted.add(m.slice(4, -1)));
  emitted.add('applied');
  const known = new Set([].concat(CE.ERROR_REASONS, CE.BENIGN_REASONS, CE.OVERRIDE_GUARD_REASONS));
  const missing = [...emitted].filter(r => !known.has(r)).sort();
  const stale = [...known].filter(r => !emitted.has(r)).sort();
  ok('jeder Grund, den der Aktivierungspfad sendet, ist dem Auswerter bekannt',
     missing.length === 0, missing.join(','));
  ok('der Auswerter kennt keinen Grund, den es nicht mehr gibt', stale.length === 0, stale.join(','));
  ok('die drei Gründelisten überschneiden sich nicht',
     known.size === CE.ERROR_REASONS.length + CE.BENIGN_REASONS.length + CE.OVERRIDE_GUARD_REASONS.length);
}

/* ---- Einbindung ---- */
sec('Einbindung');
{
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('index.html lädt plan-activation.js', html.indexOf('js/engine/plan-activation.js') > 0);
  ok('index.html lädt canary-eval.js', html.indexOf('js/engine/canary-eval.js') > 0);
  ok('plan-activation wird NACH plan-domain und week-projection geladen',
     html.indexOf('js/engine/plan-activation.js') > html.indexOf('js/plan-domain.js') &&
     html.indexOf('js/engine/plan-activation.js') > html.indexOf('js/engine/week-projection.js'));
  ok('sw.js cacht beide Dateien',
     sw.indexOf('./js/engine/plan-activation.js') > 0 && sw.indexOf('./js/engine/canary-eval.js') > 0);
}

console.log('\nphase8_plan_activation: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
