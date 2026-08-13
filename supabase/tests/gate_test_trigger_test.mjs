/* ORVIA · v8-328 — Gerätetest-Auslöser IN der App

   BEFUND: Der Push liess sich nur ueber tools/device-test-push.mjs ausloesen,
   also nur am Rechner. Im Gym ist das unbrauchbar — und genau dort steht Gian,
   wenn er G1 durchfuehrt.

   Der Auslöser darf aber KEIN Produktknopf sein: der produktive Pfad bleibt
   bis G1–G3 geschlossen. Deshalb ein Abschnitt, der ausschliesslich mit
   ?gate=1 in der Adresse erscheint und nirgends gespeichert wird.

     T1  Sichtbarkeit: nur mit ?gate=1, kein Speichern, kein Produktweg
     T2  EINE Wahrheit: der In-App-Pfad erzeugt exakt dieselben Werte wie das
         Terminalwerkzeug und dasselbe wie das Protokollblatt
     T3  Zweistufig: rechnen und senden sind getrennt
     T4  Senden: eigenes Sitzungs-Token, konfigurierter Worker, deviceTest
     T5  Fehlerfaelle werden im Klartext benannt, nicht als Rohstatus
     T6  Fail-closed: ohne Sitzung, ohne Worker, ohne Module passiert nichts

   node supabase/tests/gate_test_trigger_test.mjs [appRoot] */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const src = f => readFileSync(join(APP, f), 'utf8');
const uiSrc = src('js/ui.js');
const toolSrc = src('tools/device-test-push.mjs');

/* Den zusammenhaengenden Gate-Block aus ui.js herausschneiden. */
const blkStart = uiSrc.indexOf('var _gmGate={built:null');
const blkEnd = uiSrc.indexOf('\n}\n', uiSrc.indexOf('function gmGateTestSection()')) + 3;
const gateBlk = uiSrc.slice(blkStart, blkEnd);

function makeSb(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.String = String;
  sb.Number = Number; sb.Math = Math; sb.Date = Date; sb.URLSearchParams = URLSearchParams;
  sb.Promise = Promise; sb.setTimeout = setTimeout;
  sb.location = { search: opts.search !== undefined ? opts.search : '?gate=1' };
  sb.todayStr = () => '2026-08-12';
  sb.renders = 0; sb.gmRerenderConnections = () => { sb.renders++; };
  sb.gmEsc = x => String(x == null ? '' : x);
  sb.icon = () => '';
  sb.rows = [];
  sb.gmPRow = (ic, title, note, val, act, dis) => {
    sb.rows.push({ ic, title, note, val, act, dis });
    return '<row>' + title + '|' + note + '|' + val + '|' + act + '|' + (dis ? 'aus' : 'an') + '</row>';
  };
  sb.ORVIA_CFG = opts.worker === null ? {} : { GARMIN_WORKER_URL: opts.worker || 'https://worker.test' };
  sb.fetchCalls = [];
  sb.fetch = async (url, init) => {
    sb.fetchCalls.push({ url, init });
    if (opts.fetchThrows) throw new Error('network');
    const st = opts.status || 200;
    const body = opts.body !== undefined ? opts.body : { ok: true, workoutId: '987654', status: 'pushed' };
    return { status: st, text: async () => JSON.stringify(body) };
  };
  vm.createContext(sb);
  for (const f of ['js/training-domain.js', 'js/engine/strength-plan.js',
    'js/engine/garmin-exercise-map.js', 'js/engine/garmin-workout-export.js']) {
    vm.runInContext(src(f), sb, { filename: f });
  }
  /* Anmeldung wie in der App: ORVIA.sb.auth.getSession(). */
  sb.ORVIA.sb = opts.noSession ? null : {
    auth: { getSession: async () => ({ data: { session: { access_token: opts.token || 'jwt-abc' } } }) }
  };
  if (opts.noModules) { sb.ORVIA.garminWorkoutExport = undefined; }
  vm.runInContext(gateBlk, sb, { filename: 'ui.js#gate' });
  return sb;
}
const tick = () => new Promise(r => setTimeout(r, 5));

/* ══ T1 · Sichtbarkeit ══ */
sec('T1 · Nur mit ?gate=1 — kein Produktweg');
ok('mit ?gate=1 sichtbar', makeSb({ search: '?gate=1' }).gmGateOn() === true);
ok('ohne Parameter unsichtbar', makeSb({ search: '' }).gmGateOn() === false);
for (const s of ['?gate=0', '?gate=true', '?gate', '?gate=1x', '?x=1']) {
  ok('  „' + s + '" schaltet NICHT frei', makeSb({ search: s }).gmGateOn() === false);
}
ok('unsichtbar liefert der Abschnitt einen LEEREN String (kein leeres Gerüst)',
  makeSb({ search: '' }).gmGateTestSection() === '');
ok('sichtbar liefert er einen Abschnitt mit Überschrift',
  /Gerätetest G1–G3/.test(makeSb({}).gmGateTestSection()));
ok('der Zustand wird NIRGENDS gespeichert (kein localStorage im Block)',
  !/localStorage|sessionStorage|indexedDB/.test(gateBlk));
ok('der Abschnitt haengt an der Geräte-Seite, nicht am Plan oder am Training',
  /gmGateTestSection\(\)/.test(uiSrc) &&
  uiSrc.indexOf('gmGateTestSection()') > uiSrc.indexOf('function gmProfConnections'));
ok('er sagt selbst, dass er kein Produktweg ist',
  /Kein Produktweg/.test(makeSb({}).gmGateTestSection()));

/* ══ T2 · EINE Wahrheit ══ */
sec('T2 · Identisch zum Terminalwerkzeug');
const sb2 = makeSb({});
const built = sb2.gmGateBuild();
ok('der Aufbau gelingt', !!built && built.ok === true);
ok('clientRef wie im Werkzeug', sb2.gmGateRef() === 'swe:po:2026-08-12:ps:devicetest:v1', sb2.gmGateRef());
ok('payloadHash wie im Werkzeug', built.payloadHash === 'strength-plan@1:2cf88fd5', built.payloadHash);
ok('sechs Schritte in derselben Reihenfolge',
  built.stepBindings.map(b => b.kind + ':' + b.stepOrder).join(' ') === 'repeat:1 set:2 rest:3 repeat:4 set:5 rest:6',
  built.stepBindings.map(b => b.kind + ':' + b.stepOrder).join(' '));
ok('dieselben zwei Übungen', built.stepBindings.filter(b => b.kind === 'repeat').map(b => b.exerciseName).join(',')
  === 'barbell_bench_press,romanian_deadlift');
const stepsAll = [];
(function walk(l) { for (const s of l) { stepsAll.push(s); if (s.workoutSteps) walk(s.workoutSteps); } })(built.workout.workoutSegments[0].workoutSteps);
ok('dieselben Gewichts-Rohwerte 20000 und 30000',
  stepsAll.filter(s => s.weightValue !== undefined).map(s => s.weightValue).join(',') === '20000,30000');
ok('dieselben Wiederholungen 8 und 6',
  built.stepBindings.filter(b => b.kind === 'set').map(b => b.reps).join(',') === '8,6');
ok('dieselben Pausen 60 und 90',
  built.stepBindings.filter(b => b.kind === 'rest').map(b => b.seconds).join(',') === '60,90');
/* Und das Wichtigste: die Vorgaben stehen NICHT zweimal im Code. Waeren sie
   dupliziert, koennten Werkzeug und App auseinanderlaufen — dann prueft das
   Gate etwas anderes als die App sendet. */
const toolPlanned = toolSrc.match(/targetWeightKg:\s*(\d+)/g).map(s => s.replace(/\D/g, ''));
const uiPlanned = gateBlk.match(/targetWeightKg:\s*(\d+)/g).map(s => s.replace(/\D/g, ''));
ok('Werkzeug und App planen dieselben Gewichte', toolPlanned.join(',') === uiPlanned.join(','),
  toolPlanned.join(',') + ' vs ' + uiPlanned.join(','));
ok('beide oeffnen dieselben Gates ausdruecklich',
  /fillUnverifiedIds:\s*true/.test(gateBlk) && /includeWeight:\s*true/.test(gateBlk) &&
  /fillUnverifiedIds:\s*true/.test(toolSrc) && /includeWeight:\s*true/.test(toolSrc));

/* ══ T3 · Zweistufig ══ */
sec('T3 · Rechnen und Senden sind getrennt');
{
  const sb = makeSb({});
  sb.gmGateTestSection();
  ok('vor dem Rechnen ist „Senden" gesperrt',
    sb.rows.some(r => r.title === 'An Garmin senden' && r.dis === true));
  ok('… und es wurde nichts gesendet', sb.fetchCalls.length === 0);
  sb.rows = []; sb.gmGateCheck(); sb.gmGateTestSection();
  ok('nach dem Rechnen ist „Senden" freigegeben',
    sb.rows.some(r => r.title === 'An Garmin senden' && r.dis === false));
  ok('… und immer noch nichts gesendet (Rechnen geht NICHT ins Netz)', sb.fetchCalls.length === 0);
  ok('die Kontrollwerte stehen zum Vergleich da',
    sb.rows.some(r => r.note.indexOf('swe:po:2026-08-12:ps:devicetest:v1') >= 0) &&
    sb.rows.some(r => r.note === 'strength-plan@1:2cf88fd5'));
  ok('die Schritte sind lesbar aufgeführt',
    sb.rows.some(r => /barbell_bench_press · 2×/.test(r.note) && /8 Wdh\./.test(r.note) && /60 s Pause/.test(r.note)),
    JSON.stringify((sb.rows.find(r => r.title === 'Schritte') || {}).note));
}

/* ══ T4 · Senden ══ */
sec('T4 · Der Sendeweg');
{
  const sb = makeSb({});
  sb.gmGateCheck();
  await sb.gmGateSend(); await tick();
  ok('genau ein Aufruf', sb.fetchCalls.length === 1, String(sb.fetchCalls.length));
  const c = sb.fetchCalls[0];
  ok('an den konfigurierten Worker, Pfad /workout/push', c.url === 'https://worker.test/workout/push', c.url);
  ok('mit dem eigenen Sitzungs-Token — nichts wird von Hand kopiert',
    c.init.headers.Authorization === 'Bearer jwt-abc');
  const body = JSON.parse(c.init.body);
  ok('deviceTest ist gesetzt', body.deviceTest === true);
  ok('clientRef, Hash und beide Fassungen fahren mit',
    body.clientRef === 'swe:po:2026-08-12:ps:devicetest:v1' &&
    body.payloadHash === 'strength-plan@1:2cf88fd5' &&
    body.payloadVersion === 'garmin-workout-export@1' &&
    body.mappingVersion === 'garmin-exercise-map@1', JSON.stringify(Object.keys(body)));
  ok('stepBindings fahren mit (der Anker fuer G2)', body.stepBindings.length === 6);
  ok('KEIN user_id im Rumpf — der Nutzer kommt aus dem Token',
    !('user_id' in body) && !('userId' in body));
  sb.rows = []; sb.gmGateTestSection();
  ok('die workoutId wird zum Notieren angezeigt',
    sb.rows.some(r => /workoutId/.test(r.title) && r.note === '987654'),
    JSON.stringify(sb.rows.map(r => r.title)));
  ok('Erfolg wird als Erfolg gemeldet', sb.rows.some(r => r.note === 'Übertragen.'));
}

/* ══ T5 · Fehler im Klartext ══ */
sec('T5 · Fehlerfälle werden benannt');
for (const [st, needle] of [[422, 'STRENGTH_PUSH_DEVICE_TEST'], [409, 'clientRef'], [401, 'Anmeldung']]) {
  const sb = makeSb({ status: st, body: { ok: false, code: 'x' } });
  sb.gmGateCheck(); await sb.gmGateSend(); await tick();
  sb.rows = []; sb.gmGateTestSection();
  const msg = (sb.rows.find(r => r.title === 'Ergebnis') || {}).note || '';
  ok('HTTP ' + st + ' wird erklärt, nicht nur gezeigt', msg.indexOf(needle) >= 0, msg);
}
{
  const sb = makeSb({ fetchThrows: true });
  sb.gmGateCheck(); await sb.gmGateSend(); await tick();
  sb.rows = []; sb.gmGateTestSection();
  ok('ein Netzfehler wird als solcher benannt',
    /nicht erreichbar/.test((sb.rows.find(r => r.title === 'Ergebnis') || {}).note || ''));
}
{
  const sb = makeSb({ status: 500, body: { ok: false } });
  sb.gmGateCheck(); await sb.gmGateSend(); await tick();
  sb.rows = []; sb.gmGateTestSection();
  ok('ein unbekannter Status wird ehrlich mit seiner Zahl gemeldet',
    /500/.test((sb.rows.find(r => r.title === 'Ergebnis') || {}).note || ''));
}

/* ══ T6 · Fail-closed ══ */
sec('T6 · Ohne Voraussetzungen passiert nichts');
{
  const sb = makeSb({ noSession: true });
  sb.gmGateCheck(); await sb.gmGateSend(); await tick();
  ok('ohne Sitzung wird NICHT gesendet', sb.fetchCalls.length === 0);
  sb.rows = []; sb.gmGateTestSection();
  ok('… und der Grund steht da', /Sitzung/.test((sb.rows.find(r => r.title === 'Ergebnis') || {}).note || ''));
}
{
  const sb = makeSb({ worker: null });
  sb.gmGateCheck(); await sb.gmGateSend(); await tick();
  ok('ohne konfigurierten Worker wird NICHT gesendet', sb.fetchCalls.length === 0);
  sb.rows = []; sb.gmGateTestSection();
  ok('… und der Grund steht da', /Worker/.test((sb.rows.find(r => r.title === 'Ergebnis') || {}).note || ''));
}
{
  const sb = makeSb({ noModules: true });
  const r = sb.gmGateBuild();
  ok('ohne geladene Module wird nichts gebaut', r === null);
  sb.rows = []; sb.gmGateTestSection();
  ok('… und der Grund steht da', /Module nicht geladen/.test((sb.rows.find(r => r.title === 'Ergebnis') || {}).note || ''));
  ok('… und es wird nichts gesendet', sb.fetchCalls.length === 0);
}
ok('ein zweiter Klick waehrend des Sendens loest nichts aus',
  /_gmGate\.state==='sending'\)return/.test(gateBlk));

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
