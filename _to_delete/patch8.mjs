import fs from 'fs';
function rep(f,a,b){let s=fs.readFileSync(f,'utf8'); if(!s.includes(a)){console.error('MISSING in '+f+': '+a.slice(0,100)); process.exit(1);} s=s.replace(a,b); fs.writeFileSync(f,s);}
rep('app/js/repos/workoutRepository.js',
`        const { data, error } = await B.sb().from('workout_exercises')
          .select('*, exercise:exercises(*), workout_sets(*)')
          .eq('user_id', B.currentUserId()).eq('workout_session_id', sessionId)
          .order('order_index', { ascending: true });
        if (error) return B.fail('query_failed', error.message);
        const exercises = (data || []).map(we => ({`,
`        /* v8-384 (Befund 15.09.): workout_exercises hat ZWEI Fremdschluessel auf exercises
           (exercise_id, replaced_by_exercise_id). Der Embed \`exercises(*)\` ist damit fuer
           PostgREST mehrdeutig und wurde abgelehnt — jeder Baum-Abruf scheiterte still, die
           Saetze schienen "weg". Jetzt: Embed mit FK-Hinweis; schlaegt auch der fehl,
           Fallback ohne Embed (Uebungen + Saetze getrennt, Uebungszeilen per IN-Abfrage). */
        let { data, error } = await B.sb().from('workout_exercises')
          .select('*, exercise:exercises!workout_exercises_exercise_id_fkey(*), workout_sets(*)')
          .eq('user_id', B.currentUserId()).eq('workout_session_id', sessionId)
          .order('order_index', { ascending: true });
        if (error) {
          const r2 = await B.sb().from('workout_exercises').select('*, workout_sets(*)')
            .eq('user_id', B.currentUserId()).eq('workout_session_id', sessionId).order('order_index', { ascending: true });
          if (r2.error) return B.fail('query_failed', r2.error.message);
          data = r2.data || [];
          const ids = Array.from(new Set(data.map(we => we.exercise_id).filter(Boolean)));
          let byId = {};
          if (ids.length) { try { const r3 = await B.sb().from('exercises').select('*').in('id', ids); (r3.data || []).forEach(e => { byId[e.id] = e; }); } catch (e) {} }
          data.forEach(we => { we.exercise = byId[we.exercise_id] || null; });
        }
        const exercises = (data || []).map(we => ({`);
/* gym-volume: ein fehlgeschlagener Einzelbaum ist eine Warnung, nur Totalausfall ein Fehler */
rep('app/js/gym-volume.js',
`      call('workoutRepository.loadWorkoutTree', uniqueIds.length > 0, detailFails === 0, workoutSessions.length, detailFails ? 'WORKOUT_DETAILS_FAILED' : null);`,
`      /* v8-384: Einzelausfall = Warnung (partial), nur Totalausfall = Fehler. */
      var allFailed = uniqueIds.length > 0 && detailFails === uniqueIds.length;
      call('workoutRepository.loadWorkoutTree', uniqueIds.length > 0, !allFailed, workoutSessions.length, allFailed ? 'WORKOUT_DETAILS_FAILED' : (detailFails ? 'WORKOUT_DETAILS_PARTIAL' : null));`);
console.log('patch8 ok');
