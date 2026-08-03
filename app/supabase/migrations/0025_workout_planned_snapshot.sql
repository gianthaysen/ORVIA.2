-- ============================================================
-- ORVIA · 0025 — Unveränderlicher Plan-Snapshot je Workout-Session (Batch 2d)
-- ------------------------------------------------------------
-- workout_sessions.planned_session_id trägt seit Batch 2b/2d die konkrete
-- plannedOccurrenceId ('po:<lokales Datum>:<templateSessionId>'). Für den
-- späteren Plan-Ist-Vergleich (Debrief, Batch 7) braucht die Session
-- zusätzlich die GEPLANTE Vorgabe als unveränderlichen Snapshot — der
-- Wochenplan kann sich nach dem Start ändern, der Vergleichsanker nicht.
--
-- Inhalt (jsonb): { occurrenceId, templateSessionId, plannedDate,
--   t, l, d, capturedAt } — reine Kopie zum Startzeitpunkt, kein Messwert.
-- Client sendet die Spalte NUR wenn belegt (H3-Muster) — alte Instanzen
-- ohne diese Migration bleiben kompatibel.
--
-- Additiv + idempotent. RLS: workout_sessions ist bereits owner-only.
-- Rollback: alter table public.workout_sessions drop column planned_session_snapshot;
-- ============================================================

alter table public.workout_sessions
  add column if not exists planned_session_snapshot jsonb;

comment on column public.workout_sessions.planned_session_snapshot is
  'Unveränderlicher Snapshot der geplanten Einheit (Occurrence) zum Startzeitpunkt. Quelle: ui.js startPlannedUnit (Batch 2d). Anker für Plan-Ist-Vergleich.';
