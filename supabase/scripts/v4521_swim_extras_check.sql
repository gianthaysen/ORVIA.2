-- ============================================================
-- ORVIA · Stand Runden/Bahnen nach dem Nachholen (Worker v8-452.1) — NUR LESEND
-- ------------------------------------------------------------
-- Je Garmin-Schwimmeinheit: Typ, Befund der Zusatzabrufe, Anzahl Runden (App-Form) und Bahnen
-- (Rohblock), Bahnen laut Listeneintrag, ob eine manuelle Korrektur besteht. Keine Kennungen,
-- keine Messreihen. Danach: Kontrolle, dass KEINE andere Sportart Zusatzdaten bekommen hat.
-- ============================================================
select row_number() over (order by a.started_at) as nr,
       a.started_at::date as tag,
       a.metrics -> 'garmin' ->> 'type_key' as garmin_typ,
       a.metrics -> 'ext' -> 'extras' ->> 'splits' as runden_abruf,
       a.metrics -> 'ext' -> 'extras' ->> 'typed_splits' as intervalle_abruf,
       case when jsonb_typeof(a.metrics -> 'splits') = 'array' then jsonb_array_length(a.metrics -> 'splits') end as runden,
       a.metrics ->> 'splits_source' as runden_quelle,
       (select count(*) from jsonb_array_elements(case when jsonb_typeof(a.metrics -> 'ext' -> 'splits' -> 'lapDTOs') = 'array'
                                                       then a.metrics -> 'ext' -> 'splits' -> 'lapDTOs' else '[]'::jsonb end) l,
                             jsonb_array_elements(case when jsonb_typeof(l -> 'lengthDTOs') = 'array' then l -> 'lengthDTOs' else '[]'::jsonb end) ln
         where coalesce((ln ->> 'distance')::numeric, 0) > 0) as aktive_bahnen_roh,
       (a.metrics -> 'ext' -> 'fields' ->> 'activeLengths')::numeric as bahnen_liste,
       (a.metrics ? 'corrections' or a.metrics ? 'durationCorrection') as manuelle_korrektur
from public.activities a
where a.source = 'garmin' and a.sport_id = 'swimming'
order by a.started_at;

select a.sport_id as andere_sportart, count(*) as mit_zusatzdaten
from public.activities a
where a.source = 'garmin' and a.sport_id <> 'swimming'
  and (a.metrics -> 'ext' -> 'extras' ? 'splits' or a.metrics -> 'ext' -> 'extras' ? 'typed_splits'
       or a.metrics ->> 'splits_source' = 'garmin_splits')
group by a.sport_id;
