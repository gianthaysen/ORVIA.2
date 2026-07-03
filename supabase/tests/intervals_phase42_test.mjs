/* ORVIA · Phase 4.2 Teil B — Lauf-Intervall-Struktur (Calc.buildIntervals).
   node supabase/tests/intervals_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
(0, eval)(fs.readFileSync(new URL('../../js/calc.js', import.meta.url), 'utf8'));
const B = globalThis.Calc.buildIntervals;

const s = B({ warmupMin: 10, reps: 6, workSec: 180, recoverSec: 120, cooldownMin: 10 });
ok('Schrittzahl: WU + 6 Work + 5 Recover + CD = 13', s.length === 1 + 6 + 5 + 1, 'len=' + s.length);
ok('erster Schritt Warm-up 600s', s[0].kind === 'warmup' && s[0].seconds === 600);
ok('letzter Schritt Cool-down 600s', s[s.length - 1].kind === 'cooldown' && s[s.length - 1].seconds === 600);
ok('keine Erholung nach dem letzten Intervall', s[s.length - 2].kind === 'work');
const works = s.filter(x => x.kind === 'work'); const recs = s.filter(x => x.kind === 'recover');
ok('6 Belastungen, 5 Erholungen', works.length === 6 && recs.length === 5);
ok('Belastung 180s, Erholung 120s', works[0].seconds === 180 && recs[0].seconds === 120);

ok('ohne Warm-up/Cool-down: nur Work/Recover', B({ reps: 3, workSec: 60, recoverSec: 30 }).length === 3 + 2);
ok('reps 0 → leer (außer WU/CD)', B({ reps: 0, workSec: 60 }).length === 0);
ok('robust gegen leere Spec', Array.isArray(B()) && B().length === 0);
ok('negative Werte → keine negativen Sekunden', B({ warmupMin: -5, reps: -2, workSec: -10 }).every(x => x.seconds >= 0) && B({ warmupMin: -5 }).length === 0);

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
