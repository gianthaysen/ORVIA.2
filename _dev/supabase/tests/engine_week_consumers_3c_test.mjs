/* ============================================================
   ORVIA · Engine 3c · Schritt 0 / Inkrement I1 — Vertragstest
   weekRunKm/runsWindow müssen die INJIZIERTE Referenzwoche (todayStr) verwenden,
   nicht das reale new Date(). Damit sind Produktivlogik und Test deterministisch
   an dieselbe Woche gebunden (behebt goal_ssot_p6 L6 an der Wurzel, ohne die
   Assertion abzuschwächen).

   ROT vor dem Fix: weekRunKm verankert die Woche auf new Date() und ignoriert
   die injizierte todayStr — zwei verschiedene injizierte Referenzwochen liefern
   für DIESELBEN Daten dasselbe Ergebnis (real-datumsgebunden). GRÜN nach dem Fix:
   verschiedene Referenzwochen liefern verschiedene Ergebnisse.
   node supabase/tests/engine_week_consumers_3c_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const base = new URL('../../../app/js/', import.meta.url);
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };

function slice(src, a, b) { const s = src.indexOf(a), e = src.indexOf(b); if (s < 0 || e < 0) throw new Error('Slice-Marker fehlt'); return src.slice(s, e); }
const block = slice(uiSrc, 'function _validRun(', 'function allLoads(');

// I2: weekRunKm liest nun den kanonischen Wochenvertrag (weeklyActivityTotals). Für die
// weekRunKm-Assertions müssen die realen Aggregator-Module geladen und in die Sandbox
// injiziert werden. Erwartungswerte bleiben unverändert; nur die Sandbox-Treue steigt.
globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
await import(new URL('training-domain.js', base));
await import(new URL('activity-normalize.js', base));
await import(new URL('activity-config.js', base));
const __CFG3c = globalThis.ORVIA.activityConfig;
const __TD3c = globalThis.ORVIA.trainingDomain;


// Sandbox mit INJIZIERTER Referenz (TODAY) — wie goal_ssot_p6, aber ohne festes reales Datum.
function mk(TODAY, storeRuns) {
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array; sb.isNaN = isNaN;
  sb.Calc = { isValidRunForAnalytics: r => !!r && r.dist > 0 };
  sb.DB = {};
  sb.todayStr = d => { const x = d || new Date(TODAY + 'T12:00:00'); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  sb.dkey = off => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() + off); return sb.todayStr(d); };
  sb.ORVIA = { activityConfig: __CFG3c, trainingDomain: __TD3c, profileStore: { effectiveTimezone: () => 'Europe/Vienna' }, activityStore: { listActivities: () => storeRuns || [], isTombstoned: () => false } };
  vm.createContext(sb);
  vm.runInContext(block, sb, { filename: 'ui.js#runs' });
  return sb;
}
const act = (day) => ({ sportId: 'running', status: 'completed', startedAt: day + 'T10:00:00Z', durationSeconds: 2400, summary: { distanceKm: 8, distance_m: 8000, avg_hr: 150 } });

// Ein Store-Lauf am festen Kalendertag 2026-07-16.
const runs = [act('2026-07-16')];
// Referenzwoche A enthält den 16.07. (TODAY im selben Mo–So-Fenster); Referenzwoche B liegt eine Woche später.
const wkA = mk('2026-07-18', runs).weekRunKm(0);   // Woche 13.–19.07. → 8 km erwartet
const wkB = mk('2026-07-25', runs).weekRunKm(0);   // Woche 20.–26.07. → 0 km erwartet

ok('[I1-1] weekRunKm(0) bindet an die injizierte Referenzwoche (Woche mit 16.07. ⇒ 8 km)', wkA === 8, 'ist=' + wkA);
ok('[I1-2] weekRunKm(0) für spätere Referenzwoche (ohne 16.07.) ⇒ 0 km', wkB === 0, 'ist=' + wkB);
ok('[I1-3] verschiedene injizierte Referenzwochen ⇒ verschiedene Ergebnisse (kein reales new Date())', wkA !== wkB, 'A=' + wkA + ' B=' + wkB);
// runsWindow ist bereits deterministisch (dkey) — Gegenkontrolle, dass die Umstellung es nicht bricht.
const rw = mk('2026-07-18', runs).runsWindow(7).map(r => r.date);
ok('[I1-4] runsWindow(7) über injizierte Woche enthält 2026-07-16', rw.indexOf('2026-07-16') >= 0, JSON.stringify(rw));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I1: ' + (fail === 0 ? 'GRÜN — weekRunKm/runsWindow deterministisch an injizierte Referenzwoche gebunden.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));
