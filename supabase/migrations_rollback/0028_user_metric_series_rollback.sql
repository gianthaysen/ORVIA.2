-- ============================================================
-- 0028 · ROLLBACK — user_metric_series
-- ------------------------------------------------------------
-- Nicht-destruktiv für Bestandsdaten: 0028 ist rein additiv (neue Tabelle),
-- daher entfernt der Rollback nur diese Tabelle und ihre Policies (Policies +
-- Indizes fallen mit der Tabelle). Keine andere Tabelle/Spalte ist betroffen.
-- Manuell anzuwenden (Supabase-Migrationen sind vorwärtsgerichtet).
-- ============================================================
drop table if exists public.user_metric_series cascade;
