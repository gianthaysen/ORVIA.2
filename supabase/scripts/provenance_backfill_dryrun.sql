-- ============================================================
-- ORVIA · Probelauf Herkunfts-Backfill (v8-447.3) — NUR LESEND
-- ------------------------------------------------------------
-- Zeigt VOR dem Backfill, welche Garmin-Aktivitaeten betroffen sind und wie viele Listenabrufe
-- noetig werden — ohne Garmin, ohne Login, ohne etwas zu aendern. Nach dem Backfill erneut
-- ausfuehren: dieselben Zahlen zeigen, was behoben ist.
--
-- Ergebnis nur NAMEN und ZAEHLUNGEN (keine Zeiten, keine Kennungen, keine Messwerte).
-- Ausfuehren: Supabase → SQL Editor → einfuegen → Run.
--
-- art:
--   status        complete · partial · unavailable · inconsistent (Regel wie provenance.status)
--   kandidat      partial-Zeilen, die der Backfill prueft — mit Grund (ohne_typ_und_utc · ohne_typ ·
--                 ohne_utc · ohne_ortszeit · kein_block) und Schutzvermerk (mit_korrektur ·
--                 mit_planverknuepfung — diese Felder fasst der Backfill nicht an)
--   abrufe        geschaetzte Listenabrufe (Zeitfenster; Tage mit <= 7 Tagen Abstand = ein Fenster, Untergrenze;
--                 die Bibliothek blaettert je 20 Eintraege) · ohne_startzeit (nicht abfragbar)
--   nachgetragen  bereits vom Backfill ergaenzte Zeilen (nach dem Lauf)
-- ============================================================
with g as (
  select sport_id, started_at,
         case when jsonb_typeof(metrics) = 'object' then metrics else '{}'::jsonb end as m
  from public.activities where source = 'garmin'
),
x as (
  select sport_id, started_at, m,
         case when jsonb_typeof(m -> 'garmin') = 'object' then m -> 'garmin' else '{}'::jsonb end as gm
  from g
),
s as (
  select x.*,
         case
           when jsonb_typeof(gm -> 'prov_conflicts') = 'array' and jsonb_array_length(gm -> 'prov_conflicts') > 0 then 'inconsistent'
           when cardinality(mi.missing) = 0 then 'complete'
           when mi.missing <@ coalesce(array(select jsonb_array_elements_text(
                  case when jsonb_typeof(gm -> 'prov_unavailable') = 'array' then gm -> 'prov_unavailable' else '[]'::jsonb end)), '{}')
             then 'unavailable'
           else 'partial' end as st
  from x cross join lateral (
    select array(select k from unnest(array['type_key', 'start_gmt', 'start_local', 'utc_offset_s']) as k
                 where coalesce(gm ->> k, '') = '') as missing) mi
),
tage as (
  select distinct (started_at)::date as d from s where st = 'partial' and started_at is not null
),
inseln as (
  select d, case when lag(d) over (order by d) is null or d - lag(d) over (order by d) > 7 then 1 else 0 end as neu from tage
)
select 'status' as art, sport_id, st as name, count(*) as aktivitaeten from s group by 1, 2, 3
union all
select 'kandidat', sport_id,
       case when gm = '{}'::jsonb then 'kein_block'
            when coalesce(gm ->> 'type_key', '') = '' and coalesce(gm ->> 'start_gmt', '') = '' then 'ohne_typ_und_utc'
            when coalesce(gm ->> 'type_key', '') = '' then 'ohne_typ'
            when coalesce(gm ->> 'start_gmt', '') = '' then 'ohne_utc'
            else 'ohne_ortszeit' end,
       count(*)
from s where st = 'partial' group by 1, 2, 3
union all
select 'kandidat', sport_id, 'mit_korrektur', count(*) from s
where st = 'partial' and jsonb_typeof(m -> 'corrections') = 'object' and m -> 'corrections' <> '{}'::jsonb group by 1, 2, 3
union all
select 'kandidat', sport_id, 'mit_planverknuepfung', count(*) from s
where st = 'partial' and coalesce(m ->> 'plannedSessionId', '') <> '' group by 1, 2, 3
union all
select 'abrufe', '(alle)', 'zeitfenster', coalesce(sum(neu), 0) from inseln
union all
select 'abrufe', '(alle)', 'ohne_startzeit', count(*) from s where st = 'partial' and started_at is null
union all
select 'nachgetragen', sport_id, 'zeilen', count(*) from s where jsonb_typeof(gm -> 'prov_backfill') = 'object' group by 1, 2, 3
order by 1, 2, 3;
