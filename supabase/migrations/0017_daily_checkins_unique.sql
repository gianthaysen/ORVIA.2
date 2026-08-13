-- ============================================================
--  ORVIA · 0017 — daily_checkins: fehlender Unique-Index für den Upsert-Vertrag
--  Incident 2026-07-16: „Check-in lokal gespeichert (Cloud-Sync fehlgeschlagen)".
--  Root Cause: checkinRepository upsertet mit ON CONFLICT (user_id, local_date,
--  checkin_type) — aber KEINE Migration hat je einen passenden Unique-Index
--  angelegt (0002 nur ein nicht-uniquer Index user_id+local_date). Postgres lehnt
--  den Upsert dann mit 42P10 ab („no unique or exclusion constraint matching the
--  ON CONFLICT specification") → JEDER Online-Check-in-Save scheitert; Daten
--  blieben nur im lokalen Blob (deshalb lange unbemerkt: die Anzeige liest den Blob).
--  Idempotent. Reihenfolge: Duplikate zuerst bereinigen, sonst scheitert der Index.
-- ============================================================
begin;

-- 1) Vorhandene Duplikate je (user_id, local_date, checkin_type) bereinigen:
--    die JÜNGSTE Zeile (recorded_at, dann created_at) bleibt erhalten.
delete from public.daily_checkins d
using public.daily_checkins k
where d.user_id = k.user_id
  and d.local_date = k.local_date
  and d.checkin_type = k.checkin_type
  and d.id <> k.id
  and (d.recorded_at, d.created_at, d.id) < (k.recorded_at, k.created_at, k.id);

-- 2) Der Unique-Index, den der Client-Vertrag seit Phase 2 voraussetzt.
create unique index if not exists daily_checkins_type_uniq
  on public.daily_checkins (user_id, local_date, checkin_type);

-- 3) GLEICHE FEHLERKLASSE (vom neuen Vertragstest upsert_conflict_contract_test
--    aufgedeckt): auch readiness_scores und readiness_baselines werden mit
--    ON CONFLICT geupsertet, ohne dass je ein Unique-Index existierte —
--    die Phase-3-Readiness-Persistenz scheiterte damit ebenfalls still.
delete from public.readiness_scores d
using public.readiness_scores k
where d.user_id = k.user_id
  and d.local_date = k.local_date
  and coalesce(d.engine_version, '') = coalesce(k.engine_version, '')
  and d.id <> k.id
  and (d.created_at, d.id) < (k.created_at, k.id);
create unique index if not exists readiness_scores_day_uniq
  on public.readiness_scores (user_id, local_date, engine_version);

delete from public.readiness_baselines d
using public.readiness_baselines k
where d.user_id = k.user_id
  and d.metric = k.metric
  and d.id <> k.id
  and (d.created_at, d.id) < (k.created_at, k.id);
create unique index if not exists readiness_baselines_metric_uniq
  on public.readiness_baselines (user_id, metric);

insert into public.schema_migrations(version) values ('0017_daily_checkins_unique') on conflict (version) do nothing;

commit;
