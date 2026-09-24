const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous'); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/repos/workoutRepository.js';
rep(F,
`    // Dedupe über (user_id, client_set_id) → idempotent bei Doppelklick/Retry/Offline/Reload.
    async addSet(workoutExerciseId, set) {
      const row = M ? M.setToRow(set) : Object.assign({}, set);
      row.workout_exercise_id = workoutExerciseId;
      row.client_set_id = set.clientSetId || null;
      return B.upsert('workout_sets', row, set.clientSetId ? 'user_id,client_set_id' : undefined);
    },`,
`    /* Dedupe über (user_id, client_set_id) → idempotent bei Doppelklick/Retry/Offline/Reload.

       v8-391: Gleiche Lücke wie bei addExercise, hier mit direkter Wirkung auf die Zahlen —
       ein doppelt geschriebener Satz erhöht Volumen, Tonnage und die Sätze je Muskel
       sofort. Ohne clientSetId lief der Aufruf als reines INSERT, und der partielle
       Unique-Index (where client_set_id is not null) greift dort nicht. */
    async addSet(workoutExerciseId, set) {
      if (!(set && set.clientSetId)) {
        return B.fail('client_set_id_required',
          'Satz ohne clientSetId — ohne sie greift der Dedupe-Index nicht und ein Retry zählt den Satz doppelt.',
          { source: 'empty' });
      }
      const row = M ? M.setToRow(set) : Object.assign({}, set);
      row.workout_exercise_id = workoutExerciseId;
      row.client_set_id = set.clientSetId;
      return B.upsert('workout_sets', row, 'user_id,client_set_id');
    },`);
console.log('ok');
