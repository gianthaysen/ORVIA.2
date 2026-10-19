-- ============================================================
-- ORVIA · Rueckweg Runden/Intervalle Laufen und Rad (Worker v8-454)
-- ------------------------------------------------------------
-- Entfernt bei Garmin-Lauf- und Radeinheiten GENAU das, was die Zusatzabrufe ergaenzt haben — sonst nichts:
--   * metrics.splits + metrics.splits_source, wenn splits_source = 'garmin_splits'
--   * metrics.ext.splits, metrics.ext.typed_splits
--   * die Befunde splits / typed_splits in metrics.ext.extras (ext.extras selbst nur, wenn danach leer;
--     metrics.ext ganz, wenn danach nur noch die Versionsnummer uebrig ist — dann gab es ihn nur wegen der Zusatzabrufe)
-- Unberuehrt: Schwimmeinheiten (Runden/Bahnen aus v8-452.1), fremde Runden anderer Quelle, corrections,
-- durationCorrection, plannedSessionId, planLinkCorrection, Messreihen, Rohfelder des Listeneintrags, Spalten.
-- VORHER in Railway DETAIL_EXTRAS_SPORTS wieder auf "swimming" setzen (sonst holt der naechste Lauf alles erneut).
-- Laeuft in EINER Transaktion; ein zweiter Lauf aendert nichts.
-- ============================================================
begin;

select 'vorher' as stand, count(*) as zeilen
from public.activities
where source = 'garmin' and sport_id in ('running', 'cycling')
  and (metrics ->> 'splits_source' = 'garmin_splits' or (metrics -> 'ext') ?| array['splits', 'typed_splits']
       or (metrics -> 'ext' -> 'extras') ?| array['splits', 'typed_splits']);

update public.activities a
set metrics = n.m
from (
  select id,
         case when e.ext is null then base
              when (e.nx - 'v') = '{}'::jsonb then base - 'ext'      -- ext gab es nur wegen der Zusatzabrufe
              else jsonb_set(base, '{ext}', e.nx)
         end as m
  from (
    select id, base, ext,
           case when ext is null then null
                when extras is null or extras = '{}'::jsonb then ext - 'extras'
                else jsonb_set(ext, '{extras}', extras) end as nx
    from (
    select id,
           case when metrics ->> 'splits_source' = 'garmin_splits' then metrics - 'splits' - 'splits_source' else metrics end as base,
           case when jsonb_typeof(metrics -> 'ext') = 'object' then (metrics -> 'ext') - 'splits' - 'typed_splits' end as ext,
           case when jsonb_typeof(metrics -> 'ext' -> 'extras') = 'object'
                then (metrics -> 'ext' -> 'extras') - 'splits' - 'typed_splits' end as extras
    from public.activities
    where source = 'garmin' and sport_id in ('running', 'cycling')
      and (metrics ->> 'splits_source' = 'garmin_splits' or (metrics -> 'ext') ?| array['splits', 'typed_splits']
           or (metrics -> 'ext' -> 'extras') ?| array['splits', 'typed_splits'])
    ) e0
  ) e
) n
where a.id = n.id;

select 'nachher' as stand, count(*) as zeilen
from public.activities
where source = 'garmin' and sport_id in ('running', 'cycling')
  and (metrics ->> 'splits_source' = 'garmin_splits' or (metrics -> 'ext') ?| array['splits', 'typed_splits']
       or (metrics -> 'ext' -> 'extras') ?| array['splits', 'typed_splits']);

commit;
