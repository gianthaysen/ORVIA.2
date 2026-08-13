-- ============================================================
-- ORVIA · 0034 — Feature-Flag fuer den Prediction Observer (2026-08-08)
--
-- WARUM: Die Verdrahtung von predict()/resolve() ist gebaut, aber die
-- Datensammlung startet erst NACH dem gruenen Live-Test (Freigabeordnung
-- v8-292-Review). Der Schaltkanal ist derselbe wie fuer die Engine v2:
-- serverseitig, fail-closed, ohne Schreibrecht des Clients (0031).
-- Ein Fehler kann das Sammeln also niemals einschalten.
--
-- 0031 bleibt unangetastet (Geschichtsfaelschungs-Verbot) — dieser
-- Constraint-Ersatz erweitert nur die bekannte Flag-Liste.
--
-- AKTIVIEREN (nur nach gruenem prediction_observer_live_test):
--   insert into public.user_feature_flags (user_id, flag, enabled)
--   values ('<user-uuid>', 'prediction_observer', true)
--   on conflict (user_id, flag) do update set enabled = true;
-- ============================================================

alter table public.user_feature_flags
  drop constraint if exists user_feature_flags_flag_known;

alter table public.user_feature_flags
  add constraint user_feature_flags_flag_known
  check (flag in ('engine_v2_plan', 'engine_v2_readiness',
                  'canary_diagnostics', 'prediction_observer'));
