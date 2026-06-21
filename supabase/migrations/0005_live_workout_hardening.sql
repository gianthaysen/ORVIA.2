-- ============================================================
--  ORVIA · 0005 — Live-Workout-Härtung (Phase 4.2)
--  Nur zwingende Ergänzungen: echte Pausenzeit + 'paused' im Status-Wertebereich.
--  Idempotent, kompatibel zu 0004, RLS erbt von den bestehenden Policies.
--  HINWEIS: Der Live-Pausenfluss lässt status='active' und trackt die Pausenzeit über
--  paused_at/total_paused_seconds (so bleibt "max. EINE aktive Session" + Restore einfach).
--  'paused' ist als Statuswert dennoch erlaubt (Domain/Validatoren/Zukunft), wird aber im
--  aktuellen Live-Fluss nicht als terminaler Sessionstatus gesetzt.
-- ============================================================

-- 1) Echte Workout-Pause: Zeitpunkt der laufenden Pause + summierte Pausensekunden.
alter table public.workout_sessions add column if not exists paused_at timestamptz;
alter table public.workout_sessions add column if not exists total_paused_seconds numeric not null default 0;

-- 2) Status-Wertebereich um 'paused' erweitern (deckungsgleich mit training-domain.SESSION_STATUS).
do $$ begin
  alter table public.workout_sessions drop constraint if exists workout_sessions_status_check;
  alter table public.workout_sessions add constraint workout_sessions_status_check
    check (status in ('planned','active','paused','completed','skipped','cancelled','aborted','legacy'));
end $$;

insert into public.schema_migrations(version) values ('0005_live_workout_hardening') on conflict (version) do nothing;
