-- ============================================================
-- ORVIA · A-12 · Shadow-Eval Coverage & Struktur
-- ------------------------------------------------------------
-- WOZU. shadow-eval.js/canary-eval.js sind gebaut und getestet; A-12 fehlen
-- nur (a) ein dokumentierter Offline-Report und (b) genug angesammelte Daten.
-- Diese Abfrage beantwortet BEIDES vorbereitend, rein LESEND:
--   1. Reicht die Datenmenge schon fuer S1 (>= 14 verwertbare Vergleichstage)?
--   2. Wie ist eine echte shadow_observation-Zeile aufgebaut, damit der
--      Offline-Harness korrekt darauf abbildet (statt zu raten)?
-- KEIN Schreibvorgang, KEINE Gesundheitsdaten im Klartext (nur Schluessel/Status).
-- Blockweise im SQL-Editor der Produktionsinstanz ausfuehren.
-- ============================================================

-- ── Block 1 · Ueberblick ─────────────────────────────────────────────
select
  count(*)                                             as beobachtungen_gesamt,
  count(distinct user_id)                              as nutzer,
  count(distinct (decided_at at time zone 'UTC')::date) as verschiedene_tage,
  min(decided_at)                                      as erste,
  max(decided_at)                                      as letzte
from public.engine_decision_log
where decision_type = 'shadow_observation';

-- ── Block 2 · S1-Erreichbarkeit je Nutzer (>= 14 Tage?) ──────────────
select
  user_id,
  count(*)                                             as beobachtungen,
  count(distinct (decided_at at time zone 'UTC')::date) as tage,
  (count(distinct (decided_at at time zone 'UTC')::date) >= 14) as s1_erreichbar
from public.engine_decision_log
where decision_type = 'shadow_observation'
group by user_id
order by tage desc;

-- ── Block 3 · Abweichungsquote je Plantyp (coverage.phase) ───────────
-- Die DoD verlangt "Abweichungsquote je Plantyp". phase ist der Plantyp.
select
  coalesce(derived_state->'coverage'->>'phase', '(ohne)')      as plantyp,
  count(*)                                                      as beobachtungen,
  count(*) filter (where (derived_state->>'agree') = 'false')   as abweichungen,
  round(
    count(*) filter (where (derived_state->>'agree') = 'false')::numeric
    / nullif(count(*), 0), 4)                                   as abweichungsquote
from public.engine_decision_log
where decision_type = 'shadow_observation'
group by 1
order by beobachtungen desc;

-- ── Block 4 · Feasibility-/Progression-Status-Verteilung ─────────────
select
  derived_state->'coverage'->>'feasibilityStatus' as feasibility,
  derived_state->'coverage'->>'progressionStatus' as progression,
  count(*)                                         as anzahl
from public.engine_decision_log
where decision_type = 'shadow_observation'
group by 1, 2
order by anzahl desc;

-- ── Block 5 · Struktur EINER Zeile (nur Schluessel + coverage) ───────
-- Damit der Offline-Harness die DB-Zeile korrekt auf shadow-eval's
-- {v1,v2,agree}-Form abbildet, ohne Gesundheitsdaten offenzulegen.
select
  (select array_agg(k order by k)
     from jsonb_object_keys(derived_state) k)        as derived_state_schluessel,
  derived_state->'coverage'                          as coverage,
  jsonb_build_object(
    'status',       derived_state->'status',
    'deviation',    derived_state->'deviation',
    'stages_keys',  (select array_agg(k) from jsonb_object_keys(coalesce(derived_state->'stages','{}'::jsonb)) k)
  )                                                  as auszug
from public.engine_decision_log
where decision_type = 'shadow_observation'
order by decided_at desc
limit 1;
