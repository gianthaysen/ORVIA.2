-- ============================================================
--  ORVIA · 0004 — Live-Workout (Phase 4.2a: nur zwingende Schema-Ergänzungen)
--  Kompatibel zu 0003, idempotent, RLS erbt von den bestehenden Tabellen-Policies.
--  Ziel: stabile Client-IDs für Dedupe (Reorder/Doppelklick/Retry/Reload/Offline),
--  session_rpe, Abbruch-Status, max. EINE aktive Session pro Nutzer.
-- ============================================================

-- 1) Stabile Client-IDs (ersetzen den order_index/set_number-basierten Dedupe, der beim
--    Sortieren falsche Upserts erzeugen könnte). order_index/set_number bleiben als Anzeige-/
--    Sortierfelder erhalten, sind aber NICHT mehr der Konflikt-Schlüssel.
alter table public.workout_exercises add column if not exists client_exercise_id text;
alter table public.workout_sets     add column if not exists client_set_id text;

-- Alte zu strikte Unique-Indizes entfernen (Reorder-sicher), neue stabile Client-ID-Uniques.
drop index if exists public.workout_exercises_uniq;
drop index if exists public.workout_sets_uniq;
create unique index if not exists workout_exercises_client_uniq on public.workout_exercises (user_id, client_exercise_id) where client_exercise_id is not null;
create unique index if not exists workout_sets_client_uniq      on public.workout_sets (user_id, client_set_id) where client_set_id is not null;

-- 2) Session-RPE (für Gym-Last beim Abschluss) + Abbruch-Metadaten.
alter table public.workout_sessions add column if not exists session_rpe numeric;
alter table public.workout_sessions add column if not exists perceived_effort int;     -- subjektive Anstrengung 1–10
alter table public.workout_sessions add column if not exists cancel_reason text;        -- bei status='cancelled'/'aborted'

-- 3) Status-Wertebereich erweitern (planned|active|completed|skipped|cancelled|aborted|legacy).
do $$ begin
  alter table public.workout_sessions drop constraint if exists workout_sessions_status_check;
  alter table public.workout_sessions add constraint workout_sessions_status_check
    check (status in ('planned','active','completed','skipped','cancelled','aborted','legacy'));
end $$;

-- 4) Höchstens EINE aktive Session pro Nutzer (DB-seitig erzwungen).
create unique index if not exists workout_sessions_one_active on public.workout_sessions (user_id) where status = 'active';

-- 5) Sinnvolle Indizes für Live-Laden des Workout-Baums.
create index if not exists workout_exercises_user_idx on public.workout_exercises (user_id);
create index if not exists workout_sets_user_idx on public.workout_sets (user_id);
create index if not exists workout_sessions_status_idx on public.workout_sessions (user_id, status);

insert into public.schema_migrations(version) values ('0004_live_workout') on conflict (version) do nothing;
