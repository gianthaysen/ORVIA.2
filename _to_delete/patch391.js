const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/repos/workoutRepository.js';
rep(F,
`    // Dedupe über (user_id, client_exercise_id) → reorder-sicher.
    async addExercise(sessionId, ex) {
      return B.upsert('workout_exercises', {`,
`    /* Dedupe über (user_id, client_exercise_id) → reorder-sicher.

       v8-391 (Befund 18.09.): Ohne clientExerciseId lief der Aufruf als reines INSERT
       ohne Konfliktziel — und der Unique-Index ist PARTIELL (where client_exercise_id
       is not null), greift dort also gar nicht. Jeder Doppelklick oder Retry legte
       damit eine weitere Übungszeile an, die sich nie wieder deduplizieren liess.
       Belegt an der Einheit vom 20.06.2026: drei Zeilen mit order_index 0, vier von
       fünf ohne einen einzigen Satz. (Der frühere Index über (session, order_index)
       wurde in Migration 0004 bewusst entfernt, weil er beim Umsortieren falsche
       Upserts erzeugte — der Ersatz greift aber nur mit gesetzter Client-ID.)
       workout-store vergibt die ID heute immer; das hier ist der Riegel dagegen,
       dass ein anderer Aufrufer sie wieder weglässt. Fail closed statt stiller
       Dublette. */
    async addExercise(sessionId, ex) {
      if (!(ex && ex.clientExerciseId)) {
        return B.fail('client_exercise_id_required',
          'Übungszeile ohne clientExerciseId — ohne sie greift der Dedupe-Index nicht und jeder Retry erzeugt eine Dublette.',
          { source: 'empty' });
      }
      return B.upsert('workout_exercises', {`);
rep(F,
`        target_weight_kg: ex.targetWeightKg != null ? ex.targetWeightKg : null
      }, ex.clientExerciseId ? 'user_id,client_exercise_id' : undefined);`,
`        target_weight_kg: ex.targetWeightKg != null ? ex.targetWeightKg : null
      }, 'user_id,client_exercise_id');`);
console.log('ok');
