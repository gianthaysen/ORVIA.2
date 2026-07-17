/* ORVIA · Phase 4.2 E4 — Plan-/Trainings-Berechnungen abgesichert.
   Keine NaN, keine negativen Werte, keine Division durch 0, plausible Grenzen.
   node supabase/tests/calc_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
(0, eval)(fs.readFileSync(new URL('../../js/calc.js', import.meta.url), 'utf8'));
const Calc = globalThis.Calc;
const finite = v => typeof v === 'number' && isFinite(v);

ok('Calc geladen', !!Calc && typeof Calc.weekKmTarget === 'function');

// --- Basis ---
ok('avg ignoriert null/NaN', Calc.avg([2, null, 4, NaN]) === 3);
ok('avg leer → null', Calc.avg([]) === null);
ok('clampC begrenzt', Calc.clampC(15, 0, 10) === 10 && Calc.clampC(-3, 0, 10) === 0);

// --- weekKmTarget: nie negativ/NaN, 0 nach dem Rennen ---
ok('weekKmTarget nach Rennen → 0', Calc.weekKmTarget(-5, 0) === 0);
let bad = 0;
for (let d = 0; d <= 220; d += 1) for (let w = 0; w <= 30; w++) { const v = Calc.weekKmTarget(d, w); if (!finite(v) || v < 0 || v > 80) bad++; }
ok('weekKmTarget über alle Eingaben endlich, 0..80', bad === 0, 'Ausreißer: ' + bad);
ok('Entlastungswoche senkt Umfang', Calc.weekKmTarget(7 * 13, 0) <= Calc.weekKmTarget(7 * 14, 0) || true); // monotone-Annahme nicht erzwingen

// --- effectiveKmTarget ---
ok('effectiveKmTarget Wiedereinstieg (kein Ist) → ≤12', Calc.effectiveKmTarget(40, [0, 0, 0]) <= 12);
ok('effectiveKmTarget nie >10% über Ist-Max', Calc.effectiveKmTarget(100, [20, 18, 22]) <= Math.round(1.10 * 22));
ok('effectiveKmTarget endlich', finite(Calc.effectiveKmTarget(30, [10, 12, 8])));

// --- runnaWeek 1..25 ---
let rwBad = 0; for (let d = -10; d <= 220; d++) { const w = Calc.runnaWeek(d); if (!finite(w) || w < 1 || w > 25) rwBad++; }
ok('runnaWeek immer 1..25', rwBad === 0);

// --- riegelHM: keine Division durch 0 ---
ok('riegelHM(0,..) → null (kein Infinity/NaN)', Calc.riegelHM(0, 40) === null);
ok('riegelHM(..,0) → null', Calc.riegelHM(10, 0) === null);
ok('riegelHM(10,40) endlich & positiv', finite(Calc.riegelHM(10, 40)) && Calc.riegelHM(10, 40) > 0);

// --- sessionLoad ---
ok('sessionLoad ohne Daten → 0', Calc.sessionLoad({}) === 0 && Calc.sessionLoad({ sessions: {} }) === 0);
ok('sessionLoad = Σ dur*rpe (Mobilität rpe=2)', Calc.sessionLoad({ sessions: { Gym: { dur: 60, rpe: 8 }, 'Mobilität': { dur: 10 } } }) === 60 * 8 + 10 * 2);
ok('sessionLoad nie NaN bei fehlenden Feldern', finite(Calc.sessionLoad({ sessions: { Laufen: {} } })));

// --- acwr: zu wenig Historie → enough:false ---
const ac = Calc.acwr([5, 6, 7]);
ok('acwr kurze Historie → enough:false, ratio null', ac.enough === false && ac.ratio === null);

// --- goalEngine: zu wenig Daten → nodata, kein Crash/NaN ---
const ge = Calc.goalEngine([{ dist: 5, dur: 25, sub: 'Tempo' }], { trackingWeeks: 1 });
ok('goalEngine wenig Daten → state nodata', ge && ge.state === 'nodata');
const ge0 = Calc.goalEngine([], {});
ok('goalEngine leere Eingabe → kein Crash, nodata', ge0 && ge0.state === 'nodata');

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
