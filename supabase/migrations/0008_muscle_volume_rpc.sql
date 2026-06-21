-- ============================================================
--  ORVIA · 0008 — Muskelvolumen-RPC (Phase 4.3)
--  EINE auth-gesicherte Abfrage statt N+1. Aggregiert effektive Sätze je KÖRPERKARTEN-GRUPPE
--  (feine muscle_keys werden in SQL kanonisch zusammengefasst → korrekte count(distinct session)).
--  Nur status='completed', abgeschlossene Arbeitssätze, KEINE Warm-up-Sätze. security invoker → RLS.
--  Zeitraum validiert (nicht null, from<=to, max. 366 Tage).
-- ============================================================

create or replace function public.orvia_muscle_volume(p_from date, p_to date)
returns table(
  muscle_group text,
  direct_sets numeric,
  indirect_sets numeric,
  effective_sets numeric,
  workout_count bigint,
  last_trained_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_from is null or p_to is null then raise exception 'invalid_range: from/to required'; end if;
  if p_from > p_to then raise exception 'invalid_range: from after to'; end if;
  if (p_to - p_from) > 366 then raise exception 'range_too_large'; end if;

  return query
  with base as (
    select
      ws.id as session_id,
      ws.finished_at,
      em.involvement,
      em.weight,
      case em.muscle_key
        when 'chest' then 'chest'
        when 'front_delts' then 'shoulders' when 'side_delts' then 'shoulders' when 'rear_delts' then 'shoulders'
        when 'biceps' then 'biceps' when 'triceps' then 'triceps'
        when 'abs' then 'core' when 'lower_back' then 'core'
        when 'lats' then 'back' when 'upper_back' then 'back' when 'traps' then 'back'
        when 'quads' then 'quads' when 'hamstrings' then 'hamstrings'
        when 'glutes' then 'glutes' when 'calves' then 'calves'
        else 'other'
      end as grp
    from public.workout_sets st
    join public.workout_exercises we on we.id = st.workout_exercise_id and we.user_id = auth.uid()
    join public.workout_sessions ws on ws.id = we.workout_session_id and ws.user_id = auth.uid()
    join public.exercise_muscles em on em.exercise_id = we.exercise_id
    where st.user_id = auth.uid()
      and st.completed = true
      and coalesce(st.set_type, 'working') <> 'warmup'
      and ws.status = 'completed'
      and ws.local_date >= p_from
      and ws.local_date <= p_to
  )
  select
    b.grp as muscle_group,
    count(*) filter (where b.involvement = 'direct')::numeric   as direct_sets,
    count(*) filter (where b.involvement = 'indirect')::numeric as indirect_sets,
    coalesce(sum(b.weight), 0)::numeric                         as effective_sets,
    count(distinct b.session_id)                                as workout_count,
    max(b.finished_at)                                          as last_trained_at
  from base b
  group by b.grp;
end;
$$;

revoke all on function public.orvia_muscle_volume(date, date) from public;
grant execute on function public.orvia_muscle_volume(date, date) to authenticated;

insert into public.schema_migrations(version) values ('0008_muscle_volume_rpc') on conflict (version) do nothing;
