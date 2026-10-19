-- ============================================================
-- ORVIA · Stand Runden/Intervalle Laufen und Rad nach dem Nachholen (Worker v8-454) — NUR LESEND
-- ------------------------------------------------------------
-- 1) je Sportart: Einheiten, Befund der Zusatzabrufe (ok / empty / failed / offen), Runden aus Garmin,
--    fremde Runden (andere Quelle — muessen unveraendert bleiben), Intervall-Antwort (nur Laufen)
-- 2) die 30 juengsten Lauf-/Radeinheiten einzeln (keine Kennungen, keine Messreihen)
-- 3) Kontrolle: keine andere Sportart hat Zusatzdaten bekommen; Rad hat keine Intervall-Antwort
-- ============================================================
select a.sport_id,
       count(*) as einheiten,
       count(*) filter (where a.metrics -> 'ext' -> 'extras' ->> 'splits' = 'ok') as runden_ok,
       count(*) filter (where a.metrics -> 'ext' -> 'extras' ->> 'splits' = 'empty') as runden_leer,
       count(*) filter (where a.metrics -> 'ext' -> 'extras' ->> 'splits' = 'failed') as runden_fehlgeschlagen,
       count(*) filter (where not coalesce(a.metrics -> 'ext' -> 'extras' ? 'splits', false)) as runden_offen,
       count(*) filter (where a.metrics ->> 'splits_source' = 'garmin_splits') as runden_garmin,
       count(*) filter (where jsonb_typeof(a.metrics -> 'splits') = 'array'
                          and coalesce(a.metrics ->> 'splits_source', '') <> 'garmin_splits') as runden_fremd,
       count(*) filter (where a.metrics -> 'ext' -> 'extras' ->> 'typed_splits' = 'ok') as intervalle_ok,
       count(*) filter (where a.metrics ? 'corrections' or a.metrics ? 'durationCorrection') as manuelle_korrektur
from public.activities a
where a.source = 'garmin' and a.sport_id in ('running', 'cycling')
group by a.sport_id
order by a.sport_id;

select row_number() over (order by a.started_at desc) as nr,
       a.started_at::date as tag,
       a.sport_id,
       a.metrics -> 'garmin' ->> 'type_key' as garmin_typ,
       a.metrics -> 'ext' -> 'extras' ->> 'splits' as runden_abruf,
       a.metrics -> 'ext' -> 'extras' ->> 'typed_splits' as intervalle_abruf,
       case when jsonb_typeof(a.metrics -> 'splits') = 'array' then jsonb_array_length(a.metrics -> 'splits') end as runden,
       a.metrics ->> 'splits_source' as runden_quelle,
       case when jsonb_typeof(a.metrics -> 'ext' -> 'typed_splits' -> 'splits') = 'array'
            then (select count(*) from jsonb_array_elements(a.metrics -> 'ext' -> 'typed_splits' -> 'splits') t
                  where t ->> 'type' like 'INTERVAL\_%') end as intervall_eintraege,
       (a.metrics ? 'corrections' or a.metrics ? 'durationCorrection') as manuelle_korrektur
from public.activities a
where a.source = 'garmin' and a.sport_id in ('running', 'cycling')
order by a.started_at desc
limit 30;

select a.sport_id as unerwartet, count(*) as mit_zusatzdaten
from public.activities a
where a.source = 'garmin'
  and (a.sport_id not in ('swimming', 'running', 'cycling')
       or (a.sport_id = 'cycling' and (a.metrics -> 'ext' ? 'typed_splits' or a.metrics -> 'ext' -> 'extras' ? 'typed_splits')))
  and (a.metrics -> 'ext' -> 'extras' ? 'splits' or a.metrics -> 'ext' -> 'extras' ? 'typed_splits'
       or a.metrics ->> 'splits_source' = 'garmin_splits')
group by a.sport_id;
