-- ============================================================
-- ORVIA · Sportart-Nachtrag: PROBELAUF (v8-447.1) — NUR LESEND
-- ------------------------------------------------------------
-- Voraussetzung: Migration 0049 ist eingespielt (public.orvia_norm_sport kennt den Katalog).
-- Diese Abfrage aendert NICHTS. Sie zeigt, was Migration 0050 aendern WUERDE, und was
-- danach noch 'other' bliebe. Ergebnis: nur Namen und Zaehlungen.
--
-- Vor 0050 ausfuehren und das Ergebnis aufheben (vorher); nach 0050 erneut ausfuehren
-- (nachher): die Zeilen 'wuerde_geaendert' muessen dann verschwunden sein, die Zeilen
-- 'nachgetragen' muessen dieselben Zahlen tragen.
--
-- Spalte art:
--   funktion           katalog_24_aktiv = 0049 ist eingespielt; sonst erst 0049 einspielen
--   bestand            Aktivitaeten je Quelle und Sportart (heute)
--   wuerde_geaendert   other → <sportart>, je Quelle und Rohtyp (das aendert 0050)
--   bleibt_other       bleibt 'other', je Quelle und Rohtyp ('(kein Rohtyp)' = echter Rueckfall
--                      oder Altbestand ohne erhaltenen Rohtyp)
--   nachgetragen       von 0050 bereits umgestellte Zeilen (Marke metrics.sport_backfill)
--   ungueltig          sport_id ausserhalb des Katalogs (darf es nicht geben)
-- ============================================================
with a as (
  select source,
         sport_id,
         case when jsonb_typeof(metrics) = 'object' then nullif(trim(metrics ->> 'source_sport_raw'), '') end as raw,
         case when jsonb_typeof(metrics) = 'object' then metrics -> 'sport_backfill' ->> 'by' end as marke
  from public.activities
),
b as (
  select a.*, case when raw is not null then public.orvia_norm_sport(raw) else 'other' end as neu from a
)
select 'funktion' as art, '(0049)' as source,
       case when public.orvia_norm_sport('yoga') = 'yoga' and public.orvia_norm_sport('Hyrox') = 'hyrox'
             and public.orvia_norm_sport('bouldern') = 'climbing' and public.orvia_norm_sport('quidditch') = 'other'
            then 'katalog_24_aktiv' else 'ALTER_STAND_0049_FEHLT' end as name,
       1::bigint as aktivitaeten
union all
select 'bestand', source, sport_id, count(*) from b group by 1, 2, 3
union all
select 'wuerde_geaendert', source, lower(raw) || ' -> ' || neu, count(*)
from b where sport_id = 'other' and raw is not null and neu <> 'other' group by 1, 2, 3
union all
select 'bleibt_other', source, coalesce(lower(raw), '(kein Rohtyp)'), count(*)
from b where sport_id = 'other' and (raw is null or neu = 'other') group by 1, 2, 3
union all
select 'nachgetragen', source, 'other -> ' || sport_id, count(*)
from b where marke = '0050' group by 1, 2, 3
union all
select 'ungueltig', source, sport_id, count(*)
from b where sport_id not in ('gym','running','cycling','swimming','triathlon','football','handball','padel','tennis',
                              'athletics','basketball','rowing','hiking','walking','mobility','other','volleyball',
                              'hockey','rugby','badminton','golf','climbing','yoga','hyrox')
group by 1, 2, 3
order by 1, 2, 4 desc, 3;
