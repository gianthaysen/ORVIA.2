-- ============================================================
-- 0040 · Feature-Flag absence_replanner — B-09 Ausfall-/Krankheitslogik
-- ------------------------------------------------------------
-- WOFUER. B-09: Krankheit (Morgen-Check-in), Verletzung und verpasste Kern-
-- reize wirken auf den GELESENEN Wochenplan (engine/absence-replanner, rein,
-- nicht persistierend). Hinter diesem Flag, serverseitig, fail-closed —
-- Muster 0034/0039. Der CHECK wird komplett neu gesetzt; 0031/0034/0039
-- bleiben unangetastet.
--
-- EINSCHALTEN (je Konto):
--   insert into public.user_feature_flags (user_id, flag, enabled, reason)
--   select id, 'absence_replanner', true, 'B-09' from auth.users where email = '<mail>'
--   on conflict (user_id, flag) do update set enabled = true, reason = excluded.reason;
-- ============================================================

begin;

alter table public.user_feature_flags
  drop constraint if exists user_feature_flags_flag_known;
alter table public.user_feature_flags
  add constraint user_feature_flags_flag_known
  check (flag in ('engine_v2_plan', 'engine_v2_readiness',
                  'canary_diagnostics', 'prediction_observer',
                  'goal_plan_input', 'absence_replanner'));

commit;
