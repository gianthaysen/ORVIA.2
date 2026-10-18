-- ============================================================
-- ORVIA · Vollstaendige Wiederherstellung aus der Sicherung (Worker v8-452.1) — NUR IM NOTFALL
-- ------------------------------------------------------------
-- Setzt metrics der gesicherten Schwimmeinheiten auf den Stand der Sicherung zurueck
-- (v4521_swim_extras_backup.sql), uebernimmt dabei aber die AKTUELLEN clientgefuehrten Schluessel
-- (corrections, durationCorrection, plannedSessionId, planLinkCorrection) — eine Korrektur, die
-- nach der Sicherung gesetzt oder zurueckgenommen wurde, bleibt so, wie sie jetzt ist.
-- Nur noetig, wenn das Nachholen etwas anderes als Runden/Bahnen veraendert haette; fuer den
-- normalen Rueckweg reicht v4521_swim_extras_rollback.sql.
-- VORHER im Worker DETAIL_EXTRAS leeren. Eine Transaktion; ein zweiter Lauf aendert nichts.
-- ============================================================
begin;

update public.activities a
set metrics = (b.metrics - 'corrections' - 'durationCorrection' - 'plannedSessionId' - 'planLinkCorrection')
              || coalesce((select jsonb_object_agg(k, a.metrics -> k)
                           from unnest(array['corrections', 'durationCorrection', 'plannedSessionId', 'planLinkCorrection']) k
                           where a.metrics ? k), '{}'::jsonb)
from orvia_backup.activities_swim_v4521 b
where a.id = b.id and a.user_id = b.user_id and a.source = 'garmin';

select count(*) as wiederhergestellt from orvia_backup.activities_swim_v4521;

commit;
