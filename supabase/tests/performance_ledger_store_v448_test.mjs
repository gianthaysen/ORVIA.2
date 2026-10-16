/* ============================================================
   ORVIA · performance_ledger_store (v8-448A) — Schalter, Zwischenspeicher, Speichern

   S1  Flag aus (Standard): nichts wird gerechnet, gelesen, geschrieben oder gesendet
   S2  Flag-Name bekannt, aber ohne ausdrueckliche Zeile → isEnabled() = false (fail-closed)
   S3  Flag an: Rechnen, Zwischenspeicher, eine Speicherfolge (Eintraege in Teilen, zuletzt Ereignisse)
   S4  zweiter Lauf ohne Aenderung: kein Senden
   S5  Speichern scheitert: Arbeit bleibt offen und wird beim naechsten Lauf vollstaendig nachgeholt
   S6  vom Server gemeldete „neu zu berechnen"-Kennzahlen werden mitgeschickt
   S7  Zwischenspeicher je Nutzer; Neustart (Speicher leer im RAM) liest ihn wieder
   S8  lokale Aktivitaeten ohne Server-Kennung werden nicht gesendet
   ============================================================ */
import { createRequire } from 'node:module';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const J = v => JSON.stringify(v);
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
for (const f of ['js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js', 'js/activity-time.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
require(new URL(_APPREL + 'js/engine/performance-ledger.js', import.meta.url).pathname);
require(new URL(_APPREL + 'js/engine/feature-flags.js', import.meta.url).pathname);
const S = require(new URL(_APPREL + 'js/performance-ledger-store.js', import.meta.url).pathname);
require(new URL(_APPREL + 'js/repos/performanceLedgerRepository.js', import.meta.url).pathname);
const O = globalThis.ORVIA, L = O.performanceLedger;

const uuid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
const run = (i, date, s5k) => { const a = GEN.referenceActivity('running', 'best'); a.id = uuid(i); a.startedAt = date + 'T06:00:00.000Z';
  a.metrics.garmin.start_local = date + 'T08:00:00'; a.metrics.best_efforts.distance.targets['5000'] = { s: s5k, over_m: 2, at: 0, q: 'measured' }; return a; };
function memStore() { const m = {}; let reads = 0, writes = 0; return { getItem: k => (reads++, k in m ? m[k] : null), setItem: (k, v) => { writes++; m[k] = v; }, m, stats: () => ({ reads, writes }) }; }
function fakeRepo(o = {}) {
  const calls = []; let failNext = o.failNext || 0;
  return { calls, apply: async p => { calls.push(p); if (failNext > 0) { failNext--; return { success: false, error: { code: 'rpc_failed' } }; } return { success: true, data: {} }; },
           dirtyKeys: async () => ({ success: true, data: o.dirty || [] }) };
}
const on = { isEnabled: f => f === 'performance_ledger' };
const runs = [run(1, '2026-08-02', 1510), run(2, '2026-08-16', 1482), run(3, '2026-09-27', 1419)];

{
  S._reset();
  const st = memStore(), repo = fakeRepo();
  let evals = 0; const orig = O.metricEligibility.evaluate; O.metricEligibility.evaluate = function () { evals++; return orig.apply(this, arguments); };
  const r = await S.refresh(runs, {}, { flags: O.featureFlags, storage: st, repo, uid: () => 'u1' });
  O.metricEligibility.evaluate = orig;
  ok('S1 Flag aus: nichts gerechnet, gelesen, geschrieben, gesendet', r.ok === false && r.code === 'disabled' && evals === 0 && st.stats().reads === 0 && st.stats().writes === 0 && repo.calls.length === 0);
  ok('S2 Flag bekannt (= CHECK der Migration 0051), ohne gelesene Zeile aber AUS', O.featureFlags.isEnabled('performance_ledger') === false && O.featureFlags.KNOWN.includes('performance_ledger') && S.model() === null);
}
{
  S._reset();
  const st = memStore(), repo = fakeRepo();
  const d = { flags: on, storage: st, repo, uid: () => 'u1' };
  const r = await S.refresh(runs, { timeZone: 'Europe/Berlin' }, d);
  ok('S3a Flag an: gerechnet, Lesemodell mit Bestwert', r.ok && r.model.sports[0].records.find(x => x.metricKey === 'running.fastest_5000m@standard').best.value === 1419);
  ok('S3b Zwischenspeicher geschrieben (je Nutzer)', Object.keys(st.m).some(k => k.includes('orvia_perf_ledger_' + O.performanceLedger.CALC_VERSION + '_u1')));
  const last = repo.calls[repo.calls.length - 1];
  ok('S3c Speichern: zuerst Eintraege, zuletzt Ereignisse + Meilensteine + Protokoll', repo.calls.length === 2 && repo.calls[0].entries.length === 3 * L.defsFor('running').length && repo.calls[0].events.length === 0
     && last.entries.length === 0 && last.events.length > 0 && Array.isArray(last.milestones) && last.log.length > 0 && r.persisted.success);
  const r2 = await S.refresh(runs, { timeZone: 'Europe/Berlin' }, d);
  ok('S4 zweiter Lauf ohne Aenderung: nichts gesendet', repo.calls.length === 2 && r2.changes.affectedKeys.length === 0);
  S._reset();
  const r3 = await S.refresh(runs, { timeZone: 'Europe/Berlin' }, d);
  ok('S7 Neustart: Zwischenspeicher gelesen, nichts neu geprueft, nichts gesendet', r3.ok && r3.changes.added.length === 0 && repo.calls.length === 2);
  const other = await S.refresh([run(9, '2026-09-01', 1300)], { timeZone: 'Europe/Berlin' }, Object.assign({}, d, { uid: () => 'u2' }));
  ok('S7b anderer Nutzer: eigener Zwischenspeicher', Object.keys(st.m).some(k => /_u2$/.test(k)) && other.model.sports[0].records.find(x => x.metricKey === 'running.fastest_5000m@standard').best.value === 1300);
  ok('S7c Kontowechsel: Zustand des ersten Nutzers wird nie weitergefuehrt (nichts „entfernt", nichts fremdes gesendet)', other.changes.removed.length === 0 && other.changes.added.join() === uuid(9)
     && repo.calls.slice(2).every(c => c.activityIds.every(id => id === uuid(9))), J({ added: other.changes.added, removed: other.changes.removed }));
}
{
  S._reset();
  const st = memStore(), repo = fakeRepo({ failNext: 1 });
  const d = { flags: on, storage: st, repo, uid: () => 'u3' };
  const r1 = await S.refresh(runs, {}, d);
  ok('S5a Speichern scheitert: Arbeit bleibt offen', r1.ok && r1.pending === true);
  const r2 = await S.refresh(runs, {}, d);
  const sent = repo.calls.slice(1);
  ok('S5b naechster Lauf holt alles nach (alle Aktivitaeten + alle Kennzahlen)', r2.pending === false && sent[0].activityIds.length === 3 && sent[sent.length - 1].metricKeys.length === r1.changes.affectedKeys.length);
}
{
  S._reset();
  const repo = fakeRepo({ dirty: ['running.fastest_5000m@standard'] });
  const d = { flags: on, storage: memStore(), repo, uid: () => 'u4' };
  await S.refresh(runs, {}, d);
  const r = await S.refresh(runs, {}, d);
  ok('S6 Server-Vermerk „neu zu berechnen" wird mitgeschickt, obwohl lokal nichts geaendert', r.dirty.length === 1 && repo.calls[repo.calls.length - 1].metricKeys.includes('running.fastest_5000m@standard'));
}
{
  ok('S8 lokale Kennungen sind nicht speicherbar', O.performanceLedgerRepository.persistable('local-123') === false && O.performanceLedgerRepository.persistable(uuid(1)) === true);
}

console.log('\n' + (fail ? '❌' : '✅') + ' performance_ledger_store_v448: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
