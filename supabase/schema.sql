-- ============================================================
--  ORVIA · Supabase Schema  (Phase 1 Fundament)
--  Einmalig im Supabase SQL-Editor ausführen (Dashboard → SQL → New query).
--  Enthält: Datenmodell, Row-Level-Security, Invite-Code-Gate, Sync-Tabelle.
--  Sicher mehrfach ausführbar (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================

create extension if not exists pgcrypto;   -- für gen_random_uuid() + digest()

-- ============================================================
--  1) SYNC-TABELLE  (aktiver Cloud-Sync in Phase 1)
--  Verlustfreier JSONB-Snapshot des App-Status pro Nutzer.
--  (Die normalisierten Tabellen unten sind für Strava/Garmin/Aktivitäten
--   in späteren Runden vorbereitet.)
-- ============================================================
create table if not exists public.app_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  device_id   text,
  updated_at  timestamptz not null default now()
);

-- ============================================================
--  2) INVITE-CODE GATE
-- ============================================================
create table if not exists public.invite_codes (
  id          uuid primary key default gen_random_uuid(),
  code_hash   text not null unique,          -- sha256(code), nie Klartext
  label       text,
  status      text not null default 'active',-- active | disabled
  max_uses    int  not null default 1,
  used_count  int  not null default 0,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.invite_redemptions (
  id              uuid primary key default gen_random_uuid(),
  invite_code_id  uuid not null references public.invite_codes(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  redeemed_at     timestamptz not null default now(),
  unique (user_id)
);

-- ============================================================
--  3) NUTZERBEZOGENE TABELLEN  (relationales Datenmodell)
--  Alle mit user_id + RLS. In Phase 1 bereitgestellt, schrittweise befüllt.
-- ============================================================
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  name               text,
  age                int,
  height_cm          int,
  weight_kg          numeric,
  location           text,
  training_style     text,
  coaching_intensity text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text,
  title        text,
  target_date  date,
  target_value text,
  status       text default 'active',
  priority     int  default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  source           text not null default 'manual',   -- manual | strava | garmin | csv
  external_id      text,                              -- gegen Duplikate
  type             text,
  start_time       timestamptz,
  date             date,
  duration_seconds int,
  distance_meters  numeric,
  elevation_gain   numeric,
  average_pace     numeric,
  average_speed    numeric,
  average_hr       int,
  max_hr           int,
  rpe              int,
  training_load    numeric,
  notes            text,
  has_route        boolean default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table if not exists public.activity_routes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  activity_id  uuid not null references public.activities(id) on delete cascade,
  polyline     text,
  route_points jsonb,
  map_provider text,
  created_at   timestamptz not null default now()
);

create table if not exists public.checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           date not null,
  type           text not null,  -- morning | live | pre_training | post_training | evening
  sleep_duration numeric,
  sleep_quality  int,
  hrv            numeric,
  resting_hr     int,
  body_battery   int,
  energy         int,
  stress         int,
  mood           int,
  hunger         int,
  weight         numeric,
  notes          text,
  created_at     timestamptz not null default now()
);

create table if not exists public.live_updates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            date not null,
  energy          int, stress int, mood int, hunger int,
  caffeine        int, water int, steps int,
  training_status text,
  created_at      timestamptz not null default now()
);

create table if not exists public.issue_modules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null,
  status          text default 'watch',  -- none|watch|active|stable|prevention|warning
  pain_score      int,
  active_since    date,
  stable_since    date,
  last_reported_at timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, type)
);

create table if not exists public.issue_logs (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  issue_module_id        uuid references public.issue_modules(id) on delete cascade,
  date                   date not null,
  pain_score             int,
  trigger                text,
  warmup_reaction        text,
  post_training_reaction text,
  notes                  text,
  created_at             timestamptz not null default now()
);

create table if not exists public.routines (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade, -- null = globale Vorlage
  issue_type       text,
  goal_type        text,
  title            text,
  duration_minutes int,
  difficulty       text,
  equipment        text,
  description      text,
  created_at       timestamptz not null default now()
);

create table if not exists public.routine_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  routine_id  uuid references public.routines(id) on delete set null,
  date        date not null,
  completed   boolean default true,
  rpe         int,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.readiness_scores (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  score            int,
  status           text,
  confidence       text,
  positive_factors jsonb,
  negative_factors jsonb,
  recommendation   text,
  created_at       timestamptz not null default now()
);

create table if not exists public.tips (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           date,
  title          text,
  reason         text,
  recommendation text,
  confidence     text,
  category       text,
  created_at     timestamptz not null default now()
);

create table if not exists public.trends (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  metric         text,
  period         text,
  current_value  numeric,
  baseline_value numeric,
  delta_absolute numeric,
  delta_percent  numeric,
  status         text,
  interpretation text,
  created_at     timestamptz not null default now()
);

create table if not exists public.data_sources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  source       text not null,
  status       text default 'prepared', -- prepared | connected | error | disconnected
  connected_at timestamptz,
  last_sync_at timestamptz,
  token_status text,
  missing_data jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, source)
);

create table if not exists public.imports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  source         text,
  imported_count int default 0,
  skipped_count  int default 0,
  error_count    int default 0,
  last_import_at timestamptz,
  summary        text,
  created_at     timestamptz not null default now()
);

create table if not exists public.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  granted      boolean default false,
  granted_at   timestamptz,
  revoked_at   timestamptz,
  version      text,
  unique (user_id, consent_type)
);

create table if not exists public.legal_acceptance (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  version       text,
  accepted_at   timestamptz not null default now()
);

-- Strava/Garmin OAuth-Tokens: NUR serverseitig, nie im Frontend lesbar.
-- Kein RLS-Read für Nutzer (nur service_role / Edge Function).
create table if not exists public.oauth_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null,                 -- strava | garmin
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

-- ============================================================
--  4) ROW LEVEL SECURITY
-- ============================================================
alter table public.app_state        enable row level security;
alter table public.profiles         enable row level security;
alter table public.goals            enable row level security;
alter table public.activities       enable row level security;
alter table public.activity_routes  enable row level security;
alter table public.checkins         enable row level security;
alter table public.live_updates     enable row level security;
alter table public.issue_modules    enable row level security;
alter table public.issue_logs       enable row level security;
alter table public.routines         enable row level security;
alter table public.routine_logs     enable row level security;
alter table public.readiness_scores enable row level security;
alter table public.tips             enable row level security;
alter table public.trends           enable row level security;
alter table public.data_sources     enable row level security;
alter table public.imports          enable row level security;
alter table public.consents         enable row level security;
alter table public.legal_acceptance enable row level security;
alter table public.invite_codes     enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.oauth_tokens     enable row level security;

-- Generische "nur eigene Zeilen"-Policy für alle user_id-Tabellen.
do $$
declare t text;
begin
  foreach t in array array[
    'app_state','profiles','goals','activities','activity_routes','checkins',
    'live_updates','issue_modules','issue_logs','routine_logs','readiness_scores',
    'tips','trends','data_sources','imports','consents','legal_acceptance']
  loop
    execute format('drop policy if exists own_rows on public.%I;', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated
         using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

-- Routinen: eigene + globale Vorlagen lesbar; schreibbar nur eigene.
drop policy if exists routines_read on public.routines;
create policy routines_read on public.routines for select to authenticated
  using (user_id is null or auth.uid() = user_id);
drop policy if exists routines_write on public.routines;
create policy routines_write on public.routines for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- invite_redemptions: Nutzer darf nur eigene Einlösung sehen (Schreiben via RPC).
drop policy if exists redemptions_read on public.invite_redemptions;
create policy redemptions_read on public.invite_redemptions for select to authenticated
  using (auth.uid() = user_id);

-- invite_codes + oauth_tokens: KEINE Policy für normale Nutzer →
-- weder lesbar noch schreibbar im Frontend. Zugriff nur via RPC / service_role.

-- ============================================================
--  5) INVITE-RPCs  (SECURITY DEFINER = umgeht RLS kontrolliert)
-- ============================================================
-- Prüfung VOR der Registrierung (anonym aufrufbar), gibt nur true/false.
create or replace function public.orvia_check_invite(p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v public.invite_codes;
begin
  select * into v from public.invite_codes
   where code_hash = encode(digest(p_code,'sha256'),'hex') limit 1;
  if v.id is null then return false; end if;
  if v.status <> 'active' then return false; end if;
  if v.expires_at is not null and v.expires_at < now() then return false; end if;
  if v.used_count >= v.max_uses then return false; end if;
  return true;
end $$;

-- Einlösung NACH erfolgreicher Registrierung (authentifiziert).
create or replace function public.orvia_redeem_invite(p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v public.invite_codes; uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  -- bereits eingelöst? → ok
  if exists (select 1 from public.invite_redemptions where user_id = uid) then
    return true;
  end if;
  select * into v from public.invite_codes
   where code_hash = encode(digest(p_code,'sha256'),'hex') limit 1
   for update;
  if v.id is null or v.status <> 'active'
     or (v.expires_at is not null and v.expires_at < now())
     or v.used_count >= v.max_uses then
    return false;
  end if;
  update public.invite_codes set used_count = used_count + 1 where id = v.id;
  insert into public.invite_redemptions(invite_code_id, user_id) values (v.id, uid);
  return true;
end $$;

revoke all on function public.orvia_check_invite(text)  from public;
revoke all on function public.orvia_redeem_invite(text) from public;
grant execute on function public.orvia_check_invite(text)  to anon, authenticated;
grant execute on function public.orvia_redeem_invite(text) to authenticated;

-- ============================================================
--  6) AUTO-TIMESTAMP für app_state.updated_at
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch before update on public.app_state
  for each row execute function public.touch_updated_at();

-- ============================================================
--  7) INVITE-CODE ANLEGEN  (Beispiel — Klartext NICHT speichern!)
--  Ersetze 'ORVIA-BETA-2026' durch deinen Wunsch-Code und führe aus:
--
--    insert into public.invite_codes(code_hash, label, max_uses)
--    values (encode(digest('ORVIA-BETA-2026','sha256'),'hex'), 'Beta 1', 25);
--
--  Mehrere Codes = mehrere INSERTs. max_uses steuert, wie oft nutzbar.
-- ============================================================
