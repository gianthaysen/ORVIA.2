-- ============================================================
-- 0028 · user_metric_series — Tages-ZEITREIHEN (Intraday-Stress, Schlafstadien)
-- ------------------------------------------------------------
-- GM7.4: skalare Tageswerte leben weiter in user_metrics. Diese Tabelle hält
-- die ZEITAUFGELÖSTEN Rohserien, die NICHT in den skalaren Speicher passen:
--   * Intraday-Stress:  points = [[offset_s, level 0..100], ...]
--   * Schlafstadien:    points = [[offset_s, dur_s, stage], ...]  (stage: deep|light|rem|awake)
-- offset_s = Sekunden seit LOKALEM Tagesbeginn (Europe/Berlin, wie todayStr()).
-- Eine Zeile = ein Nutzer + Metrik + lokaler Tag. Additive, rückwärtskompatible
-- Migration: keine bestehende Tabelle/Spalte wird verändert. RLS-Muster + Cascade
-- identisch zu 0019/0022. Worker upsertet idempotent über (user_id, metric_type,
-- metric_date); erneuter Sync ersetzt die Serie, erzeugt keine Dubletten.
-- Aufbewahrung: Rohserie 400 Tage (Anwendungslogik/Cron); Tages-Skalare in
-- user_metrics sind davon unabhängig. Punktobergrenze DB-seitig hart gedeckelt
-- (Guard); der Worker reduziert vorher kontrolliert (Anfang/Ende erhalten).
-- ============================================================

create table if not exists public.user_metric_series (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  metric_type       text not null,                       -- z.B. stress_intraday | sleep_stages
  metric_date       date not null,                       -- LOKALER Kalendertag (Europe/Berlin)
  timezone          text not null default 'Europe/Berlin',
  unit              text,                                -- z.B. stress_score | sleep_stage
  points            jsonb not null default '[]'::jsonb,  -- [[offset_s, ...], ...]
  point_count       int  not null default 0,
  source_type       text not null default 'device_measurement',
  source_record_id  text,                                -- '<provider>:series:<date>:<metric>'
  provider_id       uuid,                                -- Herkunftsprovider (kein FK: additiv/entkoppelt)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, metric_type, metric_date),            -- Dedupe: eine Serie je Tag+Metrik
  constraint ums_points_is_array check (jsonb_typeof(points) = 'array'),
  constraint ums_point_count_bounded check (point_count >= 0 and point_count <= 2000)
);

-- Lesezugriff je Nutzer, neueste zuerst.
create index if not exists ums_user_metric_date_idx
  on public.user_metric_series (user_id, metric_type, metric_date desc);

alter table public.user_metric_series enable row level security;
drop policy if exists sel_own on public.user_metric_series;
create policy sel_own on public.user_metric_series for select to authenticated using (auth.uid() = user_id);
drop policy if exists ins_own on public.user_metric_series;
create policy ins_own on public.user_metric_series for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists upd_own on public.user_metric_series;
create policy upd_own on public.user_metric_series for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists del_own on public.user_metric_series;
create policy del_own on public.user_metric_series for delete to authenticated using (auth.uid() = user_id);

comment on table public.user_metric_series is
  'GM7.4 Tages-Zeitreihen (Intraday-Stress, Schlafstadien). Rohserie ~400 Tage Aufbewahrung; skalare Tageswerte bleiben in user_metrics.';
