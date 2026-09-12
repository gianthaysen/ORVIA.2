-- ============================================================
-- 0043 · goal_shadow_log: Ereignistyp 'session' — A-06 Nachtrag (12.09.2026)
-- ------------------------------------------------------------
-- WOFUER. Der Ziel-Shadow-Log (0037) schrieb nur bei Zielmutationen. Acht Tage
-- Flag-Betrieb (goal_plan_input) ohne Zielbearbeitung ergaben NULL Zeilen — ein
-- Log, das Laufzeit belegen soll, muss auch bei blosser Nutzung schreiben.
-- 'session' = einmal je Geraet und Kalendertag nach dem Login (profile.js
-- _goalShadowSession), gleicher Vergleich mainGoalOf() vs goalOf().
-- Nur der CHECK-Constraint wird erweitert; keine Datenaenderung, keine Policy.
-- ============================================================

begin;

alter table public.goal_shadow_log
  drop constraint if exists goal_shadow_log_type_known;
alter table public.goal_shadow_log
  add constraint goal_shadow_log_type_known
  check (event_type in ('add','update','remove','status','session'));

commit;
