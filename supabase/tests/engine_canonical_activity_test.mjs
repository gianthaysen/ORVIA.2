/* ============================================================
   ORVIA · Kanonische Aktivitätsform an JEDEM Engine-Eingang (Paritätsvertrag)

   ANLASS — dieselbe Fehlerklasse ist dreimal aufgetreten, jedes Mal zufällig
   entdeckt, nie von einem Test:
     • capacity-adapter (P0, 2026-08-06): las `a.sport`, kanonisch ist `sportId`.
       Alle Sportarten fielen zu einem Pseudo-Sport zusammen.
     • load-history (v8-389): las Dauer nur als durationMin/durationSec und das
       Datum nur als date/localDate. Kanonisch sind durationSeconds/startedAt —
       jede echte Einheit fiel aus der Lastreihe, die Shadow-Belegsammlung lief
       fünf Wochen auf einer leeren Reihe.
     • performance-resolver (v8-390): las Distanz/Dauer/Datum nur in der
       Legacy-Form. `workouts` war im Produktivpfad immer leer, die „harten Läufe"
       waren eine Rubrik ohne Inhalt.

   Warum es Tests nie auffiel: alle Fixtures benutzten die TESTFORM. Ein Modul
   konnte die Produktionsform vollständig ignorieren und blieb grün.

   VERTRAG (einseitig): Die kanonische Form aus activityStore.listActivities() MUSS
   an jedem Eingang ankommen. Wo ein Modul die Legacy-Form noch unterstützt, dient sie
   als Kontrolle, dass die Sonde überhaupt misst; wo ein Modul bewusst kanonisch
   arbeitet, wird genau das festgehalten. Die Prüfung
   vergleicht beide Formen gegeneinander — sie prüft nicht Zahlen, sondern
   Sichtbarkeit. Ein stiller Datenverlust wird damit rot, nicht zufällig entdeckt.

   node supabase/tests/engine_canonical_activity_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'engine', 'load-history.js'))) || _flat);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

globalThis.window = globalThis; globalThis.ORVIA = {};
ORVIA.activityNormalize = require(join(APP, 'js/activity-normalize.js'));
ORVIA.trainingDomain = { normSport: v => String(v || '').toLowerCase(), normSportStrict: v => String(v || '').toLowerCase() };
try { require(join(APP, 'js/onboarding/onboarding-sports-logic.js')); } catch (e) {}
require(join(APP, 'js/activity-config.js'));
require(join(APP, 'js/engine/load-profile.js'));
const LH = require(join(APP, 'js/engine/load-history.js'));
const CA = require(join(APP, 'js/engine/capacity-adapter.js'));
const PR = require(join(APP, 'js/engine/performance-resolver.js'));
const AC = ORVIA.activityConfig;

const TODAY = '2026-09-16', DAY = '2026-09-10';

/* Dieselbe Einheit in beiden Formen: 12 km in 60 min, Laufen, am selben Tag.
   KANONISCH = exakt die Felder, die activity-store/activity-normalize erzeugen. */
const KANON = { id: 'srv-1', clientRecordId: 'a:1', userId: 'u1', sportId: 'running', source: 'garmin',
  sourceRecordId: 'g1', workoutSessionId: null, startedAt: DAY + 'T16:00:00.000Z', endedAt: DAY + 'T17:00:00.000Z',
  durationSeconds: 3600, status: 'completed', summary: { distanceKm: 12, avgHr: 150 }, metrics: {}, syncStatus: 'synced' };
/* LEGACY = die Form, die die Fixtures bisher benutzten. */
const LEGACY = { sportId: 'running', sport: 'running', date: DAY, localDate: DAY,
  distanceKm: 12, durationMin: 60, status: 'completed' };

sec('A · Lastreihe (load-history)');
{
  const seen = a => { const h = LH.buildHistory({ today: TODAY, activities: [a], days: 28 }); const d = h.byDay[DAY]; return !!(d && d.systemic > 0); };
  ok('A1 Legacy-Form wird gesehen', seen(LEGACY));
  ok('A2 KANONISCHE Form wird gesehen (Parität)', seen(KANON));
  const u = LH.asUnit(KANON);
  ok('A3 Dauer aus durationSeconds', u.durationMin === 60, 'durationMin=' + u.durationMin);
  ok('A4 Tag aus startedAt', u.dayKey === DAY, 'dayKey="' + u.dayKey + '"');
}

sec('B · Kapazität je Sportart (capacity-adapter)');
{
  const sports = a => { const r = CA.buildPerSport([a], { today: TODAY }); return (r && r.ok && r.perSport) ? Object.keys(r.perSport) : []; };
  ok('B1 KANONISCHE Form ordnet Laufen zu', sports(KANON).indexOf('running') >= 0, JSON.stringify(sports(KANON)));
  /* Der capacity-adapter ist seit dem P0-Fix bewusst kanonisch: eine Einheit ohne
     Zeitstempel und ohne durationSeconds lässt sich keinem Tag zuordnen und wird
     deshalb NICHT gezählt. Das ist die gewollte Antwort — festgehalten, damit sie
     niemand versehentlich durch einen Legacy-Pfad ersetzt, der die alte
     Sport-Mehrdeutigkeit zurückholt. */
  ok('B2 Einheit ohne Zeitstempel wird nicht stillschweigend mitgezählt', sports(LEGACY).length === 0, JSON.stringify(sports(LEGACY)));
}

sec('C · Leistungsbelege (performance-resolver)');
{
  const wk = a => (PR.runningInput({}, { today: TODAY, activities: [a] }).workouts || []);
  ok('C1 Legacy-Form liefert einen Beleg', wk(LEGACY).length === 1);
  ok('C2 KANONISCHE Form liefert einen Beleg (Parität)', wk(KANON).length === 1, JSON.stringify(wk(KANON)));
  const w = wk(KANON)[0] || {};
  ok('C3 Distanz aus summary.distanceKm', w.distanceKm === 12, 'km=' + w.distanceKm);
  ok('C4 Dauer aus durationSeconds', w.durationMin === 60, 'min=' + w.durationMin);
  ok('C5 Datum aus startedAt', w.date === DAY, 'date=' + w.date);
}

sec('D · Tageslast (activity-config)');
{
  const units = a => { const r = AC.dailyLoadUnits ? AC.dailyLoadUnits([a], { today: TODAY, timezone: 'UTC' }) : null; return (r && Array.isArray(r.units)) ? r.units : []; };
  ok('D1 Legacy-Form liefert eine Einheit', units(LEGACY).length >= 1);
  ok('D2 KANONISCHE Form liefert eine Einheit (Parität)', units(KANON).length >= 1, JSON.stringify(units(KANON)).slice(0, 120));
}

sec('E · Wächter gegen Rückfall');
{
  /* Die drei behobenen Stellen lesen die kanonischen Namen wirklich — nicht nur
     zufällig über einen Alias, der morgen wegfällt. */
  const { readFileSync } = require('node:fs');
  const lh = readFileSync(join(APP, 'js/engine/load-history.js'), 'utf8');
  const prs = readFileSync(join(APP, 'js/engine/performance-resolver.js'), 'utf8');
  const ca = readFileSync(join(APP, 'js/engine/capacity-adapter.js'), 'utf8');
  ok('E1 load-history liest durationSeconds und startedAt', /durationSeconds/.test(lh) && /startedAt/.test(lh));
  ok('E2 performance-resolver liest summary.distanceKm, durationSeconds, startedAt',
    /sum\.distanceKm/.test(prs) && /durationSeconds/.test(prs) && /startedAt/.test(prs));
  ok('E3 capacity-adapter liest sportId vor sport', /a\.sportId != null/.test(ca));
}

console.log('\nengine_canonical_activity: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
