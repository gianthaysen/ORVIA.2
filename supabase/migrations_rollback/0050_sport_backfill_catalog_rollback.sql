-- ============================================================
-- Rueckweg zu 0050 · Sportart-Nachtrag
-- ------------------------------------------------------------
-- Setzt GENAU die von 0050 geaenderten Zeilen auf 'other' zurueck und entfernt die Marke.
-- Zeilen, deren Sportart seither von Hand oder vom Worker geaendert wurde, traegt die Marke
-- weiter — sie werden ebenfalls zurueckgesetzt; wer das nicht will, grenzt per sport_id ein.
-- Der Rohtyp (metrics.source_sport_raw) bleibt in jedem Fall erhalten.
-- ============================================================
update public.activities a
   set sport_id = 'other',
       metrics  = a.metrics - 'sport_backfill'
 where jsonb_typeof(a.metrics) = 'object'
   and a.metrics -> 'sport_backfill' ->> 'by' = '0050';
