-- ============================================================
-- 0042 · goal_plan_input als Standard — B-01, Schritt 8 (letzter Schritt)
-- ------------------------------------------------------------
-- WOFUER. B-01 (Planung liest das kanonische Hauptziel statt goalOf()-Legacy)
-- lief seit 04.09.2026 auf dem ersten Produktionskonto. Der Ziel-Shadow-Log
-- (0037) zeigt mit eingeschaltetem Flag 0 Widersprueche bei 9 Ereignissen aller
-- vier Typen (12.09., v8-368; supabase/tests/_goal-plan-guard.sql). Damit wird
-- das Flag fuer ALLE Konten gesetzt — bestehende und kuenftige.
--
-- WARUM PER ZEILE UND NICHT PER CODE-STANDARD. feature-flags.js ist fail-closed:
-- ohne gelesene Zeile mit enabled = true ist ein Flag AUS. Ein Code-Standard
-- „an" wuerde diese Regel aushebeln (ein Lesefehler koennte dann ein Feature
-- einschalten). Deshalb: eine Zeile je Konto, und ein Trigger, der neuen
-- Konten dieselbe Zeile gibt. Abschalten bleibt serverseitig moeglich
-- (enabled = false auf der Zeile, greift spaetestens nach der 5-min-TTL).
--
-- RUECKNAHME. update public.user_feature_flags set enabled = false
--             where flag = 'goal_plan_input';   -- und den Trigger droppen.
-- ============================================================

begin;

-- 1) Bestand: jedes Konto ohne Zeile bekommt eine; vorhandene Zeilen (das
--    manuell geschaltete Erstkonto) bleiben unangetastet.
insert into public.user_feature_flags (user_id, flag, enabled, reason, set_by)
select u.id, 'goal_plan_input', true, 'B-01 Standard an (0042, 12.09.2026)', 'migration'
  from auth.users u
 where not exists (
   select 1 from public.user_feature_flags f
    where f.user_id = u.id and f.flag = 'goal_plan_input');

-- 2) Kuenftige Konten: gleiche Zeile beim Anlegen. security definer, weil der
--    Trigger unter dem Kontext des Auth-Systems laeuft und die Tabelle keine
--    Schreib-Policy fuer authenticated hat (0031 — bewusst).
create or replace function public.seed_default_feature_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_feature_flags (user_id, flag, enabled, reason, set_by)
  values (new.id, 'goal_plan_input', true, 'B-01 Standard an (0042)', 'migration')
  on conflict (user_id, flag) do nothing;
  return new;
end $$;

drop trigger if exists trg_seed_default_feature_flags on auth.users;
create trigger trg_seed_default_feature_flags
  after insert on auth.users
  for each row execute function public.seed_default_feature_flags();

commit;

-- Nachweis (danach im SQL-Editor):
-- select count(*) filter (where f.enabled) as an, count(u.id) as konten
--   from auth.users u left join public.user_feature_flags f
--     on f.user_id = u.id and f.flag = 'goal_plan_input';
-- Erwartung: an = konten.
