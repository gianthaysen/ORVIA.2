-- ============================================================
-- 0048 · Geräteaufzeichnung an ORVIA-Workout koppeln (S2c)
-- ------------------------------------------------------------
-- Befund: Eine Krafteinheit mit laufender Uhr liegt zweimal in activities
-- (orvia_workout mit Sätzen + garmin mit HF). Beide gelten als eigenständige
-- Einheiten → Wochenlast/ACWR und Einheitenzähler doppelt.
-- Lösung: Die Aufzeichnung wird an die Workout-Aktivität GEKOPPELT
-- (linked_activity_id + link_kind). Der Datensatz bleibt vollständig erhalten,
-- ist nur nicht mehr eigenständig. Löschen des Primärdatensatzes löst die
-- Kopplung automatisch (on delete set null) — nichts geht verloren.
-- Idempotent. RPCs security invoker (RLS + auth.uid()).
-- ============================================================

alter table public.activities
  add column if not exists linked_activity_id uuid references public.activities(id) on delete set null;
alter table public.activities
  add column if not exists link_kind text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activities_link_kind_chk') then
    alter table public.activities add constraint activities_link_kind_chk
      check (link_kind is null or link_kind in ('device_recording'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_link_pair_chk') then
    alter table public.activities add constraint activities_link_pair_chk
      check ((linked_activity_id is null) = (link_kind is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_link_self_chk') then
    alter table public.activities add constraint activities_link_self_chk
      check (linked_activity_id is null or linked_activity_id <> id);
  end if;
end $$;

-- Konsistenz auch bei FK-Aktion (on delete set null setzt NUR linked_activity_id):
-- BEFORE-Trigger räumt link_kind mit ab bzw. ergänzt es. Referenzielle Aktionen
-- feuern Zeilentrigger der referenzierenden Tabelle → Check bleibt erfüllt.
create or replace function public.orvia_activities_link_normalize()
returns trigger language plpgsql as $$
begin
  if new.linked_activity_id is null then
    new.link_kind := null;
  elsif new.link_kind is null then
    new.link_kind := 'device_recording';
  end if;
  return new;
end $$;
drop trigger if exists activities_link_normalize on public.activities;
create trigger activities_link_normalize
  before insert or update of linked_activity_id, link_kind on public.activities
  for each row execute function public.orvia_activities_link_normalize();

create index if not exists activities_linked_idx
  on public.activities (user_id, linked_activity_id) where linked_activity_id is not null;

-- ------------------------------------------------------------
-- Kandidat für eine Aufzeichnung: eigene orvia_workout-Aktivität, gleiche
-- Sportart, Zeitfenster überlappen, |Δ Start| ≤ p_tolerance_min, nicht selbst
-- gekoppelt und noch keine andere Aufzeichnung gekoppelt. Nächster gewinnt.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Koppeln (explizit oder aus dem Client). Kontrollierte Abbrüche statt
-- stiller Fehlzustände.
-- ------------------------------------------------------------
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
     set linked_activity_id = v_p.id, link_kind = 'device_recording', updated_at = now()
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
     set linked_activity_id = null, link_kind = null, updated_at = now()
   where id = p_recording and user_id = auth.uid()
   returning * into v_r;
  if not found then raise exception 'recording_not_found'; end if;
  return v_r;
end $$;

-- ------------------------------------------------------------
-- Bestand koppeln (Backfill, nur eigene Daten, nur gym). Liefert je
-- gekoppeltem Paar eine Zeile; zweiter Lauf = 0 Zeilen.
-- ------------------------------------------------------------
create or replace function public.orvia_autolink_recordings(p_tolerance_min integer default 20)
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
      and a.sport_id = 'gym' and a.linked_activity_id is null
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

revoke all on function public.orvia_link_candidate(uuid, integer) from public, anon;
revoke all on function public.orvia_link_activities(uuid, uuid) from public, anon;
revoke all on function public.orvia_unlink_activity(uuid) from public, anon;
revoke all on function public.orvia_autolink_recordings(integer) from public, anon;
grant execute on function public.orvia_link_candidate(uuid, integer) to authenticated;
grant execute on function public.orvia_link_activities(uuid, uuid) to authenticated;
grant execute on function public.orvia_unlink_activity(uuid) to authenticated;
grant execute on function public.orvia_autolink_recordings(integer) to authenticated;

insert into public.schema_migrations(version) values ('0048_activity_link') on conflict (version) do nothing;
