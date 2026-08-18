-- ORVIA · Laufzeit-Diagnose der Login-Kette  (NUR LESEZUGRIFFE)
-- Erzeugt 18.08.2026. Blockweise im Supabase-SQL-Editor ausfuehren.
--
-- Frage: Verbringt die Login-Kette ihre Zeit IN der Datenbank oder AUF DEM WEG dorthin?
-- Gemessen im Browser: readiness 1328 ms (zwei Anfragen), checkin 1171 ms, goals 851 ms.
-- Wenn `Execution Time` unten im einstelligen Millisekundenbereich liegt, ist die
-- Datenbank unschuldig und die Zeit steckt in Rundreise + Serialisierung. Dann hilft
-- KEIN Index, sondern nur: weniger Anfragen, parallel statt seriell, kleinere Nutzlast.
--
-- P0 · Nutzer-ID (aus der Konsole des angemeldeten Clients)
--     31694adb-c2ef-4597-ade7-5bdaa05b8070

-- P1 · readiness_scores — genau die Abfrage aus readinessRepository.listScores()
explain (analyze, buffers, format text)
select * from public.readiness_scores
 where user_id = '31694adb-c2ef-4597-ade7-5bdaa05b8070'
 order by local_date desc
 limit 60;

-- P2 · daily_checkins — genau die Abfrage aus checkinRepository.listRange(35 Tage)
explain (analyze, buffers, format text)
select * from public.daily_checkins
 where user_id = '31694adb-c2ef-4597-ade7-5bdaa05b8070'
   and local_date >= (current_date - 35)
   and local_date <= current_date
 order by local_date asc;

-- P3 · user_goals
explain (analyze, buffers, format text)
select * from public.user_goals
 where user_id = '31694adb-c2ef-4597-ade7-5bdaa05b8070';

-- P4 · user_sports
explain (analyze, buffers, format text)
select * from public.user_sports
 where user_id = '31694adb-c2ef-4597-ade7-5bdaa05b8070';

-- P5 · Wie viele Zeilen und wie gross ist die Nutzlast wirklich?
--     `select *` holt ALLE Spalten, inklusive JSONB. Bei 35 Check-in-Tagen kann das
--     mehr Bytes sein, als die Zeilenzahl vermuten laesst.
select 'readiness_scores' as tabelle, count(*) as zeilen,
       pg_size_pretty(coalesce(sum(pg_column_size(t.*)),0)) as nutzlast
  from public.readiness_scores t where user_id='31694adb-c2ef-4597-ade7-5bdaa05b8070'
union all
select 'daily_checkins (35 T)', count(*),
       pg_size_pretty(coalesce(sum(pg_column_size(t.*)),0))
  from public.daily_checkins t where user_id='31694adb-c2ef-4597-ade7-5bdaa05b8070'
   and local_date >= (current_date - 35)
union all
select 'user_goals', count(*), pg_size_pretty(coalesce(sum(pg_column_size(t.*)),0))
  from public.user_goals t where user_id='31694adb-c2ef-4597-ade7-5bdaa05b8070'
union all
select 'user_sports', count(*), pg_size_pretty(coalesce(sum(pg_column_size(t.*)),0))
  from public.user_sports t where user_id='31694adb-c2ef-4597-ade7-5bdaa05b8070'
union all
select 'readiness_baselines', count(*), pg_size_pretty(coalesce(sum(pg_column_size(t.*)),0))
  from public.readiness_baselines t where user_id='31694adb-c2ef-4597-ade7-5bdaa05b8070';

-- P6 · Sind die Indizes wirklich da? (aus den Migrationen erwartet)
select tablename, indexname, indexdef
  from pg_indexes
 where schemaname='public'
   and tablename in ('readiness_scores','daily_checkins','user_goals','user_sports',
                     'readiness_baselines','user_profiles','user_constraints','weekly_availability')
 order by tablename, indexname;
