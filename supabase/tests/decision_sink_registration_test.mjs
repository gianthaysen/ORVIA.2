/* ============================================================
   ORVIA · decision_sink_registration — die Senke MUSS ankommen
   ------------------------------------------------------------
   BEFUND (24.08.2026, live belegt): sinkHealth() meldete noSink: 608 —
   608 Entscheidungs-Eintraege in EINER Sitzung, kein einziger in der Datenbank.
   Ursache: die Registrierung lief EAGER
     if (O.decisionLog && O.decisionLog.setSink) O.decisionLog.setSink(_sink);
   ui.js laedt in index.html an Zeile 464, js/engine/decision-log.js erst an 693.
   Zum Ausfuehrungszeitpunkt existierte O.decisionLog also nicht, der Guard griff
   still — und die Senke war fuer die gesamte Sitzung tot. Kein Fehler, kein Log,
   nichts: der Ausfall war unsichtbar, bis sinkHealth() ihn zaehlbar machte.

   Diese Pruefung sichert das Verhalten am ECHTEN Quelltext aus ui.js (kein
   Nachbau): die Registrierung muss auch dann gelingen, wenn decisionLog ERST
   SPAETER auftaucht.

   node supabase/tests/decision_sink_registration_test.mjs [appRoot]
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const uiRaw = readFileSync(join(APP, 'js/ui.js'), 'utf8');
const idxRaw = readFileSync(join(APP, 'index.html'), 'utf8');

/* ---------- A · Die Ladereihenfolge, die den Ausfall verursacht hat ---------- */
console.log('\nA · Ladereihenfolge (die Ursache)');
{
  const posUi = idxRaw.indexOf('js/ui.js');
  const posDl = idxRaw.indexOf('js/engine/decision-log.js');
  ok('A1 beide Skripte sind eingebunden', posUi > 0 && posDl > 0);
  /* Das ist KEIN Defekt, sondern die Realitaet, mit der die Registrierung
     umgehen muss. Der Test haelt sie fest, damit klar bleibt, warum. */
  ok('A2 ui.js laedt VOR decision-log.js (deshalb ist eager unmoeglich)', posUi < posDl,
    'ui@' + posUi + ' decision-log@' + posDl);
}

/* ---------- B · Der echte Quelltext, verhaltensgeprueft ---------- */
console.log('\nB · Registrierung am echten ui.js-Quelltext');
{
  const i = uiRaw.indexOf('function _ensureDecisionSink()');
  ok('B1 _ensureDecisionSink existiert in ui.js', i > 0);
  /* Funktionskoerper balanciert herausschneiden. */
  let src = null;
  if (i > 0) {
    let d = 0, started = false;
    for (let j = i; j < uiRaw.length; j++) {
      const ch = uiRaw[j];
      if (ch === '{') { d++; started = true; }
      else if (ch === '}') { d--; if (started && d === 0) { src = uiRaw.slice(i, j + 1); break; } }
    }
  }
  ok('B2 Funktionskoerper schneidbar', !!src);

  if (src) {
    /* Der Kern: decisionLog taucht ERST SPAETER auf — genau der Live-Fall. */
    const O = {};
    const make = new Function('O', '_sink', 'var _decisionSinkGesetzt=false;\n' + src + '\nreturn _ensureDecisionSink;');
    const sinkFn = function () { return true; };
    const ensure = make(O, sinkFn);

    ok('B3 ohne decisionLog: Registrierung schlaegt fehl, wirft aber nicht', ensure() === false);

    /* Modul erscheint (so wie decision-log.js nach ui.js ausgefuehrt wird). */
    let registered = null;
    O.decisionLog = { setSink: function (fn) { registered = fn; } };
    ok('B4 sobald decisionLog da ist, greift der Nachhol-Versuch', ensure() === true);
    ok('B5 die ECHTE Senke wurde uebergeben', registered === sinkFn);

    /* Idempotenz: ein zweiter Lauf darf nicht erneut registrieren. */
    registered = null;
    ok('B6 zweiter Aufruf ist idempotent (true, keine Zweitregistrierung)',
      ensure() === true && registered === null);

    /* setSink fehlt (kaputtes/alte Modulversion) → false, kein Wurf. */
    const O2 = {}; const ensure2 = make(O2, sinkFn);
    O2.decisionLog = {};
    ok('B7 Modul ohne setSink → false, kein Wurf', ensure2() === false);

    /* Wirft setSink, faellt es nicht auf den Aufrufer durch. */
    const O3 = {}; const ensure3 = make(O3, sinkFn);
    O3.decisionLog = { setSink: function () { throw new Error('boom'); } };
    let threw = false;
    try { ok('B8 werfendes setSink → false statt Wurf', ensure3() === false); }
    catch (e) { threw = true; ok('B8 werfendes setSink → false statt Wurf', false, 'hat geworfen'); }
  }
}

/* ---------- C · Nachholmechanismus ist verdrahtet ---------- */
console.log('\nC · Der Nachhol-Pfad existiert');
{
  ok('C1 DOMContentLoaded-Nachholung verdrahtet', /DOMContentLoaded['"]\s*,\s*_ensureDecisionSink/.test(uiRaw));
  ok('C2 load-Nachholung verdrahtet', /['"]load['"]\s*,\s*_ensureDecisionSink/.test(uiRaw));
  ok('C3 sofortiger Versuch beim Laden', /if\s*\(\s*!_ensureDecisionSink\(\)\s*\)/.test(uiRaw));
  /* Die alte, stille Fassung darf nicht zurueckkehren. */
  ok('C4 die eager-Einzeiler-Fassung ist WEG',
    !/try\{\s*if\(O\.decisionLog&&O\.decisionLog\.setSink\)O\.decisionLog\.setSink\(_sink\);\s*\}catch/.test(uiRaw));
}

console.log('\n' + '─'.repeat(60));
console.log('decision_sink_registration: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);
