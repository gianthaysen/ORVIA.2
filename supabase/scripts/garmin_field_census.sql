-- ============================================================
-- ORVIA · Feldzensus der Garmin-Aktivitaeten (v8-447)
-- ------------------------------------------------------------
-- Zweck: zeigt, welche Felder und Messreihen Garmin JE SPORTART wirklich liefert —
-- ohne Mitschnitt, ohne Login, ohne Token. Grundlage ist, was der Worker seit v8-447
-- je Aktivitaet festhaelt (metrics.garmin, metrics.ext).
--
-- NUR LESEND. Das Ergebnis enthaelt ausschliesslich NAMEN und ZAEHLUNGEN:
-- keine Messwerte, keine Zeiten, keine Orte, keine Nutzerkennungen. Es kann
-- unbedenklich kopiert und weitergegeben werden.
--
-- Ausfuehren: Supabase → SQL Editor → einfuegen → Run → Ergebnis als CSV kopieren.
-- Sinnvoll, sobald der Worker (railway up) einige Laeufe gemacht hat; die Zeile
-- "details_version" zeigt, wie weit das einmalige Nachladen ist (Ziel: alles auf 3).
--
-- Spalte art:
--   typ                  Garmin-Typ → ORVIA-Sportart (prueft die Zuordnung)
--   details_version      Stand des Nachladens (3 = aktuell)
--   zeitachse            Aktivitaeten mit / ohne echte Zeitachse
--   feld                 erhaltenes Feld des Listeneintrags (metrics.ext.fields)
--   feld_nicht_erhalten  geliefert, aber nicht gespeichert (nur der Name)
--   struktur             erhaltener geschachtelter Block des Listeneintrags
--   reihe                erhaltene Zusatz-Messreihe (metrics.ext.series)
--   reihe_nicht_erhalten gelieferte Messreihe, die nicht gespeichert wird (nur der Name)
--   zusatzabruf          Ergebnis der Zusatzabrufe (nur wenn DETAIL_EXTRAS gesetzt ist)
--   zusatz_schluessel    Schluessel in den Antworten der Zusatzabrufe (Form, keine Werte)
-- ============================================================
with g as (
  select sport_id, metrics
  from public.activities
  where source = 'garmin' and jsonb_typeof(metrics) = 'object'
),
x as (
  select sport_id,
         metrics,
         case when jsonb_typeof(metrics -> 'ext') = 'object' then metrics -> 'ext' else '{}'::jsonb end as ext
  from g
)
select 'typ' as art, sport_id,
       coalesce(metrics -> 'garmin' ->> 'type_key', metrics ->> 'source_sport_raw', '(unbekannt)') as name,
       count(*) as aktivitaeten
from x group by 1, 2, 3

union all
select 'details_version', sport_id, coalesce(metrics ->> 'detailsVersion', '(keine Details)'), count(*)
from x group by 1, 2, 3

union all
select 'zeitachse', sport_id,
       case when jsonb_typeof(metrics -> 'streams' -> 'time') = 'array' then 'mit' else 'ohne' end, count(*)
from x group by 1, 2, 3

union all
select 'feld', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(ext -> 'fields') = 'object' then ext -> 'fields' else '{}'::jsonb end) as k
group by 1, 2, 3

union all
select 'feld_nicht_erhalten', sport_id, n, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(ext -> 'unrecognized') = 'array' then ext -> 'unrecognized' else '[]'::jsonb end) as n
group by 1, 2, 3

union all
select 'struktur', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(ext -> 'list') = 'object' then ext -> 'list' else '{}'::jsonb end) as k
group by 1, 2, 3

union all
select 'reihe', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(ext -> 'series') = 'object' then ext -> 'series' else '{}'::jsonb end) as k
group by 1, 2, 3

union all
select 'reihe_nicht_erhalten', sport_id, n, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(ext -> 'series_unparsed') = 'array' then ext -> 'series_unparsed' else '[]'::jsonb end) as n
group by 1, 2, 3

union all
select 'zusatzabruf', sport_id, e.key || ' = ' || e.value, count(*)
from x cross join lateral jsonb_each_text(
  case when jsonb_typeof(ext -> 'extras') = 'object' then ext -> 'extras' else '{}'::jsonb end) as e
group by 1, 2, 3

union all
select 'zusatz_schluessel', sport_id, z.name || '.' || k, count(*)
from x
cross join lateral (values ('splits'), ('typed_splits'), ('hr_zones'), ('power_zones'), ('exercise_sets')) as z(name)
cross join lateral jsonb_object_keys(
  case jsonb_typeof(ext -> z.name)
    when 'object' then ext -> z.name
    when 'array' then case when jsonb_typeof(ext -> z.name -> 0) = 'object' then ext -> z.name -> 0 else '{}'::jsonb end
    else '{}'::jsonb
  end) as k
group by 1, 2, 3

union all
select 'zusatz_schluessel', sport_id, z.name || '.' || t.key || '[].' || k2, count(*)
from x
cross join lateral (values ('splits'), ('typed_splits'), ('hr_zones'), ('power_zones'), ('exercise_sets')) as z(name)
cross join lateral jsonb_each(
  case when jsonb_typeof(ext -> z.name) = 'object' then ext -> z.name else '{}'::jsonb end) as t
cross join lateral jsonb_object_keys(
  case when jsonb_typeof(t.value) = 'array' and jsonb_typeof(t.value -> 0) = 'object' then t.value -> 0 else '{}'::jsonb end) as k2
group by 1, 2, 3

order by 1, 2, 4 desc, 3;
