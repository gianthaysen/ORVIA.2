-- ============================================================
-- 0039 · Feature-Flag goal_plan_input — B-01, Schritt 3
-- ------------------------------------------------------------
-- WOFUER. B-01 stellt die Planung von der Legacy-Lesart goalOf() (Laufdistanz-
-- Filter, drei Rueckfallebenen, 110-Minuten-Default) auf das kanonische
-- Hauptziel (mainGoalOf → engine/goal-plan-input) um. 46 Aufrufer lesen
-- goalOf(); der Umbau tauscht die QUELLE in goalOf() selbst und behaelt die
-- FORM — hinter diesem Flag, damit der Wechsel je Konto ein- und
-- zurueckschaltbar ist (app/docs/B-01-UMSETZUNGSPLAN.md §4, Option A).
--
-- SERVERSEITIG, FAIL-CLOSED. Wie 0031/0034: Standard AUS, aktiviert nur eine
-- ausdruecklich gelesene Zeile mit enabled = true; der Client kann nicht
-- schreiben. Der CHECK-Constraint wird — wie in 0034 — komplett neu gesetzt
-- (drop + add), die 0031/0034-Dateien bleiben unangetastet.
--
-- EINSCHALTEN (nach Gate A, nur fuer ein Konto):
--   insert into public.user_feature_flags (user_id, flag, enabled, reason)
--   values ('<user-id>', 'goal_plan_input', true, 'B-01 Schattenbetrieb')
--   on conflict (user_id, flag) do update set enabled = true, reason = excluded.reason;
-- ZURUECK: dasselbe mit enabled = false.
-- ============================================================

begin;

alter table public.user_feature_flags
  drop constraint if exists user_feature_flags_flag_known;
alter table public.user_feature_flags
  add constraint user_feature_flags_flag_known
  check (flag in ('engine_v2_plan', 'engine_v2_readiness',
                  'canary_diagnostics', 'prediction_observer',
                  'goal_plan_input'));

commit;
