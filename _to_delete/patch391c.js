const fs=require('fs');const F='supabase/tests/workout_repo_norow_phase42_test.mjs';let s=fs.readFileSync(F,'utf8');
const marker = "  console.log(`\\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);";
if(s.indexOf(marker)<0) throw new Error('marker');
const add = `  /* ---- v8-391 · Dedupe-Schluessel ist Pflicht (Befund 18.09.2026) ----
     Der Unique-Index auf workout_exercises/workout_sets ist PARTIELL
     (where client_exercise_id / client_set_id is not null). Fehlte die Client-ID,
     lief der Aufruf als reines INSERT ohne Konfliktziel: jeder Doppelklick, Retry
     oder Offline-Nachlauf legte eine weitere Zeile an, die sich nie wieder
     deduplizieren liess. Belegt an der Einheit vom 20.06.2026 (drei Uebungszeilen
     mit order_index 0, vier von fuenf ohne einen einzigen Satz). Bei Saetzen wirkt
     das direkt auf Volumen, Tonnage und Saetze je Muskel.
     Der frueher strengere Index ueber (session, order_index) wurde in Migration 0004
     bewusst entfernt (Umsortieren erzeugte falsche Upserts) — der Ersatz greift aber
     nur mit gesetzter Client-ID. Deshalb: fail closed statt stiller Dublette. */
  RESULT = { data: [{ id: 'we1' }], error: null };
  r = await repo.addExercise('sess1', { exerciseId: 'ex1', order: 0 });
  ok('addExercise ohne clientExerciseId → Fehler statt nicht-deduplizierbarer Zeile',
    !r.success && r.error.code === 'client_exercise_id_required', JSON.stringify(r.error));
  r = await repo.addExercise('sess1', { clientExerciseId: 'we:1', exerciseId: 'ex1', order: 0 });
  ok('addExercise mit clientExerciseId → Erfolg', r.success === true, JSON.stringify(r.error));

  RESULT = { data: [{ id: 's1' }], error: null };
  r = await repo.addSet('we1', { setNumber: 1, weight: 80, reps: 10 });
  ok('addSet ohne clientSetId → Fehler statt doppelt gezaehltem Satz',
    !r.success && r.error.code === 'client_set_id_required', JSON.stringify(r.error));
  r = await repo.addSet('we1', { clientSetId: 'set:1', setNumber: 1, weight: 80, reps: 10 });
  ok('addSet mit clientSetId → Erfolg', r.success === true, JSON.stringify(r.error));

`;
s=s.replace(marker, add+marker); fs.writeFileSync(F,s); console.log('ok');
