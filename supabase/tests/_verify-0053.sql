-- ============================================================
-- ORVIA · Verifikation Migration 0053 — NUR LESEND, im SQL-Editor ausführen.
-- Erwartung: Spalte ok = true in allen Zeilen; leeres Ergebnis der letzten Abfrage.
-- ============================================================
with f(gruppe, fn) as (values
  ('A','public.orvia_user_role()'), ('A','public.orvia_is_owner()'),
  ('A','public.orvia_exercise_allowed(uuid)'), ('A','public.orvia_template_allowed(uuid)'),
  ('A','public.orvia_own_plan(uuid)'), ('A','public.orvia_own_plan_day(uuid)'),
  ('A','public.orvia_own_session(uuid)'), ('A','public.orvia_own_workout_exercise(uuid)'),
  ('B','public.dc_force_owner()'), ('B','public.rc_force_owner()'),
  ('B','public.orvia_ledger_mark_dirty()'), ('B','public.seed_default_feature_flags()'))
select gruppe, fn,
       has_function_privilege('anon', fn, 'EXECUTE')          as anon,
       has_function_privilege('authenticated', fn, 'EXECUTE') as authenticated,
       not has_function_privilege('anon', fn, 'EXECUTE')
       and has_function_privilege('authenticated', fn, 'EXECUTE') = (gruppe = 'A') as ok
  from f order by gruppe, fn;

select p.proname, p.proconfig,
       'search_path=public' = any(coalesce(p.proconfig, '{}')) as ok
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('touch_updated_at','touch_user_feature_flags','orvia_protect_planned_anchor','orvia_activities_link_normalize');

-- Restliste: SECURITY-DEFINER-Funktionen in public, die anon noch ausführen darf.
-- Nach 0052 + 0053 erwartet: LEER.
select p.oid::regprocedure as funktion
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by 1;
