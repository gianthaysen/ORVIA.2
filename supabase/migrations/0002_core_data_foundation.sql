-- ============================================================
--  ORVIA · 0002 — Core Data Foundation (echte Tabellen + RLS)
--  Verbindliche serverseitige Nutzertrennung.
--  Idempotent & robust: explizite ALTER/ADD-COLUMN-IF-NOT-EXISTS, Constraints
--  per drop+add (überleben Redefinition + teilweise fehlgeschlagene Erstläufe).
--  Im Supabase SQL-Editor ausführen. Löscht keine Nutzerdaten.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
--  0) Pflicht-Backup von app_state VOR der Migration.
--     Liegt im GESCHÜTZTEN Schema `private` (NICHT public): kein anon/authenticated/
--     public-Zugriff. Nur Superuser/Datenbankadmin bzw. service_role mit gesetztem
--     search_path kommen heran — die App liest/schreibt es NIE.
--     Idempotent: bestehendes Backup wird nicht überschrieben; produktive Daten bleiben unverändert.
-- ------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from anon, authenticated, public;
do $$
begin
  if to_regclass('public.app_state') is not null
     and to_regclass('private.app_state_backup') is null then
    execute 'create table private.app_state_backup as table public.app_state';
  end if;
  -- Defensive: falls ein früherer Lauf das Backup versehentlich in public anlegte → sperren.
  if to_regclass('public.app_state_backup') is not null then
    execute 'revoke all on public.app_state_backup from anon';
    execute 'revoke all on public.app_state_backup from authenticated';
    execute 'revoke all on public.app_state_backup from public';
  end if;
end $$;
-- Rechte am Backup hart sperren (nur privilegierte Serverrollen).
do $$
begin
  if to_regclass('private.app_state_backup') is not null then
    execute 'revoke all on private.app_state_backup from anon';
    execute 'revoke all on private.app_state_backup from authenticated';
    execute 'revoke all on private.app_state_backup from public';
  end if;
end $$;

-- ------------------------------------------------------------
--  Migrations-Registry (nachvollziehbarer Versionsstand)
-- ------------------------------------------------------------
create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
--  1) user_profiles
--  birth_date ist primäre Altersgrundlage; Alter wird in der App dynamisch
--  berechnet. age_estimate NUR, wenn birth_date unbekannt ist.
-- ============================================================
create table if not exists public.user_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  name           text,
  birth_date     date,
  age_estimate   int,                     -- nur Fallback ohne birth_date
  sex            text,
  height_cm      numeric,
  weight_kg      numeric,
  hf_max         int,                     -- GEMESSENE HFmax. NULL = unbekannt (keine 190-Annahme)
  resting_hr     int,                     -- gemessener Ruhepuls. NULL = unbekannt
  sleep_goal_h   numeric default 8,
  timezone       text default 'Europe/Berlin',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Forward-Patch (falls ältere Tabelle existiert): age → age_estimate, Spalten ergänzen.
alter table public.user_profiles add column if not exists birth_date date;
alter table public.user_profiles add column if not exists age_estimate int;
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='user_profiles' and column_name='age') then
    execute 'update public.user_profiles set age_estimate = coalesce(age_estimate, age)';
    execute 'alter table public.user_profiles drop column age';
  end if;
end $$;

-- ============================================================
--  2) daily_checkins  (mehrere Check-in-Typen pro Tag)
-- ============================================================
create table if not exists public.daily_checkins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  local_date      date not null,
  checkin_type    text not null default 'morning',
  recorded_at     timestamptz not null default now(),
  sleep_minutes   int,
  sleep_quality   int,
  resting_hr      int,
  hrv_ms          numeric,
  hrv_status      text,
  body_battery    int,
  stress          text,
  feel            int,
  leg_strength    int,
  doms            int,
  illness         boolean,
  complaints      jsonb not null default '[]'::jsonb,
  source          text not null default 'manual',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists daily_checkins_user_date_idx on public.daily_checkins (user_id, local_date desc);

-- ============================================================
--  3) readiness_baselines
-- ============================================================
create table if not exists public.readiness_baselines (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  metric          text not null,
  rolling_median  numeric,
  robust_scale    numeric,
  valid_days      int not null default 0,
  maturity        text not null default 'none',
  window_days     int,
  computed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
--  4) readiness_scores
-- ============================================================
create table if not exists public.readiness_scores (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  local_date        date not null,
  score             int,
  confidence        text,
  safety_status     text,
  load_status       text,
  planned_session   text,
  recommendation    text,
  engine_version    text not null default 'v2',
  created_at        timestamptz not null default now()
);
create index if not exists readiness_scores_user_date_idx on public.readiness_scores (user_id, local_date desc);

-- ============================================================
--  5) readiness_components  (user_id wird per Trigger aus dem Parent erzwungen)
-- ============================================================
create table if not exists public.readiness_components (
  id                  uuid primary key default gen_random_uuid(),
  readiness_score_id  uuid not null references public.readiness_scores(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  component           text not null,
  raw_value           numeric,
  normalized_value    numeric,
  weight              numeric,
  contribution        numeric,
  data_quality        text,
  reason              text,
  created_at          timestamptz not null default now()
);
create index if not exists readiness_components_score_idx on public.readiness_components (readiness_score_id);
create index if not exists readiness_components_user_idx  on public.readiness_components (user_id);

-- Integritäts-Trigger: user_id IMMER aus readiness_scores übernehmen (auch service_role/admin).
create or replace function public.rc_force_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select s.user_id into owner from public.readiness_scores s where s.id = new.readiness_score_id;
  if owner is null then raise exception 'readiness_score % nicht gefunden', new.readiness_score_id; end if;
  new.user_id := owner;                 -- redundante user_id kann nie abweichen
  return new;
end $$;
drop trigger if exists rc_force_owner_trg on public.readiness_components;
create trigger rc_force_owner_trg before insert or update on public.readiness_components
  for each row execute function public.rc_force_owner();

-- ============================================================
--  6) training_load_daily
--  Dedupe: externe Aktivität über external_id; ansonsten über client_session_id
--  (deterministisch vom Client). KEINE (date,sport)-Eindeutigkeit → mehrere
--  Einheiten pro Tag/Sportart möglich (2 Läufe, 2 Gym-Sessions, Verein+Indi …).
-- ============================================================
create table if not exists public.training_load_daily (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  local_date         date not null,
  sport              text not null,
  source             text not null default 'manual',
  client_session_id  text,                 -- stabile Client-ID gegen Dubletten beim Re-Sync
  duration_min       numeric,
  distance_km        numeric,
  intensity          numeric,
  session_rpe        numeric,
  computed_load      numeric,
  external_id        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.training_load_daily add column if not exists client_session_id text;
-- Alten zu strikten Index entfernen, falls ein früherer Lauf ihn erzeugt hat.
drop index if exists public.training_load_manual_uniq;
-- Externe Quelle: nie doppelt.
create unique index if not exists training_load_ext_uniq
  on public.training_load_daily (user_id, source, external_id) where external_id is not null;
-- Client-Sessions: stabil dedupliziert (mehrere pro Tag/Sport erlaubt, da ID unterschiedlich).
create unique index if not exists training_load_client_uniq
  on public.training_load_daily (user_id, client_session_id) where client_session_id is not null;
create index if not exists training_load_user_date_idx on public.training_load_daily (user_id, local_date desc);

-- ============================================================
--  7) user_goals  (idempotent über deterministische client_goal_id)
-- ============================================================
create table if not exists public.user_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  client_goal_id text,                    -- deterministisch (z.B. blob:primary:halfmarathon)
  goal_type      text,
  title          text,
  target_value   numeric,
  target_unit    text,
  target_date    date,
  priority       text not null default 'primary',
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.user_goals add column if not exists client_goal_id text;
create unique index if not exists user_goals_client_uniq
  on public.user_goals (user_id, client_goal_id) where client_goal_id is not null;
create index if not exists user_goals_user_idx on public.user_goals (user_id);

-- ============================================================
--  8) user_sports
-- ============================================================
create table if not exists public.user_sports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  sport         text not null,
  role          text not null default 'main',
  orvia_plans   boolean not null default true,
  external_plan boolean not null default false,
  priority      int not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists user_sports_uniq on public.user_sports (user_id, sport);

-- ============================================================
--  9) weekly_availability
-- ============================================================
create table if not exists public.weekly_availability (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  weekday         int not null,
  available       boolean not null default true,
  preferred       boolean not null default false,
  max_minutes     int,
  preferred_time  text,
  double_allowed  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists weekly_availability_uniq on public.weekly_availability (user_id, weekday);

-- ============================================================
-- 10) fixed_schedule_items  (start_time als echtes TIME)
-- ============================================================
create table if not exists public.fixed_schedule_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  sport           text,
  weekday         int,
  start_time      time,
  duration_min    int,
  type            text not null default 'training',
  intensity       numeric,
  recurring       boolean not null default true,
  blocked         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- start_time sicher von text → time migrieren. Fehlertolerant:
--   * Spalte ist bereits time  → nichts zu tun
--   * Spalte ist text          → nur valide HH:MM[:SS] casten, alles andere → NULL
--   * Spalte fehlt             → ignorieren (Tabelle frisch mit time angelegt)
--   * erneuter Lauf nach Teilabbruch → idempotent (Typprüfung steuert)
-- Ungültige Bestandswerte (z.B. 25:99, 18:78, 'abends') werden NULL und brechen NICHTS ab.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='fixed_schedule_items'
               and column_name='start_time' and data_type='text') then
    execute $cast$
      alter table public.fixed_schedule_items
      alter column start_time type time using (
        case
          when start_time is not null
           and trim(start_time) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
          then trim(start_time)::time
          else null
        end
      )$cast$;
  end if;
end $$;
create index if not exists fixed_schedule_user_idx on public.fixed_schedule_items (user_id);

-- ============================================================
-- 11) orvia_migrations
-- ============================================================
create table if not exists public.orvia_migrations (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  status        text not null default 'not_started',
  migrated_at   timestamptz,
  blob_legacy   boolean not null default false,
  report        jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

-- ============================================================
--  CHECK-Constraints (Wertebereiche, idempotent per drop+add)
-- ============================================================
do $$
begin
  -- daily_checkins
  alter table public.daily_checkins drop constraint if exists dc_ranges;
  alter table public.daily_checkins add constraint dc_ranges check (
    (sleep_minutes is null or sleep_minutes between 0 and 1440) and
    (sleep_quality is null or sleep_quality between 1 and 10) and
    (resting_hr is null or resting_hr between 20 and 140) and
    (hrv_ms is null or hrv_ms > 0) and
    (body_battery is null or body_battery between 0 and 100) and
    (feel is null or feel between 1 and 10) and
    (leg_strength is null or leg_strength between 1 and 10) and
    (doms is null or doms between 0 and 10) and
    (checkin_type in ('morning','live','pre','post','evening')) and
    (stress is null or stress in ('Low','Med','High')) and
    (hrv_status is null or hrv_status in ('Good','Balanced','Low','Unbalanced'))
  );
  -- user_profiles
  alter table public.user_profiles drop constraint if exists up_ranges;
  alter table public.user_profiles add constraint up_ranges check (
    (height_cm is null or height_cm between 80 and 260) and
    (weight_kg is null or weight_kg between 25 and 350) and
    (hf_max is null or hf_max between 120 and 230) and
    (resting_hr is null or resting_hr between 20 and 140) and
    (sleep_goal_h is null or sleep_goal_h between 3 and 14) and
    (age_estimate is null or age_estimate between 5 and 120) and
    (sex is null or sex in ('m','f','d',''))
  );
  -- readiness_scores
  alter table public.readiness_scores drop constraint if exists rs_ranges;
  alter table public.readiness_scores add constraint rs_ranges check (
    (score is null or score between 0 and 100) and
    (confidence is null or confidence in ('low','medium','high')) and
    (safety_status is null or safety_status in ('green','orange','red')) and
    (load_status is null or load_status in ('unknown','low','normal','elevated','high')) and
    (recommendation is null or recommendation in ('perform','slightly_reduce','reduce','replace','rest'))
  );
  -- training_load_daily
  alter table public.training_load_daily drop constraint if exists tl_ranges;
  alter table public.training_load_daily add constraint tl_ranges check (
    (duration_min is null or duration_min >= 0) and
    (distance_km is null or distance_km >= 0) and
    (session_rpe is null or session_rpe between 0 and 10) and
    (computed_load is null or computed_load >= 0)
  );
  -- weekly_availability / fixed_schedule weekday
  alter table public.weekly_availability drop constraint if exists wa_weekday;
  alter table public.weekly_availability add constraint wa_weekday check (weekday between 0 and 6);
  alter table public.fixed_schedule_items drop constraint if exists fs_weekday;
  alter table public.fixed_schedule_items add constraint fs_weekday check (weekday is null or weekday between 0 and 6);
  alter table public.fixed_schedule_items drop constraint if exists fs_type;
  alter table public.fixed_schedule_items add constraint fs_type check (type in ('training','match','competition','course','blocked'));
  -- user_goals / user_sports / readiness_baselines enums
  alter table public.user_goals drop constraint if exists ug_enums;
  alter table public.user_goals add constraint ug_enums check (
    (priority in ('primary','secondary','optional')) and (status in ('active','paused','completed')));
  alter table public.user_sports drop constraint if exists us_role;
  alter table public.user_sports add constraint us_role check (role in ('main','supplemental','occasional','club'));
  alter table public.readiness_baselines drop constraint if exists rb_maturity;
  alter table public.readiness_baselines add constraint rb_maturity check (
    maturity in ('none','provisional','medium','good','established'));
  alter table public.orvia_migrations drop constraint if exists om_status;
  alter table public.orvia_migrations add constraint om_status check (
    status in ('not_started','in_progress','completed','completed_with_warnings','failed'));
end $$;

-- ============================================================
--  updated_at-Trigger
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles','daily_checkins','readiness_baselines','training_load_daily',
    'user_goals','user_sports','weekly_availability','fixed_schedule_items','orvia_migrations']
  loop
    execute format('drop trigger if exists %I_touch on public.%I;', t, t);
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

-- ============================================================
--  GRANTS (explizit) — RLS und Tabellenrechte sind zwei Ebenen.
--  anon: keinerlei Zugriff. authenticated: DML, danach durch RLS auf eigene Zeilen begrenzt.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles','daily_checkins','readiness_baselines','readiness_scores',
    'readiness_components','training_load_daily','user_goals','user_sports',
    'weekly_availability','fixed_schedule_items','orvia_migrations']
  loop
    execute format('revoke all on public.%I from anon;', t);
    execute format('revoke all on public.%I from public;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $$;

-- ============================================================
--  ROW LEVEL SECURITY (SELECT/INSERT/UPDATE-Guard/DELETE auf auth.uid()=user_id)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles','daily_checkins','readiness_baselines','readiness_scores',
    'training_load_daily','user_goals','user_sports','weekly_availability',
    'fixed_schedule_items','orvia_migrations']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('drop policy if exists sel_own on public.%I;', t);
    execute format('drop policy if exists ins_own on public.%I;', t);
    execute format('drop policy if exists upd_own on public.%I;', t);
    execute format('drop policy if exists del_own on public.%I;', t);
    execute format('create policy sel_own on public.%I for select to authenticated using (auth.uid() = user_id);', t);
    execute format('create policy ins_own on public.%I for insert to authenticated with check (auth.uid() = user_id);', t);
    execute format('create policy upd_own on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy del_own on public.%I for delete to authenticated using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- readiness_components: direkte user_id-RLS + Parent-Konsistenz (Score gehört dem Nutzer).
alter table public.readiness_components enable row level security;
alter table public.readiness_components force row level security;
drop policy if exists sel_own on public.readiness_components;
drop policy if exists ins_own on public.readiness_components;
drop policy if exists upd_own on public.readiness_components;
drop policy if exists del_own on public.readiness_components;
create policy sel_own on public.readiness_components for select to authenticated
  using (auth.uid() = user_id);
create policy ins_own on public.readiness_components for insert to authenticated
  with check (exists (select 1 from public.readiness_scores s
                       where s.id = readiness_score_id and s.user_id = auth.uid()));
create policy upd_own on public.readiness_components for update to authenticated
  using (auth.uid() = user_id)
  with check (exists (select 1 from public.readiness_scores s
                       where s.id = readiness_score_id and s.user_id = auth.uid()));
create policy del_own on public.readiness_components for delete to authenticated
  using (auth.uid() = user_id);

insert into public.schema_migrations(version) values ('0002_core_data_foundation')
  on conflict (version) do nothing;

-- ============================================================
--  Löschregeln (bewusst): user_id→auth.users CASCADE nur bei Konto-Löschung.
--  readiness_components→readiness_scores CASCADE (Score-Bestandteil).
--  Keine Cascades zwischen unabhängigen Verlaufstabellen.
--  Künftige Schemaänderungen: eigene nummerierte Migration mit gezielten ALTERs.
-- ============================================================
