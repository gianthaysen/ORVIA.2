-- ============================================================
-- ORVIA · Diagnose: warum shadow_observation = 0
-- ------------------------------------------------------------
-- Hypothese A (stark): Migration 0033 ist NICHT in der Produktionsinstanz.
--   Dann kennt der CHECK-Constraint auf decision_type die Beobachtungstypen
--   nicht und JEDER Insert von shadow_observation scheitert STILL (die Senke
--   schluckt den Fehler). Genau der Fehlertyp, den 0033s Kopf beschreibt.
-- Hypothese B: 0033 ist live, aber der Schreibpfad (logWeekShadow/observe)
--   produziert keine Zeile.
-- Diese drei Bloecke unterscheiden A von B. Rein LESEND.
-- ============================================================

-- Block 1 · Zaehlung je Typ: funktioniert die DB-Protokollierung ueberhaupt?
--   Haben die 8 Entscheidungstypen Zeilen, die 3 Beobachtungstypen aber 0
--   → spricht stark fuer den CHECK-Constraint (Hypothese A).
--   Sind ALLE 0 → Senke/RLS/uid (anderer Pfad).
select decision_type, count(*) as zeilen,
       min(decided_at) as erste, max(decided_at) as letzte
from public.engine_decision_log
group by decision_type
order by zeilen desc;

-- Block 2 · Der LIVE-CHECK-Constraint: kennt er die Beobachtungstypen?
--   Enthaelt die Ausgabe 'shadow_observation' NICHT → 0033 ist nicht live,
--   Hypothese A bestaetigt, Fix = 0033 einspielen.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.engine_decision_log'::regclass
  and contype = 'c';

-- Block 3 · Der 0033-Index: existiert er?
--   Fehlt engine_decision_log_type_idx → 0033 ist nicht live.
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'engine_decision_log'
  and indexname = 'engine_decision_log_type_idx';
