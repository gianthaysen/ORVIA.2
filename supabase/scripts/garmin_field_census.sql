-- ============================================================
-- ORVIA · Feldzensus und Nachlade-Stand der Garmin-Aktivitaeten (v8-447.3)
-- ------------------------------------------------------------
-- Zweck: zeigt, welche Felder und Messreihen Garmin JE SPORTART wirklich liefert, wie weit
-- das Nachladen auf den aktuellen Details-Vertrag ist und wie belastbar die Bestwerte sind —
-- ohne Mitschnitt, ohne Login, ohne Token. Grundlage ist, was der Worker je Aktivitaet
-- festhaelt (metrics.garmin, metrics.ext, metrics.best_efforts, Vermerke des Nachladens).
--
-- NUR LESEND. Das Ergebnis enthaelt ausschliesslich NAMEN und ZAEHLUNGEN (und den Zeitpunkt
-- des letzten Worker-Laufs): keine Messwerte, keine Trainingszeiten, keine Orte, keine
-- Nutzer- oder Garmin-Kennungen. Es kann unbedenklich kopiert und weitergegeben werden.
--
-- Ausfuehren: Supabase → SQL Editor → einfuegen → Run → „Export → CSV" (oder kopieren).
-- Auswerten:  python garmin-worker/scripts/census_report.py --csv <datei>
--             schreibt app/docs/GARMIN-FIELD-CENSUS-PROD.md und app/docs/GARMIN-BACKFILL-STATUS.md
--
-- Spalte art:
--   basis                Nenner je Sportart: alle · mit_herkunft · mit_rohfeldern · details_aktuell
--   typ                  Garmin-Typ → ORVIA-Sportart (prueft die Zuordnung; „other" = nicht zugeordnet)
--   herkunft             gefuellte Schluessel des Herkunftsblocks (type_key, start_local, utc_offset_s, Dauern …)
--   nachladen            aktuell · offen_alt · offen_neu · fehler:<Klasse> · zurueckgestellt:<Klasse>
--   tempo                in den letzten 24 h nachgeladen · Zeitpunkt des letzten Nachladens
--   abtastung            vollstaendig (Garmin lieferte alle Zeilen) · ausgeduennt · gesamtzahl_unbekannt
--   aufloesung           mit welchem maxChartSize die Details geladen wurden (standard / maxchart=…)
--   herkunft_unvollstaendig  Herkunftsblock fehlt oder ohne Garmin-Typ / GMT-Startzeit
--   herkunft_status      complete · partial · unavailable · inconsistent (v8-447.3, wie provenance.status)
--   herkunft_luecke      ohne_typ_und_utc · ohne_typ · ohne_utc · ohne_ortszeit · nicht_gelistet ·
--                        nicht_geliefert:<schluessel> · widerspruch:<schluessel>
--   herkunft_nachgetragen  vom Metadaten-Backfill ergaenzt: zeilen · garmin.<schluessel> · ext.<schluessel>
--   bedeutung            Listenwert gegen Aufzeichnung: Beziehung = Urteil [passende Lesart] (Lieferung)
--   bedeutung_hinweis    Ursache einer Abweichung (z. B. two_definitions, pool_lengths, half_value)
--   messreihe            kanonische Messreihe ← Garmin-Quelle [Bedeutung]
--   feld                 erhaltenes Feld des Listeneintrags (metrics.ext.fields)
--   feld_nicht_erhalten  geliefert, aber nicht gespeichert (nur der Name)
--   feld_verworfen       auf der Erlaubnisliste, geliefert, aber in unerwarteter Form (nur der Name)
--   struktur             erhaltener geschachtelter Block des Listeneintrags
--   reihe                erhaltene Zusatz-Messreihe (metrics.ext.series)
--   reihe_nicht_erhalten gelieferte Messreihe, die nicht gespeichert wird (nur der Name)
--   bestwert             Bestwert-Fenster = Guete (exact / approx / insufficient / measured / coarse / too_short)
--   kennwert             Kennwerte aus allen gelieferten Zeilen (welche Reihen)
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
         case when jsonb_typeof(metrics -> 'ext') = 'object' then metrics -> 'ext' else '{}'::jsonb end as ext,
         case when jsonb_typeof(metrics -> 'garmin') = 'object' then metrics -> 'garmin' else '{}'::jsonb end as gm,
         case when jsonb_typeof(metrics -> 'best_efforts') = 'object' then metrics -> 'best_efforts' else '{}'::jsonb end as be,
         (case when jsonb_typeof(metrics -> 'detailsVersion') = 'number' then (metrics ->> 'detailsVersion')::numeric >= 3 else false end
            and coalesce(metrics ->> 'detailsFetchedAt', '') <> '') as cur,
         coalesce(metrics ->> 'detailsFetchedAt', '') <> '' as fetched,
         case when jsonb_typeof(metrics -> 'detailsFailCount') = 'number' then (metrics ->> 'detailsFailCount')::numeric else 0 end as fails,
         case when (metrics ->> 'detailsFailedAt') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then (metrics ->> 'detailsFailedAt')::timestamptz end as failed_at,
         case when (metrics ->> 'detailsFetchedAt') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then (metrics ->> 'detailsFetchedAt')::timestamptz end as fetched_at,
         coalesce(metrics ->> 'detailsFailCategory', 'UNKNOWN') as fail_cat
  from g
)
-- ---- Nenner ---------------------------------------------------------------
select 'basis' as art, sport_id, 'alle' as name, count(*) as aktivitaeten from x group by 1, 2, 3
union all
select 'basis', sport_id, 'mit_herkunft', count(*) from x where gm ? 'type_key' group by 1, 2, 3
union all
select 'basis', sport_id, 'mit_rohfeldern', count(*) from x where jsonb_typeof(ext -> 'fields') = 'object' group by 1, 2, 3
union all
select 'basis', sport_id, 'details_aktuell', count(*) from x where cur group by 1, 2, 3

-- ---- Zuordnung ------------------------------------------------------------
union all
select 'typ', sport_id, coalesce(gm ->> 'type_key', metrics ->> 'source_sport_raw', '(unbekannt)'), count(*)
from x group by 1, 2, 3

-- ---- Herkunftsblock: welche Schluessel der Worker fuellen konnte --------------
union all
select 'herkunft', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(gm) as k
group by 1, 2, 3

-- ---- Nachladen ------------------------------------------------------------
union all
select 'nachladen', sport_id,
       case when cur then 'aktuell'
            when fails >= 3 and failed_at is not null and failed_at > now() - interval '7 days' then 'zurueckgestellt:' || fail_cat
            when fails > 0 then 'fehler:' || fail_cat
            when fetched then 'offen_alt'
            else 'offen_neu' end,
       count(*)
from x group by 1, 2, 3
union all
select 'tempo', '(alle)', 'nachgeladen_letzte_24h', count(*) from x where cur and fetched_at > now() - interval '24 hours'
union all
select 'tempo', '(alle)', 'zuletzt_nachgeladen:' || to_char(max(fetched_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"'), count(*)
from x where cur and fetched_at is not null having count(*) > 0

-- ---- Abtastung ------------------------------------------------------------
union all
select 'abtastung', sport_id,
       case when gm -> 'stream_total' is null or jsonb_typeof(gm -> 'stream_total') <> 'number' then 'gesamtzahl_unbekannt'
            when (gm ->> 'stream_rows')::numeric >= (gm ->> 'stream_total')::numeric then 'vollstaendig'
            else 'ausgeduennt' end,
       count(*)
from x where jsonb_typeof(gm -> 'stream_rows') = 'number' group by 1, 2, 3

-- ---- Aufloesung, mit der die Details geladen wurden (v8-447.1) ----------------
-- 'standard' = maxChartSize der Bibliothek (2000) bzw. vor v8-447.1 nicht vermerkt
union all
select 'aufloesung', sport_id,
       case when jsonb_typeof(metrics -> 'detailsMaxchart') = 'number' and (metrics ->> 'detailsMaxchart')::numeric > 0
            then 'maxchart=' || (metrics ->> 'detailsMaxchart') else 'standard' end,
       count(*)
from x where cur group by 1, 2, 3

-- ---- Herkunftsblock vorhanden, aber unvollstaendig (v8-447.1) -----------------
-- Garmin-Typ oder GMT-Startzeit fehlt — z. B. Block nur vom Nachladen der Details angelegt
union all
select 'herkunft_unvollstaendig', sport_id,
       case when gm = '{}'::jsonb then 'kein_block'
            when coalesce(gm ->> 'type_key', '') = '' and coalesce(gm ->> 'start_gmt', '') = '' then 'ohne_typ_und_zeit'
            when coalesce(gm ->> 'type_key', '') = '' then 'ohne_typ'
            else 'ohne_zeit' end,
       count(*)
from x where coalesce(gm ->> 'type_key', '') = '' or coalesce(gm ->> 'start_gmt', '') = '' group by 1, 2, 3

-- ---- Herkunft: Status je Zeile (v8-447.3, gleiche Regel wie orvia_worker/provenance.status) ----
-- complete      Typ, UTC-Start, Ortszeit-Start und Versatz vorhanden, kein Widerspruch
-- partial       es fehlt etwas, das noch nicht gegen die Garmin-Liste geprueft ist (Backfill-Kandidat)
-- unavailable   was fehlt, hat Garmin beim Pruefen nachweislich nicht geliefert
-- inconsistent  Liste und Zeile widersprechen sich (nichts ersetzt; prov_conflicts)
union all
select 'herkunft_status', sport_id, p.st, count(*)
from x cross join lateral (
  select case
    when jsonb_typeof(gm -> 'prov_conflicts') = 'array' and jsonb_array_length(gm -> 'prov_conflicts') > 0 then 'inconsistent'
    when cardinality(mi.missing) = 0 then 'complete'
    when mi.missing <@ coalesce(array(select jsonb_array_elements_text(
           case when jsonb_typeof(gm -> 'prov_unavailable') = 'array' then gm -> 'prov_unavailable' else '[]'::jsonb end)), '{}')
      then 'unavailable'
    else 'partial' end as st
  from (select array(select k from unnest(array['type_key', 'start_gmt', 'start_local', 'utc_offset_s']) as k
                     where coalesce(gm ->> k, '') = '') as missing) mi
) p
group by 1, 2, 3

-- ---- Herkunft: welche Luecke (v8-447.3) ----------------------------------------
-- ohne_typ_und_utc · ohne_typ · ohne_utc · ohne_ortszeit (Typ und UTC da, Ortszeit/Versatz fehlen)
-- nicht_gelistet (die Garmin-Liste fuer den Tag enthielt die Aktivitaet nicht)
-- nicht_geliefert:<schluessel> (Garmin lieferte den Schluessel nicht) · widerspruch:<schluessel>
union all
select 'herkunft_luecke', sport_id,
       case when coalesce(gm ->> 'type_key', '') = '' and coalesce(gm ->> 'start_gmt', '') = '' then 'ohne_typ_und_utc'
            when coalesce(gm ->> 'type_key', '') = '' then 'ohne_typ'
            when coalesce(gm ->> 'start_gmt', '') = '' then 'ohne_utc'
            else 'ohne_ortszeit' end,
       count(*)
from x where coalesce(gm ->> 'type_key', '') = '' or coalesce(gm ->> 'start_gmt', '') = ''
          or coalesce(gm ->> 'start_local', '') = '' or coalesce(gm ->> 'utc_offset_s', '') = ''
group by 1, 2, 3
union all
select 'herkunft_luecke', sport_id, 'nicht_gelistet', count(*) from x where gm -> 'prov_not_listed' = 'true'::jsonb group by 1, 2, 3
union all
select 'herkunft_luecke', sport_id, 'nicht_geliefert:' || k, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(gm -> 'prov_unavailable') = 'array' then gm -> 'prov_unavailable' else '[]'::jsonb end) as k
group by 1, 2, 3
union all
select 'herkunft_luecke', sport_id, 'widerspruch:' || k, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(gm -> 'prov_conflicts') = 'array' then gm -> 'prov_conflicts' else '[]'::jsonb end) as k
group by 1, 2, 3

-- ---- Herkunft: vom Metadaten-Backfill ergaenzt (v8-447.3) — zeigt die behobenen Faelle ----
union all
select 'herkunft_nachgetragen', sport_id, 'zeilen', count(*) from x where jsonb_typeof(gm -> 'prov_backfill') = 'object' group by 1, 2, 3
union all
select 'herkunft_nachgetragen', sport_id, 'garmin.' || k, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(gm -> 'prov_backfill' -> 'garmin') = 'array' then gm -> 'prov_backfill' -> 'garmin' else '[]'::jsonb end) as k
group by 1, 2, 3
union all
select 'herkunft_nachgetragen', sport_id, 'ext.' || k, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(gm -> 'prov_backfill' -> 'ext') = 'array' then gm -> 'prov_backfill' -> 'ext' else '[]'::jsonb end) as k
group by 1, 2, 3

-- ---- Bedeutungspruefung: Listenwert gegen Aufzeichnung (v8-447.1) ---------------
-- name = Beziehung = Urteil [passende Lesart] (Lieferung) — keine Werte
union all
select 'bedeutung', sport_id,
       r.key || ' = ' || coalesce(r.value ->> 'verdict', '?')
         || coalesce(' [' || (select string_agg(m, '; ' order by m) from jsonb_array_elements_text(
                                case when jsonb_typeof(r.value -> 'matches') = 'array' then r.value -> 'matches' else '[]'::jsonb end) as m) || ']', '')
         || ' (' || case when (ext -> 'semantics' -> 'delivery' ->> 'complete') = 'true' then 'vollstaendig' else 'ausgeduennt' end || ')',
       count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(ext -> 'semantics') = 'object' then ext -> 'semantics' else '{}'::jsonb end) as r
where r.key not in ('v', 'delivery') and jsonb_typeof(r.value) = 'object'
group by 1, 2, 3

-- ---- Bedeutungspruefung: Hinweise zur Ursache einer Abweichung -----------------
union all
select 'bedeutung_hinweis', sport_id, r.key || ': ' || split_part(h, ':', 1), count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(ext -> 'semantics') = 'object' then ext -> 'semantics' else '{}'::jsonb end) as r
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(r.value -> 'hints') = 'array' then r.value -> 'hints' else '[]'::jsonb end) as h
where r.key not in ('v', 'delivery')
group by 1, 2, 3

-- ---- kanonische Messreihen: Quelle und Bedeutung ----------------------------
union all
select 'messreihe', sport_id,
       s.key || ' <- ' || coalesce(s.value ->> 'source', '?') || ' [' || coalesce(s.value ->> 'kind', '?') || ']'
         || case when s.value ? 'derived' then ' (abgeleitet)' else '' end,
       count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(metrics -> 'stream_meta') = 'object' then metrics -> 'stream_meta' else '{}'::jsonb end) as s
where jsonb_typeof(s.value) = 'object'
group by 1, 2, 3

-- ---- Listeneintrag --------------------------------------------------------
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
select 'feld_verworfen', sport_id, n, count(*)
from x cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(ext -> 'rejected') = 'array' then ext -> 'rejected' else '[]'::jsonb end) as n
group by 1, 2, 3
union all
select 'struktur', sport_id, k, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(ext -> 'list') = 'object' then ext -> 'list' else '{}'::jsonb end) as k
group by 1, 2, 3

-- ---- Zusatzreihen ---------------------------------------------------------
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

-- ---- Bestwerte und Kennwerte ------------------------------------------------
union all
select 'bestwert', sport_id, 'power:' || w.key || 's = ' || coalesce(w.value ->> 'q', '?'), count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(be -> 'power' -> 'windows') = 'object' then be -> 'power' -> 'windows' else '{}'::jsonb end) as w
group by 1, 2, 3
union all
select 'bestwert', sport_id, 'distance:' || w.key || 'm = ' || coalesce(w.value ->> 'q', '?'), count(*)
from x cross join lateral jsonb_each(
  case when jsonb_typeof(be -> 'distance' -> 'targets') = 'object' then be -> 'distance' -> 'targets' else '{}'::jsonb end) as w
group by 1, 2, 3
union all
select 'bestwert', sport_id,
       'power:aufzeichnung = ' || case when be -> 'power' ->> 'native' = 'true' and (be -> 'power' ->> 'interval_s')::numeric <= 1 then 'vollstaendig_sekuendlich'
                                       when be -> 'power' ->> 'native' = 'true' then 'vollstaendig_nicht_sekuendlich'
                                       else 'ausgeduennt' end,
       count(*)
from x where jsonb_typeof(be -> 'power' -> 'interval_s') = 'number' group by 1, 2, 3
union all
select 'kennwert', sport_id, k || case when k = 'cadence' then ' [' || coalesce(be -> 'stats' -> 'cadence' ->> 'kind', '?') || ']' else '' end, count(*)
from x cross join lateral jsonb_object_keys(
  case when jsonb_typeof(be -> 'stats') = 'object' then be -> 'stats' else '{}'::jsonb end) as k
group by 1, 2, 3

-- ---- Zusatzabrufe -----------------------------------------------------------
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
