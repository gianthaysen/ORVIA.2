-- ============================================================
-- Rueckweg 0051 · Athlete Performance Ledger
-- Entfernt Tabellen, Trigger, RPC und den Flag-Namen. Aktivitaeten und alle anderen Daten bleiben
-- unberuehrt (das Register ist vollstaendig aus den Aktivitaeten neu berechenbar).
-- Vorher pruefen, dass niemand das Flag performance_ledger an hat (sonst scheitert der CHECK):
--   delete from public.user_feature_flags where flag = 'performance_ledger';
-- ============================================================
begin;

delete from public.user_feature_flags where flag = 'performance_ledger';
alter table public.user_feature_flags
  drop constraint if exists user_feature_flags_flag_known;
alter table public.user_feature_flags
  add constraint user_feature_flags_flag_known
  check (flag in ('engine_v2_plan', 'engine_v2_readiness',
                  'canary_diagnostics', 'prediction_observer',
                  'goal_plan_input', 'absence_replanner'));

drop function if exists public.orvia_ledger_apply(text, uuid[], jsonb, text[], jsonb, jsonb, jsonb);
drop trigger if exists ple_mark_dirty on public.performance_ledger_entries;
drop function if exists public.orvia_ledger_mark_dirty();
drop table if exists public.performance_ledger_dirty;
drop table if exists public.performance_ledger_log;
drop table if exists public.performance_milestones;
drop table if exists public.performance_record_events;
drop table if exists public.performance_ledger_entries;

commit;
