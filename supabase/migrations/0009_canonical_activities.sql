-- ============================================================
--  ORVIA · 0009 — Kanonische Aktivitäten (Inkrement 2B)
--  EINE universelle Aktivitäts-Wahrheit für Verlauf/Kalender/Statistik/Belastung.
--  Workout-Details bleiben in workout_sessions/_exercises/_sets; die Aktivität verweist
--  über workout_session_id + (source, source_record_id) darauf.
--  Sicherheit: RLS owner-only; RPC security invoker → auth.uid() ist die EINZIGE Nutzeridentität,
--  client-gelieferte user_id wird nie vertraut. search_path fix = public.
--  Idempotenz: kontrollierter Merge in der RPC (kein Verlass auf konkurrierende ON-CONFLICT-Ziele).
--  updated_at: wiederverwendete projektweite Triggerfunktion public.touch_updated_at() (0002/0003).
--  Atomar: ein begin/commit-Block. Re-runnable (if not exists / create or replace / Guards).
-- ============================================================
begin;

-- ---- Tabelle (sport_id NOT NULL default 'other'; started_at bewusst NULLBAR für Legacy/Backfill) ----
create table if not exists public.activities (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  client_record_id   text,
  sport_id           text not null default 'other',
  source             text not null default 'manual',
  source_record_id   text,
  workout_session_id uuid references public.workout_sessions(id) on delete set null,
  started_at         timestamptz,
  ended_at           timestamptz,
  duration_seconds   integer,
  status             text not null default 'completed',
  summary            jsonb not null default '{}'::jsonb,
  metrics            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint activities_duration_nonneg check (duration_seconds is null or duration_seconds >= 0),
  constraint activities_source_chk check (source in ('orvia_workout','manual','import','legacy_local')),
  constraint activities_status_chk check (status in ('completed','aborted','cancelled','planned'))
);

-- ---- Constraints / Idempotenz -------------------------------
-- Pro Nutzer genau EINE Aktivität je Quelle+Quell-ID.
create unique index if not exists activities_source_uniq
  on public.activities (user_id, source, source_record_id)
  where source_record_id is not null;
-- Stabiler Client-Record-Schlüssel (Outbox-Round-Trip ohne Dublette).
create unique index if not exists activities_client_uniq
  on public.activities (user_id, client_record_id)
  where client_record_id is not null;
-- Pro Nutzer höchstens EINE kanonische Activity je Workout-Session (genau eine Activity pro Workout).
create unique index if not exists activities_workout_uniq
  on public.activities (user_id, workout_session_id)
  where workout_session_id is not null;
-- Lese-/Sortier-Index.
create index if not exists activities_user_started_idx on public.activities (user_id, started_at desc);

-- ---- updated_at-Trigger: projektweite Funktion wiederverwenden (NICHT neu anlegen) ----
drop trigger if exists activities_touch on public.activities;
create trigger activities_touch before update on public.activities
  for each row execute function public.touch_updated_at();

-- ---- RLS + Owner-only-Policies ------------------------------
alter table public.activities enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='activities_sel_own') then
    create policy activities_sel_own on public.activities for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='activities_ins_own') then
    create policy activities_ins_own on public.activities for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='activities_upd_own') then
    create policy activities_upd_own on public.activities for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='activities_del_own') then
    create policy activities_del_own on public.activities for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- ---- Tabellen-Grants: nur authenticated, KEIN anon ----------
revoke all on table public.activities from public;
revoke all on table public.activities from anon;
grant select, insert, update, delete on table public.activities to authenticated;

-- ---- Zentrale, kanonische Sport-Normalisierung (rein, immutable) ----
-- Unbekannt → 'other' (NIE 'athletics'). Rohwert wird in der RPC in metrics bewahrt.
create or replace function public.orvia_norm_sport(p_raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_raw, '')))
    when 'gym' then 'gym' when 'krafttraining' then 'gym' when 'kraft' then 'gym'
      when 'strength' then 'gym' when 'strength training' then 'gym'
    -- Mobility ist EIGENE kanonische Sportart (NICHT gym): nie in Gym-Statistik/Muskelvolumen.
    when 'mobilität' then 'mobility' when 'mobilitaet' then 'mobility'
      when 'mobility' then 'mobility' when 'mobility training' then 'mobility'
    when 'running' then 'running' when 'laufen' then 'running' when 'lauf' then 'running' when 'run' then 'running'
    when 'cycling' then 'cycling' when 'rad' then 'cycling' when 'radfahren' then 'cycling'
      when 'radsport' then 'cycling' when 'bike' then 'cycling'
    when 'swimming' then 'swimming' when 'schwimmen' then 'swimming' when 'swim' then 'swimming'
    when 'padel' then 'padel' when 'paddel' then 'padel'
    when 'football' then 'football' when 'fußball' then 'football' when 'fussball' then 'football' when 'soccer' then 'football'
    when 'basketball' then 'basketball' when 'korbball' then 'basketball'
    when 'handball' then 'handball'
    when 'rowing' then 'rowing' when 'rudern' then 'rowing'
    when 'hiking' then 'hiking' when 'wandern' then 'hiking'
    when 'walking' then 'walking' when 'gehen' then 'walking' when 'spazieren' then 'walking'
    when 'athletics' then 'athletics' when 'leichtathletik' then 'athletics' when 'athletik' then 'athletics'
    when 'triathlon' then 'triathlon'
    when 'tennis' then 'tennis'
    when 'other' then 'other' when 'andere' then 'other' when 'sonstige' then 'other' when 'sonstiges' then 'other'
    else 'other'
  end;
$$;
revoke all on function public.orvia_norm_sport(text) from public;
revoke all on function public.orvia_norm_sport(text) from anon;
grant execute on function public.orvia_norm_sport(text) to authenticated;

-- ---- RPC: idempotenter, kontrollierter Activity-Upsert aus abgeschlossener Session ----
-- security invoker (kein definer): RLS + auth.uid() greifen; keine Rechteausweitung.
create or replace function public.orvia_upsert_activity_from_session(
  p_session_id uuid,
  p_summary jsonb default '{}'::jsonb,
  p_metrics jsonb default '{}'::jsonb,
  p_client_record_id text default null
)
returns public.activities
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sess  public.workout_sessions;
  v_by_client public.activities;
  v_by_source public.activities;
  v_by_workout public.activities;
  v_target public.activities;
  v_target_id uuid;
  v_seconds integer;
  v_sport text;
  v_raw   text;
  v_metrics jsonb;
begin
  -- Nur EIGENE Session (RLS + explizite Bedingung). Fremde Session ist nicht verknüpfbar.
  -- FOR UPDATE serialisiert parallele Doppelklick-/Retry-Aufrufe auf dieselbe Session:
  -- der zweite Aufruf wartet bis Commit des ersten, sieht dann die bereits angelegte Activity.
  select * into v_sess
  from public.workout_sessions
  where id = p_session_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'workout_session_not_found';
  end if;

  -- Nur ABGESCHLOSSENE Sessions werden zu Aktivitäten.
  if v_sess.status <> 'completed' then
    raise exception 'session_not_completed';
  end if;

  -- Kanonische Sekunden: bevorzugt aus started/finished (abzgl. Pause), sonst duration_min*60.
  v_seconds := case
    when v_sess.finished_at is not null and v_sess.started_at is not null
      then greatest(0, round(extract(epoch from (v_sess.finished_at - v_sess.started_at))
            - coalesce(v_sess.total_paused_seconds, 0)))::integer
    when v_sess.duration_min is not null then (v_sess.duration_min * 60)::integer
    else null
  end;

  -- Kanonische Sportart; unbekannten Rohwert kontrolliert als 'other' speichern + Rohwert in metrics bewahren.
  v_raw := coalesce(v_sess.sport_key, v_sess.sport);
  v_sport := public.orvia_norm_sport(v_raw);
  v_metrics := coalesce(p_metrics, '{}'::jsonb);
  if v_sport = 'other' and lower(trim(coalesce(v_raw, ''))) not in ('other','andere','sonstige','sonstiges','') then
    v_metrics := v_metrics || jsonb_build_object('source_sport_raw', v_raw);
  end if;

  -- DREI Identitäten NUR im eigenen Datenbestand suchen: client_record_id, source+source_record_id,
  -- und workout_session_id (dritte Identität). Kein Verlass auf Unique-Constraint als Konfliktsteuerung.
  if p_client_record_id is not null then
    select * into v_by_client from public.activities
     where user_id = auth.uid() and client_record_id = p_client_record_id;
  end if;
  select * into v_by_source from public.activities
   where user_id = auth.uid() and source = 'orvia_workout' and source_record_id = v_sess.id::text;
  select * into v_by_workout from public.activities
   where user_id = auth.uid() and workout_session_id = v_sess.id;

  -- Alle vorhandenen Treffer müssen auf DIESELBE Activity zeigen, sonst kontrollierter Abbruch.
  v_target_id := coalesce(v_by_source.id, v_by_client.id, v_by_workout.id);
  if v_target_id is not null then
    if (v_by_client.id  is not null and v_by_client.id  <> v_target_id)
    or (v_by_source.id  is not null and v_by_source.id  <> v_target_id)
    or (v_by_workout.id is not null and v_by_workout.id <> v_target_id) then
      raise exception 'activity_identity_conflict';
    end if;
    select * into v_target from public.activities where id = v_target_id and user_id = auth.uid();
  end if;

  -- Identitätsschutz: bestehende Activity ist bereits an eine ANDERE client_record_id gebunden →
  -- kontrollierter Abbruch, NIE stilles Überschreiben (sonst markierte das Frontend Client B
  -- fälschlich als synchronisiert). null + neue ID = ergänzen; gleiche ID = ok; ohne ID = unverändert.
  if v_target.id is not null
     and p_client_record_id is not null
     and v_target.client_record_id is not null
     and v_target.client_record_id <> p_client_record_id then
    raise exception 'activity_identity_conflict';
  end if;

  if v_target.id is not null then
    -- Vorhandenen Datensatz kontrolliert vervollständigen (Merge), keine zweite Activity.
    update public.activities set
      client_record_id   = coalesce(client_record_id, p_client_record_id),
      sport_id           = v_sport,
      source             = 'orvia_workout',
      source_record_id   = v_sess.id::text,
      workout_session_id = v_sess.id,
      started_at         = v_sess.started_at,
      ended_at           = v_sess.finished_at,
      duration_seconds   = v_seconds,
      status             = 'completed',
      summary            = coalesce(nullif(p_summary, '{}'::jsonb), summary),
      metrics            = coalesce(nullif(v_metrics, '{}'::jsonb), metrics),
      updated_at         = now()
    where id = v_target.id and user_id = auth.uid()
    returning * into v_target;
    return v_target;
  end if;

  -- Keine Identität vorhanden → neu anlegen.
  insert into public.activities
    (user_id, client_record_id, sport_id, source, source_record_id, workout_session_id,
     started_at, ended_at, duration_seconds, status, summary, metrics)
  values
    (auth.uid(), p_client_record_id, v_sport, 'orvia_workout',
     v_sess.id::text, v_sess.id,
     v_sess.started_at, v_sess.finished_at, v_seconds, 'completed',
     coalesce(p_summary, '{}'::jsonb), v_metrics)
  returning * into v_target;
  return v_target;
end $$;

-- RPC-Grants: nur authenticated, KEIN anon/public.
revoke all on function public.orvia_upsert_activity_from_session(uuid, jsonb, jsonb, text) from public;
revoke all on function public.orvia_upsert_activity_from_session(uuid, jsonb, jsonb, text) from anon;
grant execute on function public.orvia_upsert_activity_from_session(uuid, jsonb, jsonb, text) to authenticated;

commit;
