/* ============================================================
   ORVIA · decision_sink_health — der stille Senken-Tod wird sichtbar
   ------------------------------------------------------------
   BEFUND (2026-08-21): der zentrale DB-Strom shadow_observation stand bei 0.
   Ursache-Klasse: die Senke schreibt asynchron; logDecision verwarf das
   Ergebnis (r.then(noop,noop)) und meldete IMMER 'queued'. Ein dauerhaft
   scheiterndes Schreiben (z.B. CHECK-Constraint ohne den Typ — Migration 0033
   nicht live) blieb damit unsichtbar: „queued" fuer immer, 0 Zeilen.

   Diese Pruefung sichert die neue Sichtbarkeit: consecutiveFailures steigt bei
   dauerhaftem Scheitern und faellt bei Erfolg auf 0 — ohne die Planung je zu
   beeinflussen (Beobachter, kein Wurf).

   node supabase/tests/decision_sink_health_test.mjs [appRoot]
   ============================================================ */
import { existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'js', 'engine', 'decision-log.js'))) || _flat);
const DL = require(join(APP, 'js/engine/decision-log.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const tick = () => new Promise(r => setTimeout(r, 0));
let seq = 0;
const rec = (extra) => Object.assign({ decisionType: 'shadow_observation', decisionId: 'dec:h:' + (++seq),
  timestamp: '2026-08-09T07:00:00Z', planId: 'p', registry: {} }, extra || {});

console.log('\nA · dauerhaftes Scheitern wird sichtbar (die 0033-Situation)');
{
  DL.setSink(() => Promise.resolve(false));           // Insert loest mit false auf (Constraint-Tod)
  const r1 = DL.logDecision(rec());
  ok('A1 logDecision wirft nicht, meldet queued (fail-open)', r1 && r1.stored === true && r1.reason === 'queued');
  await tick();
  let h = DL.sinkHealth();
  ok('A2 attempted=1, failed=1, consecutiveFailures=1', h.attempted === 1 && h.failed === 1 && h.consecutiveFailures === 1, JSON.stringify(h));
  ok('A3 lastReason kennzeichnet den Grund', h.lastReason === 'sink_false', h.lastReason);
  DL.logDecision(rec()); await tick();
  DL.logDecision(rec()); await tick();
  h = DL.sinkHealth();
  ok('A4 der Alarm STEIGT (consecutiveFailures=3, succeeded=0)', h.consecutiveFailures === 3 && h.succeeded === 0, JSON.stringify(h));
}

console.log('\nB · Erfolg setzt den Alarm zurueck');
{
  DL.setSink(() => Promise.resolve(true));
  DL.logDecision(rec()); await tick();
  const h = DL.sinkHealth();
  ok('B1 succeeded steigt, consecutiveFailures faellt auf 0', h.succeeded === 1 && h.consecutiveFailures === 0, JSON.stringify(h));
}

console.log('\nC · Rejection und synchroner Wurf werden als Fehler gezaehlt');
{
  const before = DL.sinkHealth().failed;
  DL.setSink(() => Promise.reject(new Error('netz'))); DL.logDecision(rec()); await tick();
  ok('C1 Rejection → failed++ , lastReason rejected', DL.sinkHealth().failed === before + 1 && DL.sinkHealth().lastReason === 'rejected', JSON.stringify(DL.sinkHealth()));
  DL.setSink(() => { throw new Error('boom'); }); const r = DL.logDecision(rec()); await tick();
  ok('C2 synchroner Wurf → stored:false sink_failed, health lastReason threw', r.stored === false && r.reason === 'sink_failed' && DL.sinkHealth().lastReason === 'threw', JSON.stringify(DL.sinkHealth()));
}

console.log('\nD · keine Senke gesetzt — eigener Zaehler, kein Fehlalarm');
{
  const before = DL.sinkHealth();
  DL.setSink(null);
  const r = DL.logDecision(rec());
  const h = DL.sinkHealth();
  ok('D1 no_sink zaehlt getrennt (nicht als failed)', h.noSink === before.noSink + 1 && h.failed === before.failed, JSON.stringify(h));
  ok('D2 logDecision meldet no_sink, wirft nicht', r.stored === false && r.reason === 'no_sink');
}

console.log('\nE · synchrone Senke (kein Promise) wird ebenfalls erfasst');
{
  const before = DL.sinkHealth();
  DL.setSink(() => true);
  DL.logDecision(rec());
  const h = DL.sinkHealth();
  ok('E1 synchrones true → succeeded++', h.succeeded === before.succeeded + 1, JSON.stringify(h));
  DL.setSink(() => false);
  DL.logDecision(rec());
  ok('E2 synchrones false → failed++', DL.sinkHealth().failed === before.failed + 1);
}

console.log('\n' + '─'.repeat(60));
console.log('decision_sink_health: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);
