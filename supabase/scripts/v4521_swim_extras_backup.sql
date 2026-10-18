-- ============================================================
-- ORVIA · Sicherung vor dem Nachholen von Runden/Bahnen (Worker v8-452.1)
-- ------------------------------------------------------------
-- Legt EINMAL eine Kopie von metrics aller Garmin-Schwimmeinheiten an — in einem eigenen Schema
-- (orvia_backup), das die Supabase-API nicht ausliefert (nur "public" ist freigegeben). Ein zweiter
-- Lauf ueberschreibt die erste Sicherung NICHT. Aendert an public.activities nichts.
-- Ausfuehren: Supabase → SQL Editor → einfuegen → Run.
-- Entfernen nach erfolgreicher Freigabe:  drop schema orvia_backup cascade;
-- ============================================================
create schema if not exists orvia_backup;
revoke all on schema orvia_backup from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema orvia_backup from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema orvia_backup from authenticated'; end if;
end $$;

create table if not exists orvia_backup.activities_swim_v4521 as
  select id, user_id, metrics, now() as gesichert_am
  from public.activities
  where source = 'garmin' and sport_id = 'swimming';

select count(*) as gesicherte_schwimmeinheiten, min(gesichert_am) as gesichert_am
from orvia_backup.activities_swim_v4521;
