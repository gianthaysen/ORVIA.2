-- ============================================================
--  ORVIA · 0019 — Provider & Metrics Foundation (Garmin-Integration Phase 3)
--  Zentrale Datenbasis für automatische Provider-Daten:
--    data_providers, provider_credentials (service_role-only),
--    connected_devices, device_capabilities, user_metrics,
--    profile_metric_settings, daily_energy_expenditure, metric_anomalies.
--  Zusätzlich: activities.source-Whitelist um 'garmin'/'strava' erweitert.
--  Idempotent, löscht keine Nutzerdaten, rückwärtskompatibel:
--  bestehende Tabellen/Flows werden nicht verändert (nur der activities-Check).
--  Kanonischer Metrik-Katalog: app/js/metrics/metric-registry.js (SSOT).
--  Worker-Upsert-Verträge (on_conflict) — NICHT ohne Migration ändern:
--    data_providers            (user_id, provider_type)
--    provider_credentials      (user_id, provider_type, credential_kind)
--    connected_devices         (user_id, provider_id, provider_device_id)
--    device_capabilities       (device_id, metric_type)
--    user_metrics              (user_id, metric_type, source_record_id) [partial]
--    profile_metric_settings   (user_id, metric_type)
--    daily_energy_expenditure  (user_id, metric_date)
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
--  1) data_providers — Verbindungszustand je Nutzer & Provider
--     (ersetzt perspektivisch die ungenutzte Alt-Tabelle data_sources)
-- ------------------------------------------------------------
create table if not exists public.data_providers (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  provider_type              text not null,
  connection_status          text not null default 'not_connected',
  provider_status            jsonb not null default '{}'::jsonb,  -- z.B. {displayName, unitSystem}
  last_sync_at               timestamptz,
  last_successful_sync_at    timestamptz,
  last_error_code            text,
  reauthentication_required  boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
alter table public.data_providers drop constraint if exists data_providers_type_chk;
alter table public.data_providers add constraint data_providers_type_chk
  check (provider_type in ('garmin_unofficial','garmin_official','apple_health','health_connect','strava','manual'));
alter table public.data_providers drop constraint if exists data_providers_conn_chk;
alter table public.data_providers add constraint data_providers_conn_chk
  check (connection_status in ('not_connected','connecting','mfa_required','connected','error','reauth_required','disconnected'));
create unique index if not exists data_providers_user_type_uniq
  on public.data_providers (user_id, provider_type);

-- ------------------------------------------------------------
--  2) provider_credentials — verschlüsselte Tokens, NUR service_role.
--     Kein Klartext: encrypted_payload ist Fernet-verschlüsselt (Worker-Key).
--     Analog oauth_tokens (schema.sql): RLS aktiv, KEINE Policies für Nutzer.
-- ------------------------------------------------------------
create table if not exists public.provider_credentials (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  provider_type    text not null,
  credential_kind  text not null default 'session_tokens',
  encrypted_payload text not null,
  key_version      integer not null default 1,
  expires_hint_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.provider_credentials drop constraint if exists provider_credentials_kind_chk;
alter table public.provider_credentials add constraint provider_credentials_kind_chk
  check (credential_kind in ('session_tokens','oauth_tokens','mfa_state'));
create unique index if not exists provider_credentials_uniq
  on public.provider_credentials (user_id, provider_type, credential_kind);

-- ------------------------------------------------------------
--  3) connected_devices — erkannte Geräte je Provider
-- ------------------------------------------------------------
create table if not exists public.connected_devices (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  provider_id                uuid not null references public.data_providers(id) on delete cascade,
  provider_device_id         text not null,
  unit_id                    text,
  product_id                 text,
  device_name                text,
  model_name                 text,
  device_type                text not null default 'other',
  software_version           text,
  is_primary_wearable        boolean not null default false,
  is_primary_training_device boolean not null default false,
  is_last_used               boolean not null default false,
  first_seen_at              timestamptz not null default now(),
  last_seen_at               timestamptz,
  last_sync_at               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
alter table public.connected_devices drop constraint if exists connected_devices_type_chk;
alter table public.connected_devices add constraint connected_devices_type_chk
  check (device_type in ('watch','fitness_tracker','cycling_computer','smart_scale','chest_strap','power_meter','footpod','other'));
create unique index if not exists connected_devices_uniq
  on public.connected_devices (user_id, provider_id, provider_device_id);

-- ------------------------------------------------------------
--  4) device_capabilities — beobachtete Fähigkeiten je Gerät
--     user_id wird per SECURITY-DEFINER-Trigger aus dem Gerät erzwungen
--     (Konvention rc_force_owner aus 0002).
-- ------------------------------------------------------------
create table if not exists public.device_capabilities (
  id                  uuid primary key default gen_random_uuid(),
  device_id           uuid not null references public.connected_devices(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  metric_type         text not null,
  capability_status   text not null default 'unknown',
  confidence          text not null default 'low',
  first_observed_at   timestamptz,
  last_observed_at    timestamptz,
  last_valid_value_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.device_capabilities drop constraint if exists device_capabilities_status_chk;
alter table public.device_capabilities add constraint device_capabilities_status_chk
  check (capability_status in ('supported','unsupported','observed','not_observed','temporarily_unavailable','permission_missing','insufficient_history','sync_failed','unknown'));
create unique index if not exists device_capabilities_uniq
  on public.device_capabilities (device_id, metric_type);

create or replace function public.dc_force_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select d.user_id into new.user_id from public.connected_devices d where d.id = new.device_id;
  if new.user_id is null then
    raise exception 'device_capabilities: unknown device_id %', new.device_id;
  end if;
  return new;
end $$;
drop trigger if exists dc_force_owner_tr on public.device_capabilities;
create trigger dc_force_owner_tr before insert or update of device_id
  on public.device_capabilities for each row execute function public.dc_force_owner();

-- ------------------------------------------------------------
--  5) user_metrics — Source-of-Truth-Speicher aller Metrik-Messwerte.
--     Historie: Zeilen werden NIE überschrieben, nur ergänzt
--     (Idempotenz über source_record_id). validity steuert die Auflösung:
--       valid   → kandidiert für resolved value
--       suspect → gespeichert, aber nicht automatisch aktiv (Anomalie)
--       invalid → gespeichert, nie aktiv (außerhalb Plausibilitätsgrenzen)
-- ------------------------------------------------------------
create table if not exists public.user_metrics (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  provider_id        uuid references public.data_providers(id) on delete set null,
  device_id          uuid references public.connected_devices(id) on delete set null,
  metric_type        text not null,
  value_numeric      double precision,
  value_text         text,
  value_json         jsonb,
  unit               text,
  metric_date        date not null,
  measured_from      timestamptz,
  measured_to        timestamptz,
  measured_at        timestamptz,
  imported_at        timestamptz not null default now(),
  source_type        text not null,
  source_record_id   text,
  quality            text,
  confidence         text,
  validity           text not null default 'valid',
  is_manual_override boolean not null default false,
  original_metric_id uuid references public.user_metrics(id) on delete set null,
  override_reason    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.user_metrics drop constraint if exists user_metrics_source_chk;
alter table public.user_metrics add constraint user_metrics_source_chk
  check (source_type in ('lab_test','device_measurement','provider_calculation','manual_override','manual_entry','orvia_estimate','historical'));
alter table public.user_metrics drop constraint if exists user_metrics_validity_chk;
alter table public.user_metrics add constraint user_metrics_validity_chk
  check (validity in ('valid','suspect','invalid'));
alter table public.user_metrics drop constraint if exists user_metrics_override_reason_chk;
alter table public.user_metrics add constraint user_metrics_override_reason_chk
  check (override_reason is null or override_reason in
    ('garmin_value_wrong','external_measurement_more_accurate','lab_test_available','manual_correction','other'));
-- Idempotenter Worker-Upsert (deterministische source_record_id, z.B.
-- 'garmin_unofficial:daily:2026-07-17:vo2max_running'):
create unique index if not exists user_metrics_source_record_uniq
  on public.user_metrics (user_id, metric_type, source_record_id)
  where source_record_id is not null;
create index if not exists user_metrics_lookup_idx
  on public.user_metrics (user_id, metric_type, metric_date desc);
create index if not exists user_metrics_date_idx
  on public.user_metrics (user_id, metric_date desc);

-- ------------------------------------------------------------
--  6) profile_metric_settings — Nutzer-Einstellungen je Metrik
--     (edit_mode-Abweichungen, bevorzugte Quelle, Sichtbarkeit).
--     Default-Verhalten kommt aus metric-registry.js; hier stehen NUR
--     bewusste Abweichungen — Standardnutzer haben 0 Zeilen.
-- ------------------------------------------------------------
create table if not exists public.profile_metric_settings (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  metric_type             text not null,
  edit_mode               text,
  preferred_source        text,
  manual_override_enabled boolean not null default true,
  display_enabled         boolean,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
alter table public.profile_metric_settings drop constraint if exists pms_edit_mode_chk;
alter table public.profile_metric_settings add constraint pms_edit_mode_chk
  check (edit_mode is null or edit_mode in ('manual_editable','automatic_locked','automatic_override_allowed','calculated_read_only'));
create unique index if not exists profile_metric_settings_uniq
  on public.profile_metric_settings (user_id, metric_type);

-- ------------------------------------------------------------
--  7) daily_energy_expenditure — Ergebnis des Kalorienmodells (Phase 7)
-- ------------------------------------------------------------
create table if not exists public.daily_energy_expenditure (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  metric_date            date not null,
  bmr                    double precision,
  resting_energy         double precision,
  active_energy          double precision,
  step_energy            double precision,
  training_energy        double precision,
  other_activity_energy  double precision,
  thermic_effect_food    double precision,
  provider_total         double precision,
  orvia_calculated_total double precision,
  resolved_total         double precision,
  adaptive_adjustment    double precision not null default 0,
  calculation_version    text not null default 'v1',
  inputs                 jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index if not exists daily_energy_expenditure_uniq
  on public.daily_energy_expenditure (user_id, metric_date);

-- ------------------------------------------------------------
--  8) metric_anomalies — unplausible Sprünge/Messfehler
-- ------------------------------------------------------------
create table if not exists public.metric_anomalies (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  metric_type       text not null,
  metric_id         uuid references public.user_metrics(id) on delete cascade,
  anomaly_type      text not null,
  severity          text not null default 'warning',
  previous_value    double precision,
  new_value         double precision,
  detail            jsonb not null default '{}'::jsonb,
  resolution_status text not null default 'open',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
alter table public.metric_anomalies drop constraint if exists metric_anomalies_res_chk;
alter table public.metric_anomalies add constraint metric_anomalies_res_chk
  check (resolution_status in ('open','accepted','rejected','superseded'));
alter table public.metric_anomalies drop constraint if exists metric_anomalies_type_chk;
alter table public.metric_anomalies add constraint metric_anomalies_type_chk
  check (anomaly_type in ('out_of_range','implausible_jump','stale_source','duplicate_conflict','other'));
create index if not exists metric_anomalies_open_idx
  on public.metric_anomalies (user_id, resolution_status, created_at desc);

-- ------------------------------------------------------------
--  9) activities.source-Whitelist erweitern (Provider-Aktivitäten).
--     Nur wenn die kanonische 0009-Tabelle mit Check existiert.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint c
             join pg_class t on t.oid = c.conrelid
             where t.relname = 'activities' and c.conname = 'activities_source_chk') then
    execute 'alter table public.activities drop constraint activities_source_chk';
    execute $chk$alter table public.activities add constraint activities_source_chk
      check (source in ('orvia_workout','manual','import','legacy_local','garmin','strava'))$chk$;
  end if;
end $$;

-- ------------------------------------------------------------
--  10) updated_at-Trigger (projektweite Funktion wiederverwenden)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['data_providers','provider_credentials','connected_devices',
    'device_capabilities','user_metrics','profile_metric_settings',
    'daily_energy_expenditure','metric_anomalies']
  loop
    execute format('drop trigger if exists %I_touch on public.%I;', t, t);
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
--  11) RLS: eigene Zeilen für authenticated; provider_credentials
--      bekommt KEINE Nutzer-Policies (service_role-only, wie oauth_tokens).
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['data_providers','provider_credentials','connected_devices',
    'device_capabilities','user_metrics','profile_metric_settings',
    'daily_energy_expenditure','metric_anomalies']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format('revoke all on public.%I from anon;', t);
    execute format('revoke all on public.%I from public;', t);
  end loop;
end $$;

do $$
declare t text;
begin
  -- Lese-/Schreibrechte für eigene Zeilen (Client). provider_credentials ausgenommen.
  foreach t in array array['data_providers','connected_devices','device_capabilities',
    'user_metrics','profile_metric_settings','daily_energy_expenditure','metric_anomalies']
  loop
    execute format('revoke all on public.%I from authenticated;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('drop policy if exists sel_own on public.%I;', t);
    execute format('create policy sel_own on public.%I for select to authenticated using (auth.uid() = user_id);', t);
    execute format('drop policy if exists ins_own on public.%I;', t);
    execute format('create policy ins_own on public.%I for insert to authenticated with check (auth.uid() = user_id);', t);
    execute format('drop policy if exists upd_own on public.%I;', t);
    execute format('create policy upd_own on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('drop policy if exists del_own on public.%I;', t);
    execute format('create policy del_own on public.%I for delete to authenticated using (auth.uid() = user_id);', t);
  end loop;
  -- provider_credentials: hart sperren.
  execute 'revoke all on public.provider_credentials from authenticated;';
end $$;

insert into public.schema_migrations(version) values ('0019_provider_metrics_foundation')
  on conflict (version) do nothing;

commit;
