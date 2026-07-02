-- ============================================================
--  ORVIA · 0007 — Atomarer Workout-Terminalzustand (Phase 4.2f)
--  Schließt/abbricht eine AKTIVE, EIGENE Session in EINEM Schritt direkt in Postgres.
--  Ersetzt den fehleranfälligen mehrstufigen Client-Flow (update → read → verify → clear).
--  security invoker → RLS/auth.uid() greift; nur eigene aktive Session ist betroffen.
--  Nutzt ausschließlich vorhandene Spalten (0004/0005): status, finished_at, duration_min,
--  session_rpe, cancel_reason, paused_at, total_paused_seconds, started_at, user_id.
-- ============================================================

create or replace function public.orvia_close_active_workout(
  p_session_id uuid,
  p_target_status text,
  p_session_rpe numeric default null,
  p_cancel_reason text default null
)
returns public.workout_sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.workout_sessions;
  v_paused_seconds numeric;
  v_duration_min integer;
begin
  if p_target_status not in ('completed', 'aborted', 'cancelled') then
    raise exception 'invalid_target_status';
  end if;

  if p_session_rpe is not null and (p_session_rpe < 1 or p_session_rpe > 10) then
    raise exception 'invalid_session_rpe';
  end if;

  -- Aktive eigene Session sperren + gesamte Pausenzeit (inkl. laufender Pause) berechnen.
  select
    coalesce(total_paused_seconds, 0)
    + case when paused_at is not null then extract(epoch from (now() - paused_at)) else 0 end
  into v_paused_seconds
  from public.workout_sessions
  where id = p_session_id and user_id = auth.uid() and status = 'active'
  for update;

  if not found then
    raise exception 'active_workout_not_found';
  end if;

  select greatest(0, round(extract(epoch from (now() - started_at)) / 60 - coalesce(v_paused_seconds, 0) / 60))::integer
  into v_duration_min
  from public.workout_sessions
  where id = p_session_id and user_id = auth.uid();

  update public.workout_sessions
  set
    status = p_target_status,
    finished_at = now(),
    duration_min = v_duration_min,
    session_rpe = case when p_target_status = 'completed' then p_session_rpe else session_rpe end,
    cancel_reason = case when p_target_status in ('aborted', 'cancelled') then p_cancel_reason else cancel_reason end,
    paused_at = null,
    total_paused_seconds = round(coalesce(v_paused_seconds, 0))
  where id = p_session_id and user_id = auth.uid() and status = 'active'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'workout_transition_failed';
  end if;

  return v_row;
end;
$$;

revoke all on function public.orvia_close_active_workout(uuid, text, numeric, text) from public;
grant execute on function public.orvia_close_active_workout(uuid, text, numeric, text) to authenticated;

insert into public.schema_migrations(version) values ('0007_workout_terminal_rpc') on conflict (version) do nothing;

-- ------------------------------------------------------------
-- EINMALIGE BEREINIGUNG der aktuell festhängenden Session(s) — MANUELL ausführen,
-- NUR mit deiner echten user_id (NICHT Teil der automatischen Migration):
--
--   select id, user_id, status, sport, started_at
--   from public.workout_sessions where status = 'active' order by started_at desc;
--
--   update public.workout_sessions
--     set status = 'aborted', finished_at = now(), paused_at = null,
--         cancel_reason = 'manual_stale_session_cleanup'
--   where user_id = 'DEINE_USER_ID' and status = 'active'
--   returning id, status, finished_at;
--
--   select count(*) as active_sessions
--   from public.workout_sessions where user_id = 'DEINE_USER_ID' and status = 'active';   -- muss 0 sein
-- ------------------------------------------------------------
