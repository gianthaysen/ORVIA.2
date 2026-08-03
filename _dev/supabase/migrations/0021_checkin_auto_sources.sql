-- ============================================================
-- 0021 · daily_checkins.auto_sources — Feld-Herkunft für Phase 6
-- ------------------------------------------------------------
-- Kennzeichnet je Check-in-Feld, ob der Wert automatisch aus einem
-- Provider-Sync übernommen wurde (z. B. {"sleepMin":"garmin","rhr":"garmin"}).
-- NULL = vollständig manuelle Zeile (Bestand). Der Client sendet die Spalte
-- nur, wenn mindestens ein Feld automatisch übernommen wurde (H3-Muster),
-- bleibt also mit nicht-migrierten Instanzen kompatibel.
-- Zeilen-source erweitert sich um 'mixed' (manuell + automatisch) —
-- die Spalte hat bewusst keinen CHECK-Constraint (0002).
-- ============================================================
alter table public.daily_checkins
  add column if not exists auto_sources jsonb;

comment on column public.daily_checkins.auto_sources is
  'Phase 6: je Feld-Key des Check-ins die automatische Quelle (z. B. garmin). NULL = rein manuell.';
