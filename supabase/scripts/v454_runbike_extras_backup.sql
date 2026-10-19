-- ============================================================
-- ORVIA · Sicherung vor dem Nachholen von Runden/Intervallen fuer Laufen und Rad (Worker v8-454)
-- ------------------------------------------------------------
-- Legt EINMAL eine Kopie von metrics aller Garmin-Lauf- und Radeinheiten an — im Schema orvia_backup,
-- das die Supabase-API nicht ausliefert (nur "public" ist freigegeben). Ein zweiter Lauf
-- ueberschreibt die erste Sicherung NICHT. Aendert an public.activities nichts.
-- Schwimmen ist bereits durch v4521_swim_extras_backup.sql gesichert und wird hier nicht beruehrt.
-- Ausfuehren: Supabase → SQL Editor → einfuegen → Run.
-- Entfernen nach erfolgreicher Freigabe:  drop table orvia_backup.activities_runbike_v454;
-- ============================================================
create schema if not exists orvia_backup;
revoke all on schema orvia_backup from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema orvia_backup from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema orvia_backup from authenticated'; end if;
end $$;

create table if not exists orvia_backup.activities_runbike_v454 as
  select id, user_id, sport_id, metrics, now() as gesichert_am
  from public.activities
  where source = 'garmin' and sport_id in ('running', 'cycling');

select sport_id, count(*) as gesicherte_einheiten, min(gesichert_am) as gesichert_am
from orvia_backup.activities_runbike_v454
group by sport_id
order by sport_id;
