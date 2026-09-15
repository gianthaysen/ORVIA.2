-- ============================================================
-- TEIL 1 · VORSCHAU (nur lesen). Zeigt Sessions ohne activities-Zeile.
-- E-Mail unten ggf. auf das betroffene Konto aendern.
-- ============================================================
-- ORVIA · Backfill-VORSCHAU: abgeschlossene Workout-Sessions OHNE activities-Zeile (nur lesen)
with me as (select id from auth.users where email = 'gianthaysen76@gmail.com'),
s as (
  select ws.id, ws.local_date, ws.started_at, ws.finished_at, ws.status, ws.sport_key
  from public.workout_sessions ws, me
  where ws.user_id = me.id and ws.status = 'completed'
    and not exists (select 1 from public.activities a
                    where a.user_id = ws.user_id
                      and (a.workout_session_id = ws.id
                           or (a.source = 'orvia_workout' and a.source_record_id = ws.id::text)))
)
select s.local_date, s.id as session_id, s.sport_key,
       count(distinct we.id) as uebungen,
       count(st.id) as saetze_gesamt,
       count(st.id) filter (where st.completed) as saetze_completed,
       count(st.id) filter (where st.set_type = 'working') as saetze_working,
       round(sum(st.weight * st.reps) filter (where st.set_type = 'working' and st.weight is not null and st.reps is not null)) as volumen_kg
from s
left join public.workout_exercises we on we.workout_session_id = s.id
left join public.workout_sets st on st.workout_exercise_id = we.id
group by s.local_date, s.id, s.sport_key
order by s.local_date;

-- ============================================================
-- TEIL 2 · SCHREIBEN. Erst ausfuehren, wenn Teil 1 die erwarteten Sessions zeigt.
-- Zweiter Lauf = 0 rows (idempotent).
-- ============================================================
-- ORVIA · Backfill: activities-Zeilen fuer abgeschlossene Sessions ohne Activity anlegen.
-- Laeuft ueber die bestehende RPC orvia_upsert_activity_from_session (security invoker),
-- deshalb werden JWT-Claims des Kontos gesetzt und die Rolle authenticated angenommen —
-- RLS und Identitaetsschutz der RPC greifen wie im Client. Idempotent: bereits
-- verknuepfte Sessions werden gar nicht erst ausgewaehlt.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'gianthaysen76@gmail.com'),
                    'role', 'authenticated')::text, true);
set local role authenticated;

with s as (
  select ws.id
  from public.workout_sessions ws
  where ws.user_id = auth.uid() and ws.status = 'completed'
    and not exists (select 1 from public.activities a
                    where a.user_id = ws.user_id
                      and (a.workout_session_id = ws.id
                           or (a.source = 'orvia_workout' and a.source_record_id = ws.id::text)))
),
sm as (
  -- Summary wie activity-normalize.summarizeWorkout: nur Arbeitssaetze (set_type working);
  -- completed wird hier NICHT gefiltert, weil alte Saetze teils ohne completed-Flag liegen.
  select s.id,
    count(distinct we.id) filter (where st.set_type = 'working')                       as ex_n,
    count(st.id)          filter (where st.set_type = 'working')                       as set_n,
    round(sum(st.weight * st.reps) filter (where st.set_type = 'working'
                                            and st.weight is not null and st.reps is not null)) as vol,
    round(avg(st.rir)     filter (where st.set_type = 'working' and st.rir is not null)::numeric, 1) as rir
  from s
  join public.workout_exercises we on we.workout_session_id = s.id
  left join public.workout_sets st on st.workout_exercise_id = we.id
  group by s.id
)
select a.id as activity_id, a.started_at, a.sport_id, a.duration_seconds, a.summary
from sm
cross join lateral public.orvia_upsert_activity_from_session(
  sm.id,
  jsonb_strip_nulls(jsonb_build_object(
    'exerciseCount',   sm.ex_n,
    'workingSetCount', sm.set_n,
    'totalVolumeKg',   nullif(sm.vol, 0),
    'avgRir',          sm.rir)),
  '{}'::jsonb,
  null) a
order by a.started_at;

commit;
