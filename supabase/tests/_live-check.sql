-- ============================================================
-- ORVIA · Live-Schema-Abgleich  (ERZEUGT — nicht von Hand ändern)
-- Quelle: supabase/migrations/ (34 Dateien)
-- Neu erzeugen: node app/tools/gen-live-check.mjs
-- ============================================================
-- Diese Abfrage beantwortet die eine Frage, die `public.schema_migrations`
-- nicht beantworten kann: Ist das, was die Migrationsdateien anlegen, in DIESER
-- Instanz wirklich vorhanden?
--
-- Ergebnis lesen: JEDE zurückgegebene Zeile FEHLT in der Datenbank.
-- Leeres Ergebnis = Migrationsdateien und Instanz sind deckungsgleich.
-- Nur Lesezugriffe.
--
-- Umfang: 47 Tabellen + 63 Spalten = 110 Prüfungen.
-- Bewusst NICHT geprüft (kein Zugriff über information_schema in dieser Form):
-- Indizes, Constraints, Policies, Funktionen. Für Funktionen und RLS gibt es
-- die Blöcke A und C in _live-check-bloecke.sql.
-- ============================================================

with erwartet(migration, art, tabelle, spalte) as (values
  ('0009','tabelle','activities',''),
  ('0019','tabelle','connected_devices',''),
  ('0002','tabelle','daily_checkins',''),
  ('0019','tabelle','daily_energy_expenditure',''),
  ('0019','tabelle','data_providers',''),
  ('0019','tabelle','device_capabilities',''),
  ('0032','tabelle','engine_decision_log',''),
  ('0003','tabelle','equipment',''),
  ('0003','tabelle','exercise_alternatives',''),
  ('0003','tabelle','exercise_equipment',''),
  ('0003','tabelle','exercise_muscles',''),
  ('0003','tabelle','exercise_training_qualities',''),
  ('0003','tabelle','exercises',''),
  ('0002','tabelle','fixed_schedule_items',''),
  ('0019','tabelle','metric_anomalies',''),
  ('0003','tabelle','movement_patterns',''),
  ('0003','tabelle','muscle_groups',''),
  ('0002','tabelle','orvia_migrations',''),
  ('0019','tabelle','profile_metric_settings',''),
  ('0019','tabelle','provider_credentials',''),
  ('0002','tabelle','readiness_baselines',''),
  ('0002','tabelle','readiness_components',''),
  ('0002','tabelle','readiness_scores',''),
  ('0002','tabelle','schema_migrations',''),
  ('0003','tabelle','sport_positions',''),
  ('0003','tabelle','sports',''),
  ('0035','tabelle','strength_workout_exports',''),
  ('0002','tabelle','training_load_daily',''),
  ('0003','tabelle','training_plan_days',''),
  ('0003','tabelle','training_plan_exercises',''),
  ('0003','tabelle','training_qualities',''),
  ('0014','tabelle','user_constraints',''),
  ('0031','tabelle','user_feature_flags',''),
  ('0002','tabelle','user_goals',''),
  ('0028','tabelle','user_metric_series',''),
  ('0019','tabelle','user_metrics',''),
  ('0002','tabelle','user_profiles',''),
  ('0002','tabelle','user_sports',''),
  ('0003','tabelle','user_training_plans',''),
  ('0030','tabelle','user_week_plans',''),
  ('0002','tabelle','weekly_availability',''),
  ('0003','tabelle','workout_exercises',''),
  ('0003','tabelle','workout_sessions',''),
  ('0003','tabelle','workout_sets',''),
  ('0003','tabelle','workout_template_days',''),
  ('0003','tabelle','workout_template_exercises',''),
  ('0003','tabelle','workout_templates',''),
  ('0021','spalte','daily_checkins','auto_sources'),
  ('0015','spalte','daily_checkins','energy'),
  ('0015','spalte','daily_checkins','note'),
  ('0024','spalte','daily_checkins','red_flags'),
  ('0002','spalte','training_load_daily','client_session_id'),
  ('0035','spalte','training_plan_exercises','target_weight_kg'),
  ('0027','spalte','user_goals','category_data'),
  ('0002','spalte','user_goals','client_goal_id'),
  ('0003','spalte','user_goals','current_value'),
  ('0027','spalte','user_goals','custom_category'),
  ('0012','spalte','user_goals','description'),
  ('0003','spalte','user_goals','gym_goal_type'),
  ('0012','spalte','user_goals','metric_type'),
  ('0027','spalte','user_goals','milestones'),
  ('0027','spalte','user_goals','motivation'),
  ('0003','spalte','user_goals','position_key'),
  ('0012','spalte','user_goals','section_updated_at'),
  ('0003','spalte','user_goals','sport_key'),
  ('0027','spalte','user_goals','sports'),
  ('0003','spalte','user_goals','start_date'),
  ('0027','spalte','user_goals','time_horizon'),
  ('0002','spalte','user_profiles','age_estimate'),
  ('0016','spalte','user_profiles','avatar_path'),
  ('0029','spalte','user_profiles','bio'),
  ('0002','spalte','user_profiles','birth_date'),
  ('0013','spalte','user_profiles','constraints_acknowledged_at'),
  ('0029','spalte','user_profiles','handle'),
  ('0016','spalte','user_profiles','location'),
  ('0018','spalte','user_profiles','preferences'),
  ('0018','spalte','user_profiles','recovery'),
  ('0011','spalte','user_sports','client_role'),
  ('0011','spalte','user_sports','custom_name'),
  ('0003','spalte','user_sports','custom_position'),
  ('0003','spalte','user_sports','level'),
  ('0003','spalte','user_sports','position_key'),
  ('0003','spalte','user_sports','season_phase'),
  ('0011','spalte','user_sports','section_updated_at'),
  ('0011','spalte','user_sports','sessions_per_week'),
  ('0003','spalte','user_sports','sport_key'),
  ('0011','spalte','user_sports','typical_duration_min'),
  ('0013','spalte','weekly_availability','max_intense_week'),
  ('0013','spalte','weekly_availability','max_sessions_week'),
  ('0013','spalte','weekly_availability','min_rest_days'),
  ('0013','spalte','weekly_availability','rest_day'),
  ('0013','spalte','weekly_availability','section_updated_at'),
  ('0004','spalte','workout_exercises','client_exercise_id'),
  ('0035','spalte','workout_exercises','target_weight_kg'),
  ('0004','spalte','workout_sessions','cancel_reason'),
  ('0005','spalte','workout_sessions','paused_at'),
  ('0004','spalte','workout_sessions','perceived_effort'),
  ('0025','spalte','workout_sessions','planned_session_snapshot'),
  ('0004','spalte','workout_sessions','session_rpe'),
  ('0003','spalte','workout_sessions','sport_key'),
  ('0005','spalte','workout_sessions','total_paused_seconds'),
  ('0004','spalte','workout_sets','client_set_id'),
  ('0035','spalte','workout_sets','external_set_key'),
  ('0035','spalte','workout_sets','garmin_category_raw'),
  ('0035','spalte','workout_sets','garmin_exercise_name_raw'),
  ('0035','spalte','workout_sets','import_status'),
  ('0035','spalte','workout_sets','imported_at'),
  ('0035','spalte','workout_sets','recognition_probability'),
  ('0035','spalte','workout_sets','source'),
  ('0035','spalte','workout_sets','wkt_step_index')
)
select e.migration, e.art, e.tabelle, e.spalte
  from erwartet e
 where (e.art = 'tabelle' and not exists (
         select 1 from information_schema.tables t
          where t.table_schema='public' and t.table_name = e.tabelle))
    or (e.art = 'spalte' and not exists (
         select 1 from information_schema.columns c
          where c.table_schema='public' and c.table_name = e.tabelle
            and c.column_name = e.spalte))
 order by e.migration, e.tabelle, e.spalte;
