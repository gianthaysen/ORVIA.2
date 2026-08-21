/* ============================================================
   ORVIA · goal_taper_resolver — A-09
   ------------------------------------------------------------
   Aus dem Zieldatum wird die Trainingsphase abgeleitet — als Beobachter, nicht
   steuernd (scharf schalten ist B-01). Geprueft:
     1. Die Phase reagiert korrekt auf das Datum (race_week / taper / build).
     2. Vergangenes oder fehlendes Datum ist eine Aussage (null), kein Fehler.
     3. Die Tagesgrenzen sind deckungsgleich mit race.js.
     4. progressionPhase spricht das Vokabular, das progression versteht.

   node supabase/tests/goal_taper_resolver_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const T = require(join(REPO, 'app/js/engine/goal-taper-resolver.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const TODAY = '2026-08-20';
/* Datum n Tage nach TODAY. */
function plus(n) { const d = new Date('2026-08-20T00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

/* ---------- A · Die Phase folgt dem Datum ---------- */
console.log('\nA · Ableitung');
{
  const ph = (n) => T.resolve({ today: TODAY, targetDate: plus(n) }).phase;
  ok('A1 Wettkampftag (0 Tage) → race_week', ph(0) === 'race_week', ph(0));
  ok('A2 6 Tage → race_week', ph(6) === 'race_week', ph(6));
  ok('A3 7 Tage → taper (erste Taper-Grenze)', ph(7) === 'taper', ph(7));
  ok('A4 13 Tage → taper (letzter Taper-Tag)', ph(13) === 'taper', ph(13));
  ok('A5 14 Tage → build (ausserhalb des Taper-Fensters)', ph(14) === 'build', ph(14));
  ok('A6 40 Tage → build', ph(40) === 'build', ph(40));
  /* Der Sprung, um den es geht: EIN Tag entscheidet ueber race_week vs. taper
     und ueber taper vs. build. Genau das soll „im Shadow-Vergleich korrekt
     reagieren". */
  ok('A7 die Grenzen sind scharf (6→race_week, 7→taper, 13→taper, 14→build)',
    ph(6) === 'race_week' && ph(7) === 'taper' && ph(13) === 'taper' && ph(14) === 'build');
}

/* ---------- B · Datenlücke ≠ Fehler ---------- */
console.log('\nB · Abwesenheit ist eine Aussage');
{
  const r0 = T.resolve({ today: TODAY });
  ok('B1 kein Zieldatum → phase null, kein Wurf', r0.phase === null && r0.reason === 'no_target_date');
  const rp = T.resolve({ today: TODAY, targetDate: plus(-3) });
  ok('B2 Datum in der Vergangenheit → phase null, reason race_passed', rp.phase === null && rp.reason === 'race_passed', rp.reason);
  const ru = T.resolve({ today: TODAY, targetDate: 'übermorgen' });
  ok('B3 unlesbares Datum → phase null, reason unreadable_date', ru.phase === null && ru.reason === 'unreadable_date', ru.reason);
  ok('B4 „active" nur bei echter Absenkung',
    T.resolve({ today: TODAY, targetDate: plus(3) }).active === true &&
    T.resolve({ today: TODAY, targetDate: plus(20) }).active === false &&
    T.resolve({ today: TODAY }).active === false);
}

/* ---------- C · Grenzen deckungsgleich mit race.js ---------- */
console.log('\nC · Eine Grenze, nicht zwei');
{
  const race = readFileSync(join(REPO, 'app/js/race.js'), 'utf8');
  /* race.js: „d <= 6 … Race Week" und „d <= 13 … Taper". Aendert dort jemand die
     Zahl, muss dieser Test rot werden — sonst laufen Anzeige und Ableitung
     auseinander. */
  ok('C1 race.js nutzt 6 als Race-Week-Grenze', /d\s*<=\s*6/.test(race), 'RACE_WEEK_MAX=' + T.RACE_WEEK_MAX);
  ok('C2 race.js nutzt 13 als Taper-Grenze', /d\s*<=\s*13/.test(race), 'TAPER_MAX=' + T.TAPER_MAX);
  ok('C3 der Resolver trägt genau diese Grenzen', T.RACE_WEEK_MAX === 6 && T.TAPER_MAX === 13);
}

/* ---------- D · Vokabular für progression ---------- */
console.log('\nD · progression-Vokabular');
{
  const prog = readFileSync(join(REPO, 'app/js/engine/progression.js'), 'utf8');
  const taper = T.resolve({ today: TODAY, targetDate: plus(10) });
  const week  = T.resolve({ today: TODAY, targetDate: plus(3) });
  ok('D1 Taper meldet progressionPhase "taper"', taper.progressionPhase === 'taper');
  ok('D2 Wettkampfwoche meldet "race_week"', week.progressionPhase === 'race_week');
  ok('D3 „build" meldet keine progressionPhase (keine Absenkung)',
    T.resolve({ today: TODAY, targetDate: plus(30) }).progressionPhase === null);
  ok('D4 progression kennt phase === "taper" wirklich', /phase === 'taper'/.test(prog));
  ok('D5 … und fuehrt race_week als Freigabegrund', /race_week:/.test(prog));
  ok('D6 fromGoal nimmt targetDate ODER raceDate',
    T.fromGoal({ targetDate: plus(3) }, TODAY).phase === 'race_week' &&
    T.fromGoal({ raceDate: plus(10) }, TODAY).phase === 'taper');
}

/* ---------- E · Verdrahtung ---------- */
console.log('\nE · Verdrahtung');
{
  const APP = join(REPO, 'app');
  ok('E1 Modul eingehängt', /js\/engine\/goal-taper-resolver\.js/.test(readFileSync(join(APP, 'index.html'), 'utf8')));
  ok('E2 im Offline-Vorrat', /engine\/goal-taper-resolver\.js/.test(readFileSync(join(APP, 'sw.js'), 'utf8')));
  ok('E3 als Beobachter am Renderpfad (ORVIA._lastTaperPhase)', /_lastTaperPhase=ORVIA\.goalTaperResolver\.fromGoal/.test(readFileSync(join(APP, 'js/ui.js'), 'utf8')));
}

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
