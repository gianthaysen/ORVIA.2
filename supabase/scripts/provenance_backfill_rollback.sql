-- ============================================================
-- ORVIA · Rueckweg Herkunfts-Backfill (v8-447.3)
-- ------------------------------------------------------------
-- Entfernt GENAU das, was der Metadaten-Backfill ergaenzt hat — sonst nichts:
--   * die in metrics.garmin.prov_backfill.garmin aufgefuehrten Schluessel aus metrics.garmin
--   * die in metrics.garmin.prov_backfill.ext aufgefuehrten Schluessel aus metrics.ext
--     (und metrics.ext selbst, wenn der Backfill ihn angelegt hat und nichts anderes darin steht)
--   * die Vermerke prov_status, prov_checked_at, prov_unavailable, prov_not_listed,
--     prov_conflicts, prov_backfill, prov_block_created
--     (und metrics.garmin selbst, wenn der Backfill ihn angelegt hat und er danach leer ist)
-- Unberuehrt bleiben: corrections, plannedSessionId, alle Messreihen, Bestwerte, Detail-Vermerke,
-- sport_id, started_at, duration_seconds — und Herkunft, die NICHT vom Backfill kam.
-- Vorher den Worker auf PROVENANCE_BACKFILL=off stellen, sonst ergaenzt der naechste Lauf erneut.
-- Ausfuehren: Supabase → SQL Editor → einfuegen → Run. Laeuft in EINER Transaktion; ein zweiter
-- Lauf aendert nichts.
-- ============================================================
begin;

select 'vorher' as stand, count(*) as zeilen_mit_vermerk
from public.activities
where source = 'garmin' and jsonb_typeof(metrics -> 'garmin') = 'object'
  and (metrics -> 'garmin') ?| array['prov_status', 'prov_checked_at', 'prov_unavailable', 'prov_not_listed',
                                     'prov_conflicts', 'prov_backfill', 'prov_block_created'];

with t as (
  select a.id,
         a.metrics,
         a.metrics -> 'garmin' as g,
         case when jsonb_typeof(a.metrics -> 'garmin' -> 'prov_backfill') = 'object'
              then a.metrics -> 'garmin' -> 'prov_backfill' else '{}'::jsonb end as pb
  from public.activities a
  where a.source = 'garmin'
    and jsonb_typeof(a.metrics -> 'garmin') = 'object'
    and (a.metrics -> 'garmin') ?| array['prov_status', 'prov_checked_at', 'prov_unavailable', 'prov_not_listed',
                                         'prov_conflicts', 'prov_backfill', 'prov_block_created']
),
n as (
  select id, metrics, pb,
         (g ->> 'prov_block_created') = 'true' as block_created,
         g - coalesce(array(select jsonb_array_elements_text(
               case when jsonb_typeof(pb -> 'garmin') = 'array' then pb -> 'garmin' else '[]'::jsonb end)), '{}')
           - array['prov_status', 'prov_checked_at', 'prov_unavailable', 'prov_not_listed',
                   'prov_conflicts', 'prov_backfill', 'prov_block_created'] as g2,
         case when jsonb_typeof(metrics -> 'ext') = 'object'
              then (metrics -> 'ext') - coalesce(array(select jsonb_array_elements_text(
                     case when jsonb_typeof(pb -> 'ext') = 'array' then pb -> 'ext' else '[]'::jsonb end)), '{}')
              end as e2
  from t
),
r as (
  select id,
         case when block_created and g2 = '{}'::jsonb then metrics - 'garmin' else jsonb_set(metrics, '{garmin}', g2) end as m1,
         e2, (pb ->> 'ext_created') = 'true' as ext_created
  from n
),
f as (
  select id,
         case when e2 is null then m1
              when ext_created and (e2 - 'v') = '{}'::jsonb then m1 - 'ext'
              else jsonb_set(m1, '{ext}', e2) end as m2
  from r
)
update public.activities a set metrics = f.m2 from f where a.id = f.id;

select 'nachher' as stand, count(*) as zeilen_mit_vermerk
from public.activities
where source = 'garmin' and jsonb_typeof(metrics -> 'garmin') = 'object'
  and (metrics -> 'garmin') ?| array['prov_status', 'prov_checked_at', 'prov_unavailable', 'prov_not_listed',
                                     'prov_conflicts', 'prov_backfill', 'prov_block_created'];

commit;
