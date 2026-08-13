-- ============================================================
-- ORVIA · 0033 — Beobachtungstypen im Entscheidungs-Log (2026-08-08)
--
-- WARUM EINE NEUE MIGRATION: 0032 ist produktiv. Ihr Check-Constraint kennt
-- nur die acht Entscheidungstypen — jeder Insert von `shadow_observation`,
-- `prediction_record` oder `prediction_evaluation` scheitert deshalb STILL
-- (logDecision meldet queued, die Senke gibt false zurueck, niemand sieht es).
-- Genau der Fehlertyp, der gefaehrlicher ist als ein Absturz: Das System
-- bleibt dauerhaft plausibel „noch nicht fertig".
--
-- Eine bestehende Migration nachtraeglich zu aendern waere keine Migration,
-- sondern Geschichtsfaelschung — deshalb 0033.
-- ============================================================

alter table public.engine_decision_log
  drop constraint if exists engine_decision_log_type_known;

alter table public.engine_decision_log
  add constraint engine_decision_log_type_known
  check (decision_type in (
    'week_design','policy_move','user_override','opportunity_move',
    'progression','variant_select','constraint_block','final_plan',
    -- Beobachtungen: im Log, aber nie Teil der Erklaerung einer Woche.
    'shadow_observation','prediction_record','prediction_evaluation'
  ));

-- Die Abnahme- und Kalibrierungsabfragen filtern serverseitig nach Typ und
-- sortieren absteigend nach Zeit — dieser Index traegt genau dieses Muster,
-- damit das 500er-Fenster nicht zum Tabellenscan wird.
create index if not exists engine_decision_log_type_idx
  on public.engine_decision_log (user_id, decision_type, decided_at desc);
