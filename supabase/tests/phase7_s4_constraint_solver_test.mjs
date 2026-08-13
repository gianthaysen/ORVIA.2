/* ORVIA · Phase 7 S4 (2026-08-05) — Constraint Solver: liest restDay + fixedCommitments
   (die der Live-Pfad ignoriert) und platziert fail-closed nach Vertrag 3.
   Kernbeweise: HART/WEICH-Trennung, Widerspruch ⇒ Konflikt statt stiller Aufloesung,
   Fixtermine belasten das Intensitaetsbudget, minimumFullRestDays haelt, Determinismus.
   node supabase/tests/phase7_s4_constraint_solver_test.mjs [appRoot-absolut] */
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
const CS = require(join(APP, 'js/engine/constraint-solver.js'));
const R = f => readFileSync(join(APP, f), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function day(over) {
  return Object.assign({ available: true, restDay: false, singleSession: { maxMinutes: 90, intensityAllowed: 'intense' },
    doubleSession: { enabled: false }, fixedCommitments: [] }, over || {});
}
function avail(daysOver, topOver) {
  const days = {};
  CS.WEEKDAYS.forEach(wd => { days[wd] = day((daysOver || {})[wd]); });
  return Object.assign({ days, maxSessionsPerWeek: null, maxIntenseSessions: null, preferredRestDays: [], minimumFullRestDays: null }, topOver || {});
}

/* ============ Zulässigkeit: HART + fail-closed ============ */
{
  const a = avail({ di: { restDay: true, available: false }, mi: { available: false }, do: { available: null } });
  const r = CS.admissibleSlots(a);
  ok('restDay ⇒ unzulässig mit Grund rest_day (HART, nie mit preferred vermischt)',
     r.slots.di.admissible === false && r.slots.di.reasons.indexOf('rest_day') >= 0);
  ok('available:false ⇒ not_available · available:null ⇒ availability_unknown (nie raten)',
     r.slots.mi.reasons.indexOf('not_available') >= 0 && r.slots.do.reasons.indexOf('availability_unknown') >= 0);
  ok('normale Tage zulässig inkl. Kapazität/Intensität', r.slots.mo.admissible === true && r.slots.mo.maxMinutes === 90);
}
{
  /* Widerspruch: restDay UND available:true ⇒ Konflikt, KEINE stille Auflösung. */
  const a = avail({ fr: { restDay: true, available: true } });
  const r = CS.admissibleSlots(a);
  ok('WIDERSPRUCH restDay+available ⇒ Tag unzulässig + Konflikt sichtbar (Vertrag 3)',
     r.slots.fr.admissible === false && r.conflicts.length === 1
     && r.conflicts[0].code === 'contradictory_rest_and_available' && r.conflicts[0].weekday === 'fr');
  ok('availability fehlt komplett ⇒ fail-closed error', CS.admissibleSlots(null).ok === false);
}

/* ============ Platzierung ============ */
const REQS = [
  { id: 'long', sportId: 'running', durationMin: 120, intensity: 'moderate', priority: 'key' },
  { id: 'int', sportId: 'running', durationMin: 60, intensity: 'intense', priority: 'key' },
  { id: 'gym', sportId: 'strength', durationMin: 60, intensity: 'moderate', priority: 'build' },
  { id: 'ez', sportId: 'running', durationMin: 40, intensity: 'easy', priority: 'optional' }
];
{
  /* Kapazität: 120-min-Long passt nur auf Tage mit maxMinutes>=120 (nur sat/sun). */
  const a = avail({ sa: { singleSession: { maxMinutes: 180, intensityAllowed: 'intense' } },
                    so: { singleSession: { maxMinutes: 180, intensityAllowed: 'moderate' } } });
  const r = CS.place(REQS, a);
  const long = r.placements.find(p => p.id === 'long');
  ok('Platzierung · 120-min-Einheit landet NUR auf einem Tag mit ausreichender Kapazität',
     !!long && (long.weekday === 'sa' || long.weekday === 'so'), JSON.stringify(r.placements.map(p => p.id + ':' + p.weekday)));
  ok('Platzierung · alle 4 Anforderungen platziert, keine unplaced', r.placements.length === 4 && r.unplaced.length === 0);
  /* Determinismus: identischer Input ⇒ byte-identisches Ergebnis. */
  ok('DETERMINISMUS · zweiter Lauf byte-identisch', JSON.stringify(r) === JSON.stringify(CS.place(REQS, a)));
}
{
  /* WEICH: preferredRestDays werden gemieden, aber bei Engpass MIT Flag genutzt. */
  const days = {}; CS.WEEKDAYS.forEach(wd => { days[wd] = { available: false }; });
  days.mo = {}; days.di = {};                                        // nur mo+di verfügbar
  const a = avail(days, { preferredRestDays: ['di'] });
  const r = CS.place([REQS[0], REQS[2]].map(q => Object.assign({}, q, { durationMin: 60 })), a);
  const onTue = r.placements.find(p => p.weekday === 'di');
  ok('WEICH · preferredRestDay wird erst bei Engpass genutzt — dann mit explizitem Flag',
     r.placements.length === 2 && !!onTue && onTue.flags.indexOf('soft_preferred_rest_day_used') >= 0,
     JSON.stringify(r.placements));
}
{
  /* HART #13: minimumFullRestDays — Fixtermin-Tage zählen NICHT als frei. */
  const a = avail({ sa: { fixedCommitments: [{ id: 'f1', type: 'match', durationMinutes: 90, intensity: 'intense' }] } },
                  { minimumFullRestDays: 5 });
  const r = CS.place(REQS, a);
  /* Erwartung präzise: 'long' (120 min) passt in KEINEN 90-min-Tag (no_admissible_slot),
     die übrigen zwei scheitern an der Ruhetagsgrenze — beide Gründe ehrlich getrennt. */
  ok('HART · minimumFullRestDays=5 bei 1 Fixtermin-Tag ⇒ 1 Platzierung; Gründe getrennt (Kapazität vs. Ruhetage)',
     r.placements.length === 1 && r.unplaced.length === 3
     && r.unplaced.filter(u => u.reason === 'minimum_full_rest_days_violated').length === 2
     && r.unplaced.some(u => u.id === 'long' && u.reason === 'no_admissible_slot'),
     JSON.stringify(r.unplaced));
}
{
  /* Fixtermine belasten das Intensitätsbudget: Match (intense) + maxIntenseSessions=1
     ⇒ die intense Laufeinheit wird abgelehnt, NICHT verschoben. */
  const a = avail({ sa: { fixedCommitments: [{ id: 'f1', type: 'match', durationMinutes: 90, intensity: 'intense' }] } },
                  { maxIntenseSessions: 1 });
  const r = CS.place(REQS, a);
  ok('Fixtermin (Match, intense) verbraucht das Intensitätsbudget — intense Einheit fail-closed abgelehnt',
     r.unplaced.some(u => u.id === 'int' && u.reason === 'max_intense_sessions_reached_incl_fixed')
     && r.placements.every(p => p.id !== 'int'));
  ok('Fixtermin-Tag trägt Flag day_has_fixed_commitments, wenn belegt',
     r.placements.filter(p => p.weekday === 'sa').every(p => p.flags.indexOf('day_has_fixed_commitments') >= 0));
}
{
  /* maxSessionsPerWeek hart; doubleSession erlaubt 2. Einheit am selben Tag. */
  const days = {}; CS.WEEKDAYS.forEach(wd => { days[wd] = { available: false }; });
  days.mo = { doubleSession: { enabled: true }, singleSession: { maxMinutes: 180, intensityAllowed: 'intense' } };
  const a = avail(days, { maxSessionsPerWeek: 2 });
  const r = CS.place(REQS, a);
  ok('doubleSession ⇒ 2 Einheiten am selben Tag; maxSessionsPerWeek kappt hart mit Grund',
     r.placements.length === 2 && r.placements.every(p => p.weekday === 'mo')
     && r.unplaced.some(u => u.reason === 'max_sessions_per_week_reached'));
}
{
  /* Unbekannte Tageskapazität ⇒ platzieren + ehrliches Flag (unbekannt ≠ Nullwert). */
  const a = avail({ mo: { singleSession: {} }, di: { singleSession: {} }, mi: { singleSession: {} },
                    do: { singleSession: {} }, fr: { singleSession: {} }, sa: { singleSession: {} }, so: { singleSession: {} } });
  const r = CS.place([REQS[0]], a);
  ok('unbekannte maxMinutes ⇒ Platzierung MIT Flag day_capacity_unknown (Hard #18)',
     r.placements.length === 1 && r.placements[0].flags.indexOf('day_capacity_unknown') >= 0);
}

/* ============ Reinheit + Einbindung ============ */
/* Purity NUR im Code prüfen — die Header-Kommentare benennen die verbotenen APIs. */
const src = R('js/engine/constraint-solver.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('Solver pure (Code ohne Kommentare): kein Date.now/Math.random/DOM/Storage/PROFILE',
   !/Date\.now|Math\.random|document\.|localStorage|\bPROFILE\b/.test(src));
const idx = R('index.html'), sw = R('sw.js');
ok('index.html lädt constraint-solver', idx.indexOf('js/engine/constraint-solver.js') >= 0);
ok('sw.js precacht constraint-solver', sw.indexOf("'./js/engine/constraint-solver.js'") >= 0);
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 237, genau einmal', swv != null && Number(swv) >= 237 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

console.log('\nphase7_s4_constraint_solver: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
