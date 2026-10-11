-- ============================================================
-- 0050 · Sportart-Nachtrag fuer bestehende Aktivitaeten (v8-447.1)
-- ------------------------------------------------------------
-- Voraussetzung: 0049 (public.orvia_norm_sport kennt die 24 Katalog-Sportarten).
--
-- Was diese Migration tut:
--   Aktivitaeten, die NUR wegen der damals fehlenden Zuordnung 'other' tragen, bekommen ihre
--   Sportart. Erkannt werden sie daran, dass der Rohtyp erhalten ist
--   (metrics.source_sport_raw) und die Katalog-Funktion ihn heute kennt.
--
-- Was sie NICHT tut:
--   - keine Zeile ohne erhaltenen Rohtyp anfassen (echter Rueckfall, vom Nutzer gewaehltes
--     „Sonstiges", Altbestand) — die bleiben 'other';
--   - keine Zeile mit einer anderen Sportart als 'other' anfassen;
--   - nichts loeschen, nichts an Dauer, Distanz, Messreihen oder Korrekturen aendern.
--
-- Umkehrbar: jede geaenderte Zeile traegt die Marke
--     metrics.sport_backfill = { "from": "other", "by": "0050", "at": <Zeitpunkt> }
--   und behaelt ihren Rohtyp. Rueckweg: supabase/migrations_rollback/0050_sport_backfill_catalog_rollback.sql
--
-- Vorher / nachher zaehlen: supabase/scripts/0050_sport_backfill_dryrun.sql (nur lesend).
-- Idempotent: ein zweiter Lauf aendert nichts (die Zeilen sind dann nicht mehr 'other').
-- Garmin-Untertypen, die nur der Worker kennt (track_running, cyclocross …), stellt der
-- Worker selbst um (ACTIVITY_PROVENANCE_BACKFILL_DAYS) — nicht diese Migration.
-- ============================================================

update public.activities a
   set sport_id = public.orvia_norm_sport(a.metrics ->> 'source_sport_raw'),
       metrics  = a.metrics || jsonb_build_object(
                    'sport_backfill', jsonb_build_object('from', 'other', 'by', '0050', 'at', to_jsonb(now())))
 where a.sport_id = 'other'
   and jsonb_typeof(a.metrics) = 'object'
   and nullif(trim(a.metrics ->> 'source_sport_raw'), '') is not null
   and public.orvia_norm_sport(a.metrics ->> 'source_sport_raw') <> 'other';
