/* ============================================================
   ORVIA · strength_progression — B-08
   ------------------------------------------------------------
   Band 1 verlangt: „Progressionsvorschlag je Satz; definierte Regelfälle
   (Steigerung, Stagnation, Deload) als Tests grün."

   Geprueft:
     A. Doppelte Progression — Obergrenze erreicht ⇒ Gewicht hoch, Wdh. zurueck
     B. Anstrengung deckelt: RIR 0 oder fehlende RIR ⇒ KEINE Steigerung
     C. Unter dem Bereich ⇒ Reduktion; innerhalb ⇒ halten + 1 Wdh.
     D. Stagnation ⇒ Deload, und erst ab dem Schwellwert
     E. Satzgenau: Saetze derselben Uebung koennen verschieden entscheiden
     F. Datenlücke ≠ Wert · Determinismus · Ladbarkeit (Vielfaches des Inkrements)

   node supabase/tests/strength_progression_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'engine', 'strength-progression.js'))) || _flat);
const P = require(join(APP, 'js/engine/strength-progression.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const S = o => P.suggestSet(o);
const sess = (...sets) => ({ sets: sets.map((s, i) => Object.assign({ setNumber: i + 1 }, s)) });

console.log('\nA · Doppelte Progression');
{
  const r = S({ weight: 60, reps: 10, rir: 2 });
  ok('A1 Obergrenze + Reserve → Gewicht hoch', r.action === 'increase' && r.weight === 62.5, r.weight + '/' + r.action);
  ok('A2 … und Wiederholungen auf die Untergrenze zurück', r.reps === 6, String(r.reps));
  ok('A3 Grund benannt', r.reason === 'range_topped', r.reason);
  const r2 = S({ weight: 60, reps: 12, rir: 3, repRange: { min: 8, max: 12 }, increment: 5 });
  ok('A4 eigener Bereich und eigenes Inkrement werden geachtet',
    r2.weight === 65 && r2.reps === 8, r2.weight + ' x' + r2.reps);
  ok('A5 über der Obergrenze zählt wie erreicht', S({ weight: 60, reps: 14, rir: 2 }).action === 'increase');
}

console.log('\nB · Anstrengung deckelt die Steigerung');
{
  const r0 = S({ weight: 60, reps: 10, rir: 0 });
  ok('B1 RIR 0 → KEINE Steigerung, halten', r0.action === 'hold' && r0.weight === 60 && r0.reason === 'effort_capped', r0.reason);
  const ru = S({ weight: 60, reps: 10 });
  ok('B2 fehlende RIR → nicht raten, halten', ru.action === 'hold' && ru.reason === 'rir_unknown', ru.reason);
  ok('B3 RIR 1 reicht für die Steigerung', S({ weight: 60, reps: 10, rir: 1 }).action === 'increase');
}

console.log('\nC · Unterhalb und innerhalb des Bereichs');
{
  const u = S({ weight: 60, reps: 4, rir: 0 });
  ok('C1 unter der Untergrenze → Gewicht runter', u.action === 'reduce' && u.weight === 57.5 && u.reason === 'below_range', u.weight + '');
  ok('C2 … auf die Untergrenze der Wiederholungen', u.reps === 6);
  const w = S({ weight: 60, reps: 8, rir: 2 });
  ok('C3 innerhalb → Gewicht halten, eine Wdh. mehr', w.action === 'hold' && w.weight === 60 && w.reps === 9, w.reps + '');
  ok('C4 eine Wdh. mehr überschreitet die Obergrenze nie',
    S({ weight: 60, reps: 9, rir: 2, repRange: { min: 6, max: 10 } }).reps === 10);
  ok('C5 Gewicht wird nie negativ', S({ weight: 1, reps: 2, rir: 0 }).weight >= 0);
}

console.log('\nD · Stagnation und Deload');
{
  const d = S({ weight: 60, reps: 8, rir: 2, stagnant: true });
  ok('D1 Stagnation → Deload', d.action === 'deload' && d.reason === 'stagnation');
  ok('D2 Deload ist konservativ (−10 %, auf Ladbarkeit abgerundet)', d.weight === 52.5, String(d.weight));
  ok('D3 Stagnation schlägt die Steigerung',
    S({ weight: 60, reps: 10, rir: 3, stagnant: true }).action === 'deload');

  const gleich = { weight: 60, reps: 8, rir: 2 };
  const h3 = [sess(gleich), sess(gleich), sess(gleich)];
  ok('D4 drei gleiche Einheiten → stagniert', P.isStagnant(h3, 1) === true);
  ok('D5 zwei gleiche Einheiten → NOCH KEINE Aussage', P.isStagnant(h3.slice(0, 2), 1) === false);
  const h3b = [sess(gleich), sess({ weight: 60, reps: 9, rir: 2 }), sess(gleich)];
  ok('D6 eine Änderung dazwischen → nicht stagniert', P.isStagnant(h3b, 1) === false);
  ok('D7 eigener Schwellwert wird geachtet', P.isStagnant(h3.slice(0, 2), 1, 2) === true);
  ok('D8 fehlende Werte gelten nicht als Stagnation',
    P.isStagnant([sess({ reps: 8 }), sess({ reps: 8 }), sess({ reps: 8 })], 1) === false);
}

console.log('\nE · Satzgenau — der Kern von B-08');
{
  const r = P.suggest({ history: [sess(
    { weight: 60, reps: 10, rir: 2 },       /* Satz 1: steigern */
    { weight: 60, reps: 8, rir: 1 },        /* Satz 2: halten   */
    { weight: 60, reps: 4, rir: 0 })] });   /* Satz 3: reduzieren */
  ok('E1 drei Sätze, drei verschiedene Entscheidungen',
    r.perSet.map(s => s.action).join(',') === 'increase,hold,reduce', r.perSet.map(s => s.action).join(','));
  ok('E2 Satznummern bleiben erhalten', r.perSet.map(s => s.setNumber).join(',') === '1,2,3');
  /* Stagnation wird JE SATZNUMMER bestimmt, nicht für die ganze Übung. */
  const g = { weight: 60, reps: 8, rir: 2 };
  const hist = [sess(g, { weight: 60, reps: 8, rir: 2 }), sess(g, { weight: 60, reps: 9, rir: 2 }), sess(g, { weight: 60, reps: 10, rir: 2 })];
  const r2 = P.suggest({ history: hist });
  ok('E3 stagnierender Satz 1 → Deload, fortschreitender Satz 2 nicht',
    r2.perSet[0].action === 'deload' && r2.perSet[1].action !== 'deload',
    r2.perSet.map(s => s.action).join(','));
}

console.log('\nF · Datenlücke, Ladbarkeit, Determinismus');
{
  ok('F1 fehlendes Gewicht → keine Empfehlung', S({ reps: 8, rir: 2 }).action === 'none' && S({ reps: 8 }).reason === 'no_data');
  ok('F2 fehlende Wiederholungen → keine Empfehlung', S({ weight: 60 }).reason === 'no_data');
  ok('F3 unsinniger Bereich → range_invalid', S({ weight: 60, reps: 8, repRange: { min: 10, max: 5 } }).reason === 'range_invalid');
  ok('F4 leere Historie → no_history', P.suggest({ history: [] }).reason === 'no_history');
  ok('F5 ohne Argumente kein Wurf', P.suggest().reason === 'no_history' && S().reason === 'no_data');
  /* Jede Empfehlung muss ein Vielfaches des Inkrements sein — sonst nicht ladbar. */
  const alle = [S({ weight: 61.3, reps: 10, rir: 2 }), S({ weight: 61.3, reps: 4, rir: 0 }), S({ weight: 61.3, reps: 8, rir: 2, stagnant: true })];
  ok('F6 jede geänderte Last ist ein Vielfaches von 2,5',
    alle.every(x => x.weight == null || Math.abs(Math.round(x.weight / 2.5) * 2.5 - x.weight) < 1e-9),
    alle.map(x => x.weight).join(','));
  const a = JSON.stringify(P.suggest({ history: [sess({ weight: 60, reps: 10, rir: 2 })] }));
  ok('F7 deterministisch', a === JSON.stringify(P.suggest({ history: [sess({ weight: 60, reps: 10, rir: 2 })] })));
}

console.log('\n' + '─'.repeat(60));
console.log('strength_progression: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);
