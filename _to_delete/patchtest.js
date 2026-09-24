const fs=require('fs');const f='supabase/tests/activity_store_test.mjs';let s=fs.readFileSync(f,'utf8');
const marker="console.log('\\nErgebnis: ' + pass";
const add=`/* ===== v8-386 · repairWorkoutSnapshot: Zuordnung ueber Session/Quelle + Snapshot-Rueckgabe ===== */
reset();
let rp = S.upsertActivityFromWorkout({ id: 'wr1', sport_key: 'gym', status: 'completed', duration_min: 60 }, [], { syncStatus: 'pending' });
S.markSynced(rp.activity.clientRecordId, 'srv-wr1');
let rA = S.repairWorkoutSnapshot('srv-wr1', snapshot);
ok('repair per Server-id ok', rA.ok === true && rA.snapshot.length === 1);
reset();
rp = S.upsertActivityFromWorkout({ id: 'wr2', sport_key: 'gym', status: 'completed', duration_min: 60 }, [], { syncStatus: 'pending' });
let rB = S.repairWorkoutSnapshot('unbekannte-server-id', snapshot, { id: 'unbekannte-server-id', workoutSessionId: 'wr2', source: 'orvia_workout', sourceRecordId: 'wr2' });
ok('repair per ref.workoutSessionId ok (Server-Activity ohne lokale id)', rB.ok === true && rB.activity.clientRecordId === rp.activity.clientRecordId);
ok('lokaler Snapshot danach lesbar', S.getWorkoutDetailsForActivity(rp.activity.clientRecordId).hasDetails === true);
let rC = S.repairWorkoutSnapshot('gibt-es-nicht', snapshot, { workoutSessionId: 'xyz' });
ok('kein lokaler Datensatz: ok=false, Snapshot trotzdem geliefert', rC.ok === false && Array.isArray(rC.snapshot) && rC.snapshot.length === 1 && rC.snapshot[0].sets.length === 3);
let rD = S.repairWorkoutSnapshot('gibt-es-nicht', []);
ok('leerer Baum: ok=false, snapshot []', rD.ok === false && rD.error === 'leer' && rD.snapshot.length === 0);

`;
if(s.indexOf(marker)<0) throw new Error('marker');
s=s.replace(marker, add+marker); fs.writeFileSync(f,s); console.log('ok');
