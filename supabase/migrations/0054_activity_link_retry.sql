-- ============================================================
-- 0054 · Kraft-Kopplung: zweiter Versuch + Nutzerentscheidung bleibt bestehen
-- ------------------------------------------------------------
-- STATUS PRODUKTION: NOCH NICHT ANGEWENDET. Reihenfolge:
--   1. diese Datei im SQL-Editor ausführen (idempotent, eine Transaktion,
--      endet mit einer Selbstprüfung),
--   2. danach App (v8-462) und Garmin-Worker ausliefern.
-- Ohne 0054 laufen App und Worker unverändert weiter (Aufrufe schlagen still
-- fehl und werden ignoriert) — es gibt keine Abhängigkeit in die Gegenrichtung.
--
-- BEFUND (05.11.2026): Gekoppelt wurde nur EINMAL — beim Import der
-- Uhr-Aufzeichnung durch den Worker. War das ORVIA-Workout in diesem Moment
-- noch nicht in der Cloud (später abgeschlossen, offline, Sync dazwischen),
-- blieben beide Einheiten dauerhaft getrennt und zählten doppelt.
-- orvia_autolink_recordings (0048) existiert, wird aber nirgends aufgerufen —
-- und würde eine vom Nutzer gelöste Kopplung wieder herstellen.
--
-- ÄNDERUNG
--   activities.link_opt_out   true = Nutzer hat die Kopplung gelöst → nie
--                             automatisch neu koppeln (gilt für App UND Worker).
--   orvia_unlink_activity     setzt link_opt_out = true.
--   orvia_link_activities     (ausdrücklich) setzt link_opt_out = false.
--   orvia_link_candidate      überspringt Aufzeichnungen mit link_opt_out.
--   orvia_autolink_recent     NEU: koppelt freie Kraft-Aufzeichnungen der
--                             letzten p_hours (Standard 48 h); ruft die App nach
--                             jedem Workout-Abschluss auf.
--   orvia_autolink_recordings respektiert link_opt_out.
-- Regel unverändert (0048): gleiche Sportart, Zeitfenster überlappen,
-- |Δ Start| ≤ 20 min, nächster Kandidat gewinnt, je Workout eine Aufzeichnung.
-- Alle Funktionen security invoker (RLS + auth.uid()); nur authenticated.
-- ============================================================
begin;

alter table public.activities
  add column if not exists link_opt_out boolean not null default false;

create or replace function public.orvia_link_candidate(p_recording uuid, p_tolerance_min integer default 20)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  with r as (
    select * from public.activities
    where id = p_recording and user_id = auth.uid()
      and source in ('garmin','strava','import')
      and not link_opt_out
  )
  select w.id
  from public.activities w, r
  where w.user_id = r.user_id
    and w.source = 'orvia_workout'
    and w.sport_id = r.sport_id
    and w.id <> r.id
    and w.linked_activity_id is null
    and w.started_at is not null and r.started_at is not null
    and abs(extract(epoch from (w.started_at - r.started_at))) <= p_tolerance_min * 60
    and tstzrange(w.started_at, coalesce(w.ended_at, w.started_at + make_interval(secs => coalesce(w.duration_seconds, 0))), '[]')
     && tstzrange(r.started_at, coalesce(r.ended_at, r.started_at + make_interval(secs => coalesce(r.duration_seconds, 0))), '[]')
    and not exists (select 1 from public.activities o
                    where o.user_id = w.user_id and o.linked_activity_id = w.id and o.id <> r.id)
  order by abs(extract(epoch from (w.started_at - r.started_at))) asc, w.created_at asc
  limit 1
$$;

create or replace function public.orvia_link_activities(p_primary uuid, p_recording uuid)
returns public.activities
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_p public.activities;
  v_r public.activities;
begin
  if p_primary = p_recording then raise exception 'link_self'; end if;
  select * into v_p from public.activities where id = p_primary   and user_id = auth.uid() for update;
  if not found then raise exception 'primary_not_found'; end if;
  select * into v_r from public.activities where id = p_recording and user_id = auth.uid() for update;
  if not found then raise exception 'recording_not_found'; end if;
  if v_p.source <> 'orvia_workout' then raise exception 'primary_not_workout'; end if;
  if v_r.source not in ('garmin','strava','import') then raise exception 'recording_source_invalid'; end if;
  if v_p.linked_activity_id is not null then raise exception 'primary_is_linked'; end if;
  if v_r.linked_activity_id is not null and v_r.linked_activity_id <> v_p.id then raise exception 'recording_already_linked'; end if;
  if exists (select 1 from public.activities o where o.user_id = v_p.user_id and o.linked_activity_id = v_p.id and o.id <> v_r.id) then
    raise exception 'primary_has_recording';
  end if;
  update public.activities
     set linked_activity_id = v_p.id, link_kind = 'device_recording', link_opt_out = false, updated_at = now()
   where id = v_r.id and user_id = auth.uid()
   returning * into v_r;
  return v_r;
end $$;

create or replace function public.orvia_unlink_activity(p_recording uuid)
returns public.activities
language plpgsql
security invoker
set search_path = public
as $$
declare v_r public.activities;
begin
  update public.activities
     set linked_activity_id = null, link_kind = null, link_opt_out = true, updated_at = now()
   where id = p_recording and user_id = auth.uid()
   returning * into v_r;
  if not found then raise exception 'recording_not_found'; end if;
  return v_r;
end $$;

-- Gemeinsamer Kern: freie Kraft-Aufzeichnungen ab p_since koppeln.
create or replace function public.orvia_autolink_since(p_since timestamptz, p_tolerance_min integer default 20)
returns table (recording_id uuid, primary_id uuid, delta_min numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record; v_cand uuid;
begin
  for r in
    select a.id, a.started_at from public.activities a
    where a.user_id = auth.uid() and a.source in ('garmin','strava','import')
      and a.sport_id = 'gym' and a.linked_activity_id is null and not a.link_opt_out
      and (p_since is null or a.started_at >= p_since)
    order by a.started_at
  loop
    v_cand := public.orvia_link_candidate(r.id, p_tolerance_min);
    if v_cand is not null then
      perform public.orvia_link_activities(v_cand, r.id);
      recording_id := r.id; primary_id := v_cand;
      select round(extract(epoch from (r.started_at - w.started_at)) / 60, 1) into delta_min
        from public.activities w where w.id = v_cand;
      return next;
    end if;
  end loop;
  return;
end $$;

create or replace function public.orvia_autolink_recent(p_hours integer default 48, p_tolerance_min integer default 20)
returns table (recording_id uuid, primary_id uuid, delta_min numeric)
language sql
security invoker
set search_path = public
as $$
  select * from public.orvia_autolink_since(now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 48), 24 * 14))), p_tolerance_min)
$$;

create or replace function public.orvia_autolink_recordings(p_tolerance_min integer default 20)
returns table (recording_id uuid, primary_id uuid, delta_min numeric)
language sql
security invoker
set search_path = public
as $$
  select * from public.orvia_autolink_since(null, p_tolerance_min)
$$;

revoke all on function public.orvia_link_candidate(uuid, integer) from public, anon;
revoke all on function public.orvia_link_activities(uuid, uuid) from public, anon;
revoke all on function public.orvia_unlink_activity(uuid) from public, anon;
revoke all on function public.orvia_autolink_since(timestamptz, integer) from public, anon;
revoke all on function public.orvia_autolink_recent(integer, integer) from public, anon;
revoke all on function public.orvia_autolink_recordings(integer) from public, anon;
grant execute on function public.orvia_link_candidate(uuid, integer) to authenticated, service_role;
grant execute on function public.orvia_link_activities(uuid, uuid) to authenticated, service_role;
grant execute on function public.orvia_unlink_activity(uuid) to authenticated, service_role;
grant execute on function public.orvia_autolink_since(timestamptz, integer) to authenticated, service_role;
grant execute on function public.orvia_autolink_recent(integer, integer) to authenticated, service_role;
grant execute on function public.orvia_autolink_recordings(integer) to authenticated, service_role;

-- Selbstprüfung: bricht die Transaktion ab, wenn etwas nicht stimmt.
do $$
declare n int;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activities' and column_name = 'link_opt_out') then
    raise exception '0054: Spalte link_opt_out fehlt';
  end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname in ('orvia_link_candidate','orvia_link_activities','orvia_unlink_activity','orvia_autolink_since','orvia_autolink_recent','orvia_autolink_recordings')
     and not p.prosecdef;
  if n <> 6 then raise exception '0054: erwartet 6 security-invoker-Funktionen, gefunden %', n; end if;
  if exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
              where s.nspname = 'public' and p.proname in ('orvia_autolink_since','orvia_autolink_recent','orvia_unlink_activity','orvia_link_activities')
                and has_function_privilege('anon', p.oid, 'execute')) then
    raise exception '0054: anon darf eine Kopplungsfunktion ausführen';
  end if;
end $$;

insert into public.schema_migrations(version) values ('0054_activity_link_retry') on conflict (version) do nothing;

commit;
