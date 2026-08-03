-- ============================================================
-- ORVIA · 0024 — Red-Flag-Erfassung im Morgen-Check-in (Batch 0)
-- ------------------------------------------------------------
-- Schließt den bisher toten Safety-Pfad: calc.js safetyCheck und
-- decision-engine-v2 kennen die Warnzeichen (fever, chestPain,
-- shortnessOfBreath, dizziness, neurologicalSymptoms, accidentPain,
-- swelling, instability), aber es gab keinen Erfassungs-/Persistenzpfad
-- (ENGINE-CONTRACT-AUDIT Befund 4).
--
-- Speicherform: jsonb-Objekt kanonischer Codes, nur gemeldete Flags,
-- z. B. {"fever": true, "dizziness": true}. NULL = nicht erfasst,
-- {} wird clientseitig gar nicht gesendet (H3-Muster: nur senden wenn
-- belegt — alte Clients ohne dieses Feld bleiben kompatibel).
--
-- Additiv + idempotent. RLS: daily_checkins ist bereits owner-only
-- (bestehende Policies greifen für die neue Spalte automatisch).
-- Rollback: alter table public.daily_checkins drop column red_flags;
-- ============================================================

alter table public.daily_checkins
  add column if not exists red_flags jsonb;

comment on column public.daily_checkins.red_flags is
  'Morgen-Check-in Warnzeichen (kanonische Codes, nur gemeldete Flags als true). Quelle: checkin-fields.js redFlags. Kein Messwert, immer bewusste Nutzerangabe.';
