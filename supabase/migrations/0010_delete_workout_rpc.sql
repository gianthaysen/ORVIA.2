-- ============================================================
--  ORVIA · 0010 — Atomares, owner-geschütztes Workout-Löschen (Inkrement 2B-Fix)
--  Löscht in EINER Transaktion die eigene Workout-Session (cascade → workout_exercises → workout_sets)
--  und die zugehörige kanonische Activity (FK on delete set null → muss explizit gelöscht werden).
--  security invoker → RLS/auth.uid(); fremde Sessions/Activities werden NICHT gelöscht.
--  Idempotent: erneuter Aufruf liefert alreadyDeleted=true, ohne Fehler.
--  HINWEIS: Diese Migration ist NICHT offline getestet — live (SQL Editor) ausführen.
-- ============================================================
begin;

create or replace function public.orvia_delete_workout(p_session_id uuid)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_exists boolean := false;
  v_act uuid;
begin
  select true into v_exists from public.workout_sessions
   where id = p_session_id and user_id = auth.uid();
  select id into v_act from public.activities
   where workout_session_id = p_session_id and user_id = auth.uid() limit 1;

  -- Activity immer (auch ohne Session) konsistent entfernen — nur EIGENE.
  delete from public.activities where workout_session_id = p_session_id and user_id = auth.uid();

  if v_exists is not true then
    return json_build_object('ok', true, 'alreadyDeleted', true,
                             'workoutSessionId', p_session_id, 'activityId', v_act);
  end if;

  -- Session löschen → workout_exercises (cascade) → workout_sets (cascade).
  delete from public.workout_sessions where id = p_session_id and user_id = auth.uid();

  return json_build_object('ok', true, 'alreadyDeleted', false,
                           'workoutSessionId', p_session_id, 'activityId', v_act);
end $$;

revoke all on function public.orvia_delete_workout(uuid) from public;
revoke all on function public.orvia_delete_workout(uuid) from anon;
grant execute on function public.orvia_delete_workout(uuid) to authenticated;

commit;
