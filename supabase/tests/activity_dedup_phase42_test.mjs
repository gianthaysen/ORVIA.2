/* ORVIA · Phase 4.2 F3 — Duplikaterkennung beim Erfassen/Import.
   node supabase/tests/activity_dedup_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
(0, eval)(fs.readFileSync(new URL('../../js/calc.js', import.meta.url), 'utf8'));
const D = globalThis.Calc.activityDuplicate;

ok('andere Sportart → kein Treffer', D({ type: 'Laufen', date: '2026-06-21' }, { type: 'Gym' }) === null || D({ type: 'Laufen' }, { type: 'Gym' }) === null);
ok('anderes Datum → kein Treffer', D({ type: 'Gym', date: '2026-06-21' }, { source: 'live' }) && D({ type: 'Gym', date: '2026-06-20' }, { type: 'Gym', date: '2026-06-21' }) === null);
ok('gleiche externe ID → hoch', (D({ externalId: 'strava:9', dur: 40 }, { externalId: 'strava:9', dur: 99 }) || {}).confidence === 'hoch');
ok('bestehende Live-Einheit + ähnliche Dauer → hoch', (D({ type: 'Gym', dur: 42 }, { source: 'live', dur: 41 }) || {}).confidence === 'hoch');
ok('bestehende Live-Einheit ohne Metrik → mittel', (D({ type: 'Gym' }, { source: 'live' }) || {}).confidence === 'mittel');
ok('ähnliche Distanz ohne Live → mittel', (D({ type: 'Laufen', dist: 10.0 }, { dist: 10.2 }) || {}).reason === 'metrics');
ok('nur selber Slot → niedrig', (D({ type: 'Rad' }, { dur: 999, dist: 999 }) || {}).confidence === 'niedrig');
ok('robust gegen null', D(null, {}) === null && D({}, null) === null);

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
