-- ============================================================
--  ORVIA · 0018 — Regeneration & Alltag + Trainingspräferenzen: Server-Sync
--  Incident 2026-07-17: Das Modal „Regeneration und Alltag" speicherte korrekt in den
--  lokalen Blob — aber die Sektion hatte KEINEN Tabellen-Kanal, und der app_state-Blob
--  wird auf Geräten mit lokalen Daten nie angewendet → Eingaben waren auf anderen
--  Geräten prinzipbedingt unsichtbar (gleiche Fehlerklasse wie Ort/Avatar vor 0016).
--  recovery + preferences wandern als strukturierte JSONB-Felder in die bestehende
--  SoT-Tabelle user_profiles (RLS/updated_at-Trigger von 0016 gelten bereits).
--  Idempotent. VOR dem zugehörigen JS-Deploy ausführen.
-- ============================================================
begin;

alter table public.user_profiles add column if not exists recovery    jsonb;
alter table public.user_profiles add column if not exists preferences jsonb;

comment on column public.user_profiles.recovery    is '0018: Regeneration & Alltag (sleep/stress/workPattern/nutritionState/recoveryPreferences) — normalisiert via profile-model.normalizeRecovery';
comment on column public.user_profiles.preferences is '0018: Trainingspräferenzen — normalisiert via profile-model.normalizePreferences';

insert into public.schema_migrations(version) values ('0018_recovery_preferences_sync') on conflict (version) do nothing;

commit;
