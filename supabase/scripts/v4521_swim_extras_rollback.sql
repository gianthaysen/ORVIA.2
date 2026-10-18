-- ============================================================
-- ORVIA · Rueckweg Runden/Bahnen (Worker v8-452.1)
-- ------------------------------------------------------------
-- Entfernt GENAU das, was die Zusatzabrufe Runden/Intervalle ergaenzt haben — sonst nichts:
--   * metrics.splits + metrics.splits_source, wenn splits_source = 'garmin_splits'
--   * metrics.ext.splits, metrics.ext.typed_splits
--   * die Befunde splits / typed_splits in metrics.ext.extras (ext.extras selbst nur, wenn danach leer)
-- Unberuehrt: corrections, durationCorrection, plannedSessionId, planLinkCorrection, Messreihen,
-- Bestwerte, Rohfelder des Listeneintrags, Herkunft, alle Spalten.
-- VORHER im Worker DETAIL_EXTRAS leeren (sonst holt der naechste Lauf alles erneut).
-- Laeuft in EINER Transaktion; ein zweiter Lauf aendert nichts.
-- ============================================================
begin;

select 'vorher' as stand, count(*) as zeilen
from public.activities
where source = 'garmin'
  and (metrics ->> 'splits_source' = 'garmin_splits' or (metrics -> 'ext') ?| array['splits', 'typed_splits']
       or (metrics -> 'ext' -> 'extras') ?| array['splits', 'typed_splits']);

update public.activities a
set metrics = n.m
from (
  select id,
         case when e.ext is null then base
              else jsonb_set(base, '{ext}',
                     case when e.extras is null then e.ext - 'extras'
                          when e.extras = '{}'::jsonb then e.ext - 'extras'
                          else jsonb_set(e.ext, '{extras}', e.extras) end)
         end as m
  from (
    select id,
           case when metrics ->> 'splits_source' = 'garmin_splits' then metrics - 'splits' - 'splits_source' else metrics end as base,
           case when jsonb_typeof(metrics -> 'ext') = 'object' then (metrics -> 'ext') - 'splits' - 'typed_splits' end as ext,
           case when jsonb_typeof(metrics -> 'ext' -> 'extras') = 'object'
                then (metrics -> 'ext' -> 'extras') - 'splits' - 'typed_splits' end as extras
    from public.activities
    where source = 'garmin'
      and (metrics ->> 'splits_source' = 'garmin_splits' or (metrics -> 'ext') ?| array['splits', 'typed_splits']
           or (metrics -> 'ext' -> 'extras') ?| array['splits', 'typed_splits'])
  ) e
) n
where a.id = n.id;

select 'nachher' as stand, count(*) as zeilen
from public.activities
where source = 'garmin'
  and (metrics ->> 'splits_source' = 'garmin_splits' or (metrics -> 'ext') ?| array['splits', 'typed_splits']
       or (metrics -> 'ext' -> 'extras') ?| array['splits', 'typed_splits']);

commit;
