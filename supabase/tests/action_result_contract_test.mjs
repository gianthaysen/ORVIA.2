/* ORVIA · Phase 0 — Aktions-Ergebnisvertrag.

   Sichert die Instrumentierung aus Phase 0 ab. Zwei Anforderungen zugleich:

   1) runActionEx() liefert ein strukturiertes Ergebnis mit Ursache, damit tote
      Pfade automatisiert erfassbar werden. Ein boolescher Rueckgabewert verliert
      genau diese Ursache — das hat KF-001..KF-003 unsichtbar gemacht.
   2) runAction() bleibt bitgenau boolesch. Bestandsvertrag, assertiert in
      supabase/tests/quick_actions_b_test.mjs:100 (`ran === true`).

   Ausdruecklich NICHT Gegenstand dieser Stufe: ein aufloesbarer Handler, der
   nichts tut, gilt weiterhin als 'handled'. Phase 0 aendert keine Handler.
   Der Test haelt diese Grenze fest, damit sie nicht stillschweigend als
   erwuenschtes Verhalten missverstanden wird (siehe baseline/known-failures.json).

   node supabase/tests/action_result_contract_test.mjs */
import { createRequire } from 'module';
import { existsSync as _exApp } from 'node:fs';
const _appjs = p => (_exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/') + p;
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* Minimalumgebung; setTimeout synchron, damit die Doppelklicksperre nicht blockiert. */
globalThis.window = globalThis;
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); } };
globalThis.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
const _realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => { try { fn(); } catch (e) {} return 0; };

const closed = [];
globalThis._closeM = (id) => closed.push(id);

require(_appjs('js/quick-actions.js'));
const qa = globalThis.ORVIA.quickActions;

/* ---------- Export-Vertrag ---------- */
ok('runActionEx, onActionResult, getActionLog, probeActions sind exportiert',
   ['runActionEx', 'onActionResult', 'getActionLog', 'probeActions', 'ACTION_RESULT_REASONS']
     .every(k => qa[k] !== undefined));
ok('Ursachenliste ist vollstaendig und stabil',
   JSON.stringify(qa.ACTION_RESULT_REASONS) === JSON.stringify(
     ['handled', 'target_unavailable', 'handler_missing', 'handler_failed', 'blocked', 'invalid_action']));

/* ---------- Ergebnisform ---------- */
const shape = r => r && typeof r.handled === 'boolean' && typeof r.action === 'string'
              && 'reason' in r && 'error' in r && 'target' in r && typeof r.at === 'number';

const unknown = qa.runActionEx('gibt_es_nicht');
ok('unbekannte Aktion -> invalid_action', unknown.reason === 'invalid_action' && unknown.handled === false);
ok('Ergebnis hat die vertraglich zugesagte Form', shape(unknown));

/* ---------- target_unavailable: Entry-Point nicht aufloesbar ----------
   Bewusst eine Aktion mit GLOBALEM Entry-Point (kein "orvia:"-Pfad), damit der
   Handler im Test durch eine schlichte Zuweisung ersetzbar ist. */
const someAction = qa.ACTIONS.filter(a => a.entryPoint && a.entryPoint.indexOf('orvia:') !== 0)[0];
ok('Testvoraussetzung: es gibt eine Aktion mit globalem Entry-Point', !!someAction,
   someAction ? someAction.id + ' -> ' + someAction.entryPoint : 'keine gefunden');
delete globalThis[someAction.entryPoint];
const unresolved = qa.runActionEx(someAction.id);
ok('nicht aufloesbarer Entry-Point -> target_unavailable (nicht stillschweigend true)',
   unresolved.handled === false && unresolved.reason === 'target_unavailable',
   someAction.id + ' -> ' + unresolved.reason);
ok('Ergebnis nennt das konkrete Ziel', unresolved.target === someAction.entryPoint);

/* ---------- handled: echter Handler ---------- */
let ran = 0;
globalThis[someAction.entryPoint] = function () { ran++; };
const good = qa.runActionEx(someAction.id);
ok('aufloesbarer Handler -> handled', good.handled === true && good.reason === 'handled' && ran === 1);

/* ---------- handler_failed: Ausnahme ---------- */
globalThis[someAction.entryPoint] = function () { throw new Error('boom'); };
const threw = qa.runActionEx(someAction.id);
ok('werfender Handler -> handler_failed mit Fehlerobjekt',
   threw.handled === false && threw.reason === 'handler_failed' && threw.error instanceof Error);

/* ---------- handler_failed: explizites false ---------- */
globalThis[someAction.entryPoint] = function () { return false; };
const said = qa.runActionEx(someAction.id);
ok('Handler mit explizitem false -> handler_failed',
   said.handled === false && said.reason === 'handler_failed');

/* ---------- Grenze der Stufe: undefined bleibt handled ---------- */
globalThis[someAction.entryPoint] = function () { /* tut nichts, liefert undefined */ };
const silent = qa.runActionEx(someAction.id);
ok('BEWUSSTE GRENZE: wirkungsloser Handler mit undefined gilt weiterhin als handled',
   silent.handled === true && silent.reason === 'handled',
   'Phase 0 aendert keine Handler — KF-001..003 bleiben in known-failures.json gefuehrt');

/* ---------- Bestandsvertrag: runAction bleibt boolesch ---------- */
globalThis[someAction.entryPoint] = function () { };
const b1 = qa.runAction(someAction.id);
ok('runAction liefert echtes true (kein truthy Objekt)', b1 === true);
const b2 = qa.runAction('gibt_es_nicht');
ok('runAction liefert echtes false (kein truthy Objekt)', b2 === false);

/* ---------- Sheet-Schliessverhalten unveraendert ---------- */
closed.length = 0;
delete globalThis[someAction.entryPoint];
qa.runActionEx(someAction.id);
ok('Sheet schliesst auch bei nicht aufloesbarem Ziel (Verhalten wie vor Phase 0)',
   closed.indexOf('_quickActions') >= 0);

/* ---------- Beobachter ---------- */
const seen = [];
const off = qa.onActionResult(r => seen.push(r.reason));
qa.runActionEx('gibt_es_nicht');
ok('Beobachter erhaelt Ergebnisse', seen.indexOf('invalid_action') >= 0);
const offBad = qa.onActionResult(() => { throw new Error('observer kaputt'); });
const stillOk = qa.runActionEx('gibt_es_nicht');
ok('werfender Beobachter kippt die Aktion nicht', stillOk.reason === 'invalid_action');
off(); offBad();
const beforeCount = seen.length;
qa.runActionEx('gibt_es_nicht');
ok('Abmeldung wirkt', seen.length === beforeCount);

/* ---------- Protokoll ---------- */
const log = qa.getActionLog();
ok('Protokoll sammelt Ergebnisse', Array.isArray(log) && log.length > 0 && shape(log[log.length - 1]));
ok('Protokoll ist eine Kopie (kein Verweis auf den internen Puffer)',
   (() => { const a = qa.getActionLog(); a.push({}); return qa.getActionLog().length === a.length - 1; })());
for (let i = 0; i < 80; i++) qa.runActionEx('gibt_es_nicht');
ok('Protokoll ist ein Ringpuffer (max. 50)', qa.getActionLog().length === 50);

/* ---------- Erreichbarkeitsprobe ---------- */
const probe = qa.probeActions();
ok('probeActions deckt alle Aktionen ab', probe.length === qa.ACTIONS.length);
ok('probeActions fuehrt nichts aus (Zaehler unveraendert)', ran === 1);
ok('probeActions meldet je Aktion Aufloesbarkeit und Ursache',
   probe.every(p => typeof p.resolvable === 'boolean' && qa.ACTION_RESULT_REASONS.indexOf(p.reason) >= 0));

globalThis.setTimeout = _realTimeout;
console.log('\naction_result_contract: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
