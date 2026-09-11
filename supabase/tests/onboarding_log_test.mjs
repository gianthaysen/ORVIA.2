/* ORVIA · onboarding_log — B-04 Teil 3: Schritt-Logging (Beobachter) + Verdrahtung
   node supabase/tests/onboarding_log_test.mjs */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'engine', 'onboarding-log.js'))) || _flat);
const L = require(join(APP, 'js/engine/onboarding-log.js'));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const ev = (o) => Object.assign({ eventType: 'enter', stepId: 'profile', now: '2026-09-11T10:00:00.000Z', eventId: 'e' + Math.random() }, o || {});
const tick = () => new Promise(r => setTimeout(r, 5));

sec('A · Beobachter');
{
  L._resetForTest();
  ok('A1 ohne Senke: kein Wurf, noSink zaehlt, ok false', L.logStep(ev()).reason === 'no_sink' && L.stats().noSink === 1 && L.stats().sink === false);
  ok('A2 unbekannter Typ / fehlende Felder → invalid, nie geschrieben', L.logStep(ev({ eventType: 'abort' })).reason.startsWith('event_type_unbekannt') && L.logStep(ev({ stepId: null })).reason === 'step_id_fehlt' && L.stats().invalid === 2);
  const rows = [];
  L.setSink(rec => { rows.push(rec); return Promise.resolve({ data: [rec] }); });
  const r = L.logStep(ev({ eventType: 'complete', stepId: 'goals', fromStep: 'goals', msOnStep: 12345.7, resumed: true, source: 'registration', appVersion: 'orvia-v8-368' }));
  ok('A3 mit Senke: ok, Datensatz vollstaendig, ms gerundet', r.ok && rows.length === 1 && rows[0].msOnStep === 12346 && rows[0].resumed === true && rows[0].source === 'registration');
  ok('A4 negative/NaN Verweildauer → null (kein erfundener Wert)', (L.logStep(ev({ msOnStep: -5 })), rows[1].msOnStep === null));
}
await tick();
sec('B · Senken-Ergebnis wird erfasst (nicht verworfen)');
{
  ok('B1 written zaehlt', L.stats().written === 2 && L.stats().failed === 0);
  L.setSink(() => Promise.resolve({ error: { message: 'rls' } })); L.logStep(ev()); await tick();
  ok('B2 error-Antwort → failed + lastReason', L.stats().failed === 1 && L.stats().lastReason === 'rls');
  L.setSink(() => null); L.logStep(ev());
  ok('B3 null (keine Sitzung) → skipped, nicht failed', L.stats().skipped === 1 && L.stats().failed === 1);
  L.setSink(() => { throw new Error('boom'); });
  ok('B4 werfende Senke → failed, logStep wirft nicht', L.logStep(ev()).ok === true && L.stats().failed === 2);
}
sec('C · Zeile + Verdrahtung');
{
  const row = L.toRow({ eventId: 'e1', eventType: 'enter', stepId: 'profile', fromStep: null, draftStatus: 'in_progress', source: 'registration', resumed: false, msOnStep: null, now: 'x', appVersion: 'v' }, 'u1');
  ok('C1 toRow: alle Spalten von 0041', ['user_id', 'event_id', 'event_type', 'step_id', 'from_step', 'draft_status', 'source', 'resumed', 'ms_on_step', 'occurred_at', 'app_version'].every(k => k in row) && L.toRow({}, null) === null);
  const mig = readFileSync(join(HERE, '..', 'migrations', '0041_onboarding_step_log.sql'), 'utf8');
  const chk = mig.match(/check \(event_type in \(([^)]*)\)\)/i);
  const db = chk ? chk[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort() : [];
  ok('C2 Ereignistypen Modul = Migration', JSON.stringify(db) === JSON.stringify(L.TYPES.slice().sort()), db.join());
  ok('C3 Migration: RLS, keine update/delete-Policy, anon entzogen', /enable row level security/.test(mig) && !/for update|for delete/.test(mig) && /revoke all on public\.onboarding_step_log from anon/.test(mig));
  const ui = readFileSync(join(APP, 'js/onboarding/onboarding-ui.js'), 'utf8'), idx = readFileSync(join(APP, 'index.html'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('C4 UI: open loggt open, render() erkennt Schrittwechsel zentral, finish loggt finish', /_obLog\('open'/.test(ui) && /S\.obLoggedStep !== _cur/.test(ui) && /_obLog\('finish', 'review'\)/.test(ui));
  ok('C5 UI: Senke lazy, ohne Sitzung null', /if \(!sb \|\| !id\) return null;/.test(ui) && /_obLogEnsureSink\(\)/.test(ui));
  ok('C6 Skript + sw.js + Funnel-SQL', idx.includes('js/engine/onboarding-log.js') && sw.includes("'./js/engine/onboarding-log.js'") && existsSync(join(HERE, '_onboarding-funnel.sql')));
}
console.log('\n' + (fail ? '❌' : '✅') + ' onboarding_log: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
