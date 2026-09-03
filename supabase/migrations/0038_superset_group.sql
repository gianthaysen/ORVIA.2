-- ============================================================
-- 0038 · workout_exercises.superset_group — B-05 (Supersets)
-- ------------------------------------------------------------
-- WOFUER. Band 1, B-05: Zwei oder mehr Uebungen einer Session lassen sich zu
-- einem Superset gruppieren; der Player fuehrt sie abwechselnd aus
-- (A1 → B1 → A2 → B2). Gate B, Kriterium 4 verlangt, dass die Gruppierung den
-- Sync-Roundtrip verlustfrei uebersteht — sie muss also in der Datenbank
-- liegen, nicht nur im Player-Zustand (app/docs/B-05-UMSETZUNGSPLAN.md §4).
--
-- WARUM EINE SPALTE UND KEINE TABELLE. Ein Superset ist eine Gruppierung von
-- 2–3 Zeilen derselben Session ohne eigene Eigenschaften. Eine eigene Tabelle
-- (RLS, Policies, Sync-Pfad, Join in jeder Leseoperation) waere Vorrats-
-- architektur ohne heutigen Gegenwert. Braucht eine Gruppe spaeter Attribute
-- (Gruppen-Pausenzeit), ist das eine additive Migration.
--
-- SEMANTIK. Zwei Uebungen mit demselben superset_group-Wert in derselben
-- Session bilden einen Superset. NULL = normale Uebung = exakt heutiges
-- Verhalten (Datenluecke != Wert). Die Reihenfolge innerhalb der Gruppe bleibt
-- order_index. Eine Gruppe mit nur EINER Uebung ist kein Superset — das
-- entscheidet der Client (superset-model.groupsOf), nicht die Datenbank.
--
-- KEIN CONSTRAINT-UMBAU, KEIN INDEX. Die Spalte wird nur innerhalb einer
-- Session gelesen (Filter ueber workout_session_id, bereits indiziert). Ein
-- Check > 0 ist bewusst weggelassen: der Client schreibt nur 1..n, und ein
-- Constraint, der bei einem Tippfehler die ganze Uebung verwirft, waere fuer
-- ein reines Gruppierungsfeld die falsche Haerte.
--
-- RUECKWAERTSKOMPATIBEL. Der Client schickt superset_group NIE beim Anlegen
-- einer Uebung (nur nullable Update nach dem Gruppieren). Ist diese Migration
-- noch nicht live, scheitert damit NUR das Gruppieren mit einer sichtbaren
-- Meldung — nicht das Anlegen von Uebungen (Vorfallklasse Gym-Bug 0035).
-- ============================================================

begin;

alter table public.workout_exercises
  add column if not exists superset_group smallint;

comment on column public.workout_exercises.superset_group is
  'B-05: Uebungen derselben Session mit gleichem Wert bilden einen Superset (A1→B1→A2→B2). NULL = normale Uebung.';

commit;
