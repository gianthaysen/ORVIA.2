-- ORVIA · B-01 7-Tage-Waechter   (NUR LESEZUGRIFFE, ein Block, eine Ergebniszeile)
-- Frage: Seit das Flag goal_plan_input auf dem Produktionskonto an ist (04.09.2026),
-- lesen mainGoalOf() und goalOf() dieselbe Quelle. JEDER Widerspruch im Ziel-Shadow-Log
-- ab diesem Datum ist deshalb ein Befund gegen B-01 (B-01-UMSETZUNGSPLAN.md §7).
-- Entscheidung: tage_abgedeckt >= 7 UND widersprueche = 0 ⇒ Flag-Standard fuer alle Konten.
-- Filter auf echte App-Versionen (Probe-Zeilen vom 20.08. bleiben im Log, zaehlen hier nicht).
select count(*)                                          as ereignisse,
       min(occurred_at)::date                            as erstes,
       max(occurred_at)::date                            as letztes,
       (max(occurred_at)::date - min(occurred_at)::date) as tage_abgedeckt,
       count(*) filter (where contradiction)             as widersprueche,
       array_remove(array_agg(distinct app_version), null) as versionen,
       count(distinct user_id)                           as konten
  from public.goal_shadow_log
 where app_version like 'orvia-v8-%'
   and occurred_at >= timestamptz '2026-09-04 00:00:00+02';
